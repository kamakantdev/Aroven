/**
 * Clinic Service
 * Clinic registration, management, doctors, appointments
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { calculateDistance, getBoundingBox, formatDistance } = require('../utils/geo');
const { maybeGeocodeLocationUpdates } = require('../utils/geocoding');
const { sanitizeSearch } = require('../utils/sanitize');

const enrichMissingPhonesFromOwners = async (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const ownerIdsNeedingFallback = [
    ...new Set(
      rows
        .filter((row) => row && !row.phone && row.owner_id)
        .map((row) => row.owner_id)
    ),
  ];

  if (ownerIdsNeedingFallback.length === 0) return rows;

  const { data: owners, error } = await supabaseAdmin
    .from('users')
    .select('id, phone')
    .in('id', ownerIdsNeedingFallback);

  if (error || !owners) return rows;

  const ownerPhoneById = new Map(
    owners
      .filter((owner) => owner?.id && owner?.phone)
      .map((owner) => [owner.id, owner.phone])
  );

  return rows.map((row) => {
    if (row?.phone || !row?.owner_id) return row;
    const fallbackPhone = ownerPhoneById.get(row.owner_id);
    return fallbackPhone ? { ...row, phone: fallbackPhone } : row;
  });
};

// Search clinics
const searchClinics = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('clinics')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .eq('is_approved', true);

  if (filters.city) query = query.ilike('city', `%${sanitizeSearch(filters.city)}%`);
  if (filters.specialization) query = query.contains('specializations', [filters.specialization]);
  if (filters.search) {
    const s = sanitizeSearch(filters.search);
    if (s) query = query.or(`name.ilike.%${s}%,city.ilike.%${s}%`);
  }

  const { data, error, count } = await query
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const recordsWithPhone = await enrichMissingPhonesFromOwners(data || []);

  return {
    data: recordsWithPhone,
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Find nearby clinics
const findNearby = async (latitude, longitude, radius = 10, specialization) => {
  const bounds = getBoundingBox({ latitude, longitude }, radius);

  let query = supabaseAdmin
    .from('clinics')
    .select('*')
    .eq('is_active', true)
    .eq('is_approved', true)
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng);

  if (specialization) query = query.contains('specializations', [specialization]);

  const { data, error } = await query;
  if (error) throw error;

  const recordsWithPhone = await enrichMissingPhonesFromOwners(data || []);

  return recordsWithPhone
    .map((c) => {
      const dist = calculateDistance({ latitude, longitude }, { latitude: c.latitude, longitude: c.longitude });
      return { ...c, distance: dist, distanceText: formatDistance(dist) };
    })
    .filter((c) => c.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
};

// Get clinic by ID
const getClinicById = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .eq('is_approved', true)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Clinic not found');
  }
  const [recordWithPhone] = await enrichMissingPhonesFromOwners([data]);
  return recordWithPhone || data;
};

// Register clinic
const registerClinic = async (userId, clinicData) => {
  const { data, error } = await supabaseAdmin
    .from('clinics')
    .insert({
      owner_id: userId,
      name: clinicData.name,
      phone: clinicData.phone,
      email: clinicData.email,
      address: clinicData.address,
      city: clinicData.city,
      state: clinicData.state,
      pincode: clinicData.pincode,
      latitude: clinicData.latitude,
      longitude: clinicData.longitude,
      specializations: clinicData.specializations || [],
      is_active: false, // Pending admin approval
      is_approved: false,
      approval_status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

// Get clinic by owner
const getClinicByOwner = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('*')
    .eq('owner_id', userId)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Clinic not found for this user');
  }
  return data;
};

// Get dashboard stats
const getDashboard = async (clinicId, userId) => {
  // Verify this user owns the clinic
  const { data: clinic } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .eq('id', clinicId)
    .eq('owner_id', userId)
    .single();

  if (!clinic) {
    throw new ApiError(403, 'Clinic not found or access denied');
  }

  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalDoctors },
    { count: todayAppointments },
    { count: walkInsToday },
    { data: patientRows },
    { data: todayAppointmentRows },
    { data: recentAppointments },
  ] = await Promise.all([
    supabaseAdmin.from('clinic_doctors').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('appointment_date', today).not('status', 'in', '(cancelled)'),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('appointment_date', today).eq('type', 'clinic').not('status', 'in', '(cancelled)'),
    supabaseAdmin.from('appointments').select('patient_id').eq('clinic_id', clinicId).not('status', 'in', '(cancelled)'),
    supabaseAdmin.from('appointments').select('*, patient:patients(name), doctor:doctors(name, specialization)').eq('clinic_id', clinicId).eq('appointment_date', today).not('status', 'in', '(cancelled)').order('time_slot', { ascending: true }).limit(25),
    supabaseAdmin.from('appointments').select('*, patient:patients(name), doctor:doctors(name, specialization)').eq('clinic_id', clinicId).not('status', 'in', '(cancelled)').order('appointment_date', { ascending: false }).limit(10),
  ]);

  const patientIds = (patientRows || []).map((r) => r.patient_id).filter(Boolean);
  const uniquePatients = new Set(patientIds).size;
  const patientVisitCounts = patientIds.reduce((acc, pid) => {
    acc[pid] = (acc[pid] || 0) + 1;
    return acc;
  }, {});
  const repeatPatientCount = Object.values(patientVisitCounts).filter((n) => n > 1).length;
  const repeatPatients = uniquePatients > 0
    ? `${Math.round((repeatPatientCount / uniquePatients) * 100)}%`
    : '0%';

  return {
    stats: {
      totalDoctors: totalDoctors || 0,
      todayAppointments: todayAppointments || 0,
      // Aliases for clinic web UI compatibility
      totalStaff: totalDoctors || 0,
      todaysAppointments: todayAppointments || 0,
      walkInsToday: walkInsToday || 0,
      repeatPatients,
      totalPatients: uniquePatients,
    },
    todayAppointments: todayAppointmentRows || [],
    recentAppointments: recentAppointments || [],
  };
};

// Update clinic
const updateClinic = async (clinicId, userId, updates) => {
  const { data: existingClinic, error: existingClinicError } = await supabaseAdmin
    .from('clinics')
    .select('id, owner_id, address, city, state, pincode, latitude, longitude')
    .eq('id', clinicId)
    .eq('owner_id', userId)
    .single();

  if (existingClinicError || !existingClinic) {
    throw existingClinicError || new ApiError(404, 'Clinic not found');
  }

  // Whitelist allowed update fields to prevent mass-assignment
  const allowedFields = ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
    'latitude', 'longitude', 'specializations', 'description', 'opening_hours',
    'profile_image_url', 'image_url', 'profile_image', 'is_24_hours', 'facilities'];
  const safeUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }

  // Backward/forward compatibility for mixed frontend payload keys
  if (safeUpdates.profile_image_url === undefined) {
    if (safeUpdates.image_url !== undefined) safeUpdates.profile_image_url = safeUpdates.image_url;
    else if (safeUpdates.profile_image !== undefined) safeUpdates.profile_image_url = safeUpdates.profile_image;
  }
  delete safeUpdates.image_url;
  delete safeUpdates.profile_image;

  Object.assign(safeUpdates, await maybeGeocodeLocationUpdates(existingClinic, safeUpdates));
  safeUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('clinics')
    .update(safeUpdates)
    .eq('id', clinicId)
    .eq('owner_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

// Get clinic operating schedule
const getSchedule = async (clinicId, userId) => {
  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('opening_hours')
    .eq('id', clinicId)
    .eq('owner_id', userId)
    .single();

  if (error || !data) {
    throw error || new ApiError(404, 'Clinic not found');
  }

  return data.opening_hours || [];
};

// Update clinic operating schedule
const updateSchedule = async (clinicId, userId, schedule) => {
  const payload = {
    opening_hours: schedule || [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('clinics')
    .update(payload)
    .eq('id', clinicId)
    .eq('owner_id', userId)
    .select('opening_hours')
    .single();

  if (error) throw error;
  return data.opening_hours || [];
};

// Get doctors in clinic
const getDoctors = async (clinicId, userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const { data, error, count } = await supabaseAdmin
    .from('clinic_doctors')
    .select('*, doctor:doctors(id, name, specialization, profile_image_url, consultation_fee)', { count: 'exact' })
    .eq('clinic_id', clinicId)
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Add doctor to clinic
const addDoctor = async (clinicId, userId, doctorId) => {
  const { data, error } = await supabaseAdmin
    .from('clinic_doctors')
    .insert({ clinic_id: clinicId, doctor_id: doctorId })
    .select('*, doctor:doctors(id, name, specialization)')
    .single();

  if (error) throw error;
  return data;
};

// Remove doctor from clinic
const removeDoctor = async (clinicId, userId, doctorId) => {
  const { error } = await supabaseAdmin
    .from('clinic_doctors')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('doctor_id', doctorId);

  if (error) throw error;
};

// Get appointments for clinic
const getAppointments = async (clinicId, userId, filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('appointments')
    .select('*, patient:patients(name), doctor:doctors(name, specialization)', { count: 'exact' })
    .eq('clinic_id', clinicId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) query = query.eq('appointment_date', filters.date);

  const { data, error, count } = await query
    .order('appointment_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Get consultations for all doctors affiliated with this clinic
const getConsultations = async (userId, page = 1, limit = 20, status) => {
  const clinic = await getClinicByOwner(userId);
  if (!clinic) throw new ApiError(404, 'Clinic not found');

  // Get all doctor IDs affiliated with this clinic
  const { data: clinicDoctors } = await supabaseAdmin
    .from('clinic_doctors')
    .select('doctor_id')
    .eq('clinic_id', clinic.id)
    .eq('is_active', true);

  const doctorIds = (clinicDoctors || []).map(d => d.doctor_id);
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

// Get clinic doctors (public — for patient discovery)
const getClinicDoctorsPublic = async (clinicId) => {
  const { data: clinic, error: clinicError } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .eq('id', clinicId)
    .eq('is_active', true)
    .eq('is_approved', true)
    .maybeSingle();

  if (clinicError) throw clinicError;
  if (!clinic) throw new ApiError(404, 'Clinic not found');

  const { data, error } = await supabaseAdmin
    .from('clinic_doctors')
    .select('*, doctor:doctors(id, name, specialization, profile_image_url, consultation_fee, experience_years, is_approved)')
    .eq('clinic_id', clinicId)
    .eq('is_active', true);

  if (error) throw error;
  return (data || [])
    .map(cd => cd.doctor)
    .filter((doctor) => doctor?.is_approved === true)
    .map(({ is_approved: _ignored, ...doctor }) => doctor);
};

module.exports = {
  searchClinics,
  findNearby,
  getClinicById,
  registerClinic,
  getClinicByOwner,
  getDashboard,
  getSchedule,
  updateSchedule,
  updateClinic,
  getDoctors,
  addDoctor,
  removeDoctor,
  getAppointments,
  getConsultations,
  getClinicDoctorsPublic,
};
