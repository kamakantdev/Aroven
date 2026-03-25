/**
 * Hospital Manager Service
 * Hospital owner/manager operations: profile, doctors, appointments, analytics
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { maybeGeocodeLocationUpdates } = require('../utils/geocoding');

// Get hospital by owner/manager
const getHospitalByOwner = async (userId) => {
  // Try owner first
  let { data: hospital } = await supabaseAdmin
    .from('hospitals')
    .select('*')
    .eq('owner_id', userId)
    .single();

  if (!hospital) {
    // Check if user is a manager
    const { data: managerEntry } = await supabaseAdmin
      .from('hospital_managers')
      .select('hospital_id')
      .eq('user_id', userId)
      .single();

    if (managerEntry) {
      const { data: h } = await supabaseAdmin
        .from('hospitals')
        .select('*')
        .eq('id', managerEntry.hospital_id)
        .single();
      hospital = h;
    }
  }

  if (!hospital) {
    throw new ApiError(404, 'Hospital not found for this user');
  }

  return hospital;
};

// Dashboard
const getDashboard = async (hospitalId, userId) => {
  const today = new Date().toISOString().split('T')[0];

  const [
    { data: hospitalMeta },
    { count: totalDoctors },
    { count: todayAppointments },
    { count: totalAppointments },
    { data: patientRows },
    { data: recentAppointments },
    { data: departments },
  ] = await Promise.all([
    supabaseAdmin
      .from('hospitals')
      .select('bed_capacity, bed_count')
      .eq('id', hospitalId)
      .maybeSingle(),
    supabaseAdmin.from('hospital_doctors').select('*', { count: 'exact', head: true }).eq('hospital_id', hospitalId),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('hospital_id', hospitalId).eq('appointment_date', today),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('hospital_id', hospitalId),
    supabaseAdmin.from('appointments').select('patient_id').eq('hospital_id', hospitalId),
    supabaseAdmin.from('appointments').select('*, patient:patients(name), doctor:doctors(name, specialization)').eq('hospital_id', hospitalId).order('appointment_date', { ascending: false }).limit(10),
    supabaseAdmin.from('hospital_departments').select('*').eq('hospital_id', hospitalId),
  ]);

  const uniquePatients = new Set((patientRows || []).map((r) => r.patient_id)).size;

  const departmentList = departments || [];
  const beds = hospitalMeta?.bed_capacity ?? hospitalMeta?.bed_count ?? null;

  return {
    stats: {
      totalDoctors: totalDoctors || 0,
      todayAppointments: todayAppointments || 0,
      // Alias for existing web UI key
      todaysAppointments: todayAppointments || 0,
      totalAppointments: totalAppointments || 0,
      totalPatients: uniquePatients,
      // UI reads this from stats
      departments: departmentList.length,
      bedCapacity: beds != null ? `${beds} beds` : undefined,
    },
    recentAppointments: recentAppointments || [],
    departments: departmentList,
  };
};

// Update hospital
const updateHospital = async (hospitalId, userId, updates) => {
  const { data: existingHospital, error: existingHospitalError } = await supabaseAdmin
    .from('hospitals')
    .select('id, owner_id, address, city, state, pincode, latitude, longitude')
    .eq('id', hospitalId)
    .single();

  if (existingHospitalError || !existingHospital) {
    throw existingHospitalError || new ApiError(404, 'Hospital not found');
  }

  // Whitelist allowed update fields to prevent mass-assignment
  const allowedFields = ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
    'latitude', 'longitude', 'description', 'opening_hours', 'facilities',
    'profile_image_url', 'emergency_available', 'bed_count', 'bed_capacity', 'specializations'];
  const safeUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }
  Object.assign(safeUpdates, await maybeGeocodeLocationUpdates(existingHospital, safeUpdates));
  safeUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('hospitals')
    .update(safeUpdates)
    .eq('id', hospitalId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

// Get doctors
const getDoctors = async (hospitalId, userId, filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const hasPostFilters = !!(filters.specialization || filters.search);

  let query = supabaseAdmin
    .from('hospital_doctors')
    .select('*, doctor:doctors(id, name, specialization, profile_image_url, consultation_fee, is_available, rating)', { count: 'exact' })
    .eq('hospital_id', hospitalId);

  if (hasPostFilters) {
    // Fetch ALL rows (no pagination) so post-filters see the full dataset
    const { data, error } = await query;
    if (error) throw error;

    let result = data || [];
    if (filters.specialization) {
      result = result.filter(d => d.doctor?.specialization === filters.specialization);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(d => d.doctor?.name?.toLowerCase().includes(s));
    }

    const total = result.length;
    const paginated = result.slice(offset, offset + limit);

    return {
      data: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // No post-filters — paginate at DB level for efficiency
  const { data, error, count } = await query
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Invite doctor
const inviteDoctor = async (hospitalId, userId, data) => {
  const { doctorId, email, department, schedule } = data;

  let doctor;

  if (doctorId) {
    // Direct ID-based lookup
    const { data: doc } = await supabaseAdmin
      .from('doctors')
      .select('id, name')
      .eq('id', doctorId)
      .single();
    doctor = doc;
  } else if (email) {
    // Route sends email — resolve to doctor via user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      throw new ApiError(404, 'No user found with this email');
    }

    const { data: doc } = await supabaseAdmin
      .from('doctors')
      .select('id, name')
      .eq('user_id', user.id)
      .single();
    doctor = doc;
  }

  if (!doctor) {
    throw new ApiError(404, 'Doctor not found. Please verify the email or doctor ID.');
  }

  // Use resolved doctor.id (handles both direct-ID and email paths)
  const resolvedDoctorId = doctor.id;

  // Check if already associated
  const { data: existing } = await supabaseAdmin
    .from('hospital_doctors')
    .select('id')
    .eq('hospital_id', hospitalId)
    .eq('doctor_id', resolvedDoctorId)
    .single();

  if (existing) {
    throw new ApiError(409, 'Doctor is already associated with this hospital');
  }

  const { data: association, error } = await supabaseAdmin
    .from('hospital_doctors')
    .insert({
      hospital_id: hospitalId,
      doctor_id: resolvedDoctorId,
      department,
      schedule,
    })
    .select('*, doctor:doctors(name, specialization)')
    .single();

  if (error) throw error;
  return { data: association, message: 'Doctor invited successfully' };
};

// Remove doctor
const removeDoctor = async (hospitalId, userId, doctorId) => {
  const { error } = await supabaseAdmin
    .from('hospital_doctors')
    .delete()
    .eq('hospital_id', hospitalId)
    .eq('doctor_id', doctorId);

  if (error) throw error;
};

// Get appointments
const getAppointments = async (hospitalId, userId, filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('appointments')
    .select('*, patient:patients(name), doctor:doctors(name, specialization)', { count: 'exact' })
    .eq('hospital_id', hospitalId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId);
  if (filters.date) query = query.eq('appointment_date', filters.date);
  if (filters.fromDate) query = query.gte('appointment_date', filters.fromDate);
  if (filters.toDate) query = query.lte('appointment_date', filters.toDate);

  const { data, error, count } = await query
    .order('appointment_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Analytics
const getAnalytics = async (hospitalId, userId, period = '30d') => {
  const days = parseInt(period) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const [
    { count: totalAppointments },
    { count: completedAppointments },
    { count: cancelledAppointments },
    { data: appointmentData },
  ] = await Promise.all([
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('hospital_id', hospitalId).gte('created_at', sinceStr),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('hospital_id', hospitalId).eq('status', 'completed').gte('created_at', sinceStr),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('hospital_id', hospitalId).eq('status', 'cancelled').gte('created_at', sinceStr),
    supabaseAdmin.from('appointments').select('fee, status').eq('hospital_id', hospitalId).eq('status', 'completed').gte('created_at', sinceStr),
  ]);

  const totalRevenue = (appointmentData || []).reduce((sum, a) => sum + (a.fee || 0), 0);

  return {
    data: {
      period,
      totalAppointments: totalAppointments || 0,
      completedAppointments: completedAppointments || 0,
      cancelledAppointments: cancelledAppointments || 0,
      totalRevenue,
    },
  };
};

// Get managers
const getManagers = async (hospitalId, userId) => {
  const { data, error } = await supabaseAdmin
    .from('hospital_managers')
    .select('*, user:users(id, name, email, phone, profile_image_url)')
    .eq('hospital_id', hospitalId);

  if (error) throw error;
  return data || [];
};

// Add manager
const addManager = async (hospitalId, userId, managerData) => {
  const { email, name, permissions } = managerData;

  // Find user by email
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role')
    .eq('email', email)
    .single();

  if (!user) {
    throw new ApiError(404, 'User not found with this email');
  }

  // Check if user is already a manager for this hospital
  const { data: existingManager } = await supabaseAdmin
    .from('hospital_managers')
    .select('id')
    .eq('hospital_id', hospitalId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingManager) {
    throw new ApiError(409, 'This user is already a manager for this hospital');
  }

  // Check if user already has a provider role that shouldn't be overwritten
  const protectedRoles = ['doctor', 'hospital_owner', 'pharmacy_owner', 'clinic_owner', 'diagnostic_center_owner', 'ambulance_operator', 'admin', 'super_admin'];
  if (protectedRoles.includes(user.role)) {
    throw new ApiError(409, `Cannot assign hospital_manager role: user already has role '${user.role}'. They must use a different account.`);
  }

  // Update user role (only from patient or unset)
  await supabaseAdmin
    .from('users')
    .update({ role: 'hospital_manager' })
    .eq('id', user.id);

  const { data: manager, error } = await supabaseAdmin
    .from('hospital_managers')
    .insert({
      hospital_id: hospitalId,
      user_id: user.id,
      role: 'manager',
      permissions: permissions || ['view_appointments', 'manage_doctors'],
    })
    .select('*, user:users(id, name, email)')
    .single();

  if (error) throw error;
  return manager;
};

// Get consultations for all doctors affiliated with this hospital
const getConsultations = async (userId, page = 1, limit = 20, status) => {
  const hospital = await getHospitalByOwner(userId);
  if (!hospital) throw new ApiError(404, 'Hospital not found');

  // Get all doctor IDs affiliated with this hospital
  const { data: hospitalDoctors } = await supabaseAdmin
    .from('hospital_doctors')
    .select('doctor_id')
    .eq('hospital_id', hospital.id)
    .eq('is_active', true);

  const doctorIds = (hospitalDoctors || []).map(d => d.doctor_id);
  if (doctorIds.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };

  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('consultations')
    .select('*, doctor:doctors(id, name, specialization, profile_image_url), patient:patients(id, name), appointment:appointments(id, appointment_date, time_slot, type)', { count: 'exact' })
    .in('doctor_id', doctorIds);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

module.exports = {
  getHospitalByOwner,
  getDashboard,
  updateHospital,
  getDoctors,
  inviteDoctor,
  removeDoctor,
  getAppointments,
  getAnalytics,
  getManagers,
  addManager,
  getConsultations,
};
