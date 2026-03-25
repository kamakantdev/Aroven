const { supabaseAdmin } = require('../config/supabase');
const { uploadProfileImage, deleteFile } = require('../config/minio');
const { ApiError } = require('../middleware/errorHandler');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { sanitizeSearch } = require('../utils/sanitize');
const { cacheGet, cacheSet } = require('../config/redis');

class DoctorService {
  // Get doctor profile
  async getProfile(userId) {
    const { data: doctor, error } = await supabaseAdmin
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(email, phone, is_verified, created_at),
        hospital:hospitals(id, name, address, city)
      `)
      .eq('user_id', userId)
      .single();

    if (error || !doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    // Get stats
    const [
      { data: patientRows },
      { count: totalAppointments },
      { count: completedConsultations },
      { data: reviews }
    ] = await Promise.all([
      supabaseAdmin.from('appointments').select('patient_id').eq('doctor_id', doctor.id),
      supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('doctor_id', doctor.id),
      supabaseAdmin.from('consultations').select('*', { count: 'exact', head: true }).eq('doctor_id', doctor.id).eq('status', 'completed'),
      supabaseAdmin.from('doctor_reviews').select('*').eq('doctor_id', doctor.id).order('created_at', { ascending: false }).limit(5),
    ]);

    const uniquePatients = new Set((patientRows || []).map((r) => r.patient_id)).size;

    return {
      ...doctor,
      stats: {
        totalPatients: uniquePatients,
        totalAppointments: totalAppointments || 0,
        completedConsultations: completedConsultations || 0,
      },
      recentReviews: reviews || [],
    };
  }

  // Update doctor profile
  async updateProfile(userId, updateData) {
    const { data: doctor } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    // Partial update: only include fields that are explicitly provided (not undefined)
    // This prevents Web frontend from accidentally nulling out fields set by Android
    const updatePayload = { updated_at: new Date().toISOString() };
    if (updateData.name !== undefined) updatePayload.name = updateData.name;
    if (updateData.specialization !== undefined) updatePayload.specialization = updateData.specialization;
    if (updateData.experience !== undefined || updateData.experienceYears !== undefined) {
      updatePayload.experience_years = updateData.experience || updateData.experienceYears;
    }
    if (updateData.qualifications !== undefined) updatePayload.qualifications = updateData.qualifications;
    if (updateData.registrationNo !== undefined) updatePayload.registration_number = updateData.registrationNo;
    if (updateData.consultationFee !== undefined) updatePayload.consultation_fee = updateData.consultationFee;
    if (updateData.bio !== undefined) updatePayload.bio = updateData.bio;
    if (updateData.languages !== undefined) updatePayload.languages = updateData.languages;
    if (updateData.hospitalId !== undefined) updatePayload.hospital_id = updateData.hospitalId;

    const { data: updatedDoctor, error } = await supabaseAdmin
      .from('doctors')
      .update(updatePayload)
      .eq('id', doctor.id)
      .select()
      .single();

    if (error) {
      throw new ApiError(400, 'Failed to update profile');
    }

    return updatedDoctor;
  }

  // Get doctor dashboard
  async getDashboard(userId) {
    const cacheKey = `doctor:dashboard:${userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { data: doctor } = await supabaseAdmin
      .from('doctors')
      .select('id, name, specialization, is_available, consultation_fee')
      .eq('user_id', userId)
      .single();

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    const today = new Date().toISOString().split('T')[0];

    // Fix #40: Run all dashboard queries in parallel instead of sequentially
    const [
      todayApptsResult,
      upcomingApptsResult,
      pendingApptsResult,
      recentConsultResult,
      totalPatientsResult,
      completedTodayResult,
      completedTodayApptsResult,
    ] = await Promise.all([
      supabaseAdmin.from('appointments')
        .select('*, patient:patients(id, name, age, gender, profile_image_url)')
        .eq('doctor_id', doctor.id).eq('appointment_date', today)
        .in('status', ['scheduled', 'confirmed', 'in_progress'])
        .order('time_slot', { ascending: true }),
      supabaseAdmin.from('appointments')
        .select('*, patient:patients(id, name, age, gender)')
        .eq('doctor_id', doctor.id).gt('appointment_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('appointment_date', { ascending: true }).limit(10),
      supabaseAdmin.from('appointments')
        .select('*', { count: 'exact' })
        .eq('doctor_id', doctor.id).eq('status', 'scheduled')
        .gte('appointment_date', today),
      supabaseAdmin.from('consultations')
        .select('*, patient:patients(id, name), appointment:appointments(type)')
        .eq('doctor_id', doctor.id)
        .order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', doctor.id).eq('appointment_date', today),
      supabaseAdmin.from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', doctor.id).eq('appointment_date', today)
        .eq('status', 'completed'),
      supabaseAdmin.from('appointments')
        .select('id, fee')
        .eq('doctor_id', doctor.id).eq('appointment_date', today)
        .eq('status', 'completed'),
    ]);

    const todayAppointments = todayApptsResult.data || [];
    const upcomingAppointments = upcomingApptsResult.data || [];
    const pendingCount = pendingApptsResult.count || 0;
    const recentConsultations = recentConsultResult.data || [];
    const totalPatientsToday = totalPatientsResult.count || 0;
    const completedToday = completedTodayResult.count || 0;
    const completedTodayAppts = completedTodayApptsResult.data || [];

    const totalEarningsToday = completedTodayAppts.reduce((sum, a) => sum + (a.fee || doctor.consultation_fee || 0), 0);

    const dashboard = {
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialization: doctor.specialization,
        isAvailable: doctor.is_available,
      },
      todayAppointments,
      upcomingAppointments,
      pendingCount,
      recentConsultations,
      stats: {
        totalPatientsToday,
        completedToday,
        earningsToday: totalEarningsToday,
      },
    };

    try { await cacheSet(cacheKey, dashboard, 30); } catch (_) { /* non-fatal */ }

    return dashboard;
  }

  // Get all doctors (for patient search)
  async getAllDoctors(filters = {}, page = 1, limit = 10) {
    const { offset } = paginate(page, limit);
    let clinicDoctorIds = null;

    if (filters.clinicId) {
      const { data: clinicLinks, error: clinicError } = await supabaseAdmin
        .from('clinic_doctors')
        .select('doctor_id')
        .eq('clinic_id', filters.clinicId)
        .eq('is_active', true);

      if (clinicError) {
        throw new ApiError(400, 'Failed to fetch clinic doctors');
      }

      clinicDoctorIds = (clinicLinks || []).map(link => link.doctor_id).filter(Boolean);
      if (clinicDoctorIds.length === 0) {
        return paginatedResponse([], 0, page, limit);
      }
    }

    let query = supabaseAdmin
      .from('doctors')
      .select(`
        id, name, specialization, experience_years, rating, total_reviews,
        consultation_fee, profile_image_url, languages, is_available,
        hospital:hospitals(id, name, city)
      `, { count: 'exact' })
      .eq('is_approved', true);

    if (filters.specialization) {
      query = query.eq('specialization', filters.specialization);
    }

    if (filters.hospitalId) {
      query = query.eq('hospital_id', filters.hospitalId);
    }
    if (clinicDoctorIds) {
      query = query.in('id', clinicDoctorIds);
    }

    if (filters.isAvailable !== undefined) {
      query = query.eq('is_available', filters.isAvailable);
    }

    if (filters.minRating) {
      query = query.gte('rating', filters.minRating);
    }

    if (filters.maxFee) {
      query = query.lte('consultation_fee', filters.maxFee);
    }

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s) query = query.or(`name.ilike.%${s}%,specialization.ilike.%${s}%`);
    }

    const { data: doctors, count, error } = await query
      .order('rating', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ApiError(400, 'Failed to fetch doctors');
    }

    return paginatedResponse(doctors, count, page, limit);
  }

  // Get doctor by ID
  async getDoctorById(doctorId) {
    const { data: doctor, error } = await supabaseAdmin
      .from('doctors')
      .select(`
        *,
        hospital:hospitals(id, name, address, city, phone)
      `)
      .eq('id', doctorId)
      .eq('is_approved', true)
      .single();

    if (error || !doctor) {
      throw new ApiError(404, 'Doctor not found');
    }

    // Get available slots
    const { data: slots } = await supabaseAdmin
      .from('doctor_slots')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true);

    // Get reviews
    const { data: reviews } = await supabaseAdmin
      .from('doctor_reviews')
      .select(`
        *,
        patient:patients(name)
      `)
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      ...doctor,
      slots: slots || [],
      reviews: reviews || [],
    };
  }

  // Get specialties
  async getSpecialties() {
    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('specialization')
      .eq('is_approved', true);

    if (error) {
      throw new ApiError(400, 'Failed to fetch specialties');
    }

    // Get unique specializations with count
    const specialtyMap = {};
    data.forEach(d => {
      if (d.specialization) {
        specialtyMap[d.specialization] = (specialtyMap[d.specialization] || 0) + 1;
      }
    });

    const specialties = Object.entries(specialtyMap).map(([name, count]) => ({
      name,
      doctorCount: count,
    }));

    return specialties.sort((a, b) => b.doctorCount - a.doctorCount);
  }

  // Get doctor's available slots for a specific date
  async getAvailableSlots(doctorId, date) {
    // Get doctor's slot configuration
    const { data: slotConfig } = await supabaseAdmin
      .from('doctor_slots')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .eq('day_of_week', new Date(date).getDay());

    if (!slotConfig || slotConfig.length === 0) {
      return [];
    }

    // Get booked appointments for the date
    const { data: bookedAppointments } = await supabaseAdmin
      .from('appointments')
      .select('time_slot')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .in('status', ['scheduled', 'confirmed', 'in_progress']);

    const bookedSlots = bookedAppointments?.map(a => a.time_slot) || [];

    // Generate available time slots
    const availableSlots = [];
    slotConfig.forEach(config => {
      const start = parseInt(config.start_time.split(':')[0]);
      const end = parseInt(config.end_time.split(':')[0]);

      for (let hour = start; hour < end; hour++) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        if (!bookedSlots.includes(timeSlot)) {
          availableSlots.push({
            time: timeSlot,
            period: hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening',
            is_available: true,
          });
        }
      }
    });

    return availableSlots;
  }

  // Update availability
  async updateAvailability(userId, isAvailable) {
    const { data: doctor } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    const { error } = await supabaseAdmin
      .from('doctors')
      .update({ is_available: isAvailable })
      .eq('id', doctor.id);

    if (error) {
      throw new ApiError(400, 'Failed to update availability');
    }

    return { isAvailable };
  }

  // Manage slots — M2 Fix: atomic replacement via RPC
  async updateSlots(userId, slots) {
    const { data: doctor } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    // M2: Atomic delete + insert via Supabase RPC (single transaction)
    const slotsJson = slots.map(slot => ({
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
    }));

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('rpc_replace_doctor_slots', {
      p_doctor_id: doctor.id,
      p_slots: slotsJson,
    });

    if (rpcError) {
      // Backward-compatible fallback for environments where RPC is missing/outdated
      const { error: deleteError } = await supabaseAdmin
        .from('doctor_slots')
        .delete()
        .eq('doctor_id', doctor.id);

      if (deleteError) {
        throw new ApiError(400, 'Failed to update slots');
      }

      const fallbackRows = slots.map((slot) => ({
        doctor_id: doctor.id,
        day_of_week: slot.dayOfWeek,
        start_time: slot.startTime,
        end_time: slot.endTime,
        slot_duration: slot.slotDuration || 15,
        is_video_enabled: slot.isVideoEnabled ?? true,
        is_clinic_enabled: slot.isClinicEnabled ?? true,
        is_active: true,
      }));

      const { error: insertFallbackError } = await supabaseAdmin
        .from('doctor_slots')
        .insert(fallbackRows);

      if (insertFallbackError) {
        throw new ApiError(400, 'Failed to update slots');
      }
    }

    // Fetch the newly inserted slots to return
    const { data: newSlots, error: fetchError } = await supabaseAdmin
      .from('doctor_slots')
      .select('*')
      .eq('doctor_id', doctor.id)
      .order('day_of_week', { ascending: true });

    if (fetchError) {
      throw new ApiError(400, 'Failed to fetch updated slots');
    }

    return newSlots;
  }

  // Get patients list (for doctor)
  async getPatients(userId, page = 1, limit = 20) {
    const { data: doctor } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    const { offset } = paginate(page, limit);

    // Get unique patients who have had appointments
    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select(`
        patient:patients(
          id, name, age, gender, blood_group, profile_image_url,
          user:users(phone)
        )
      `)
      .eq('doctor_id', doctor.id)
      .order('created_at', { ascending: false });

    // Get unique patients
    const patientMap = new Map();
    appointments?.forEach(apt => {
      if (apt.patient && !patientMap.has(apt.patient.id)) {
        patientMap.set(apt.patient.id, apt.patient);
      }
    });

    const patients = Array.from(patientMap.values());
    const paginatedPatients = patients.slice(offset, offset + limit);

    return paginatedResponse(paginatedPatients, patients.length, page, limit);
  }

  // Get patient details (for doctor)
  async getPatientDetails(userId, patientId) {
    const { data: doctor } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!doctor) {
      throw new ApiError(404, 'Doctor profile not found');
    }

    // Check if doctor has treated this patient
    const { data: hasAppointment } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctor.id)
      .eq('patient_id', patientId)
      .limit(1)
      .single();

    if (!hasAppointment) {
      throw new ApiError(403, 'You can only view details of your patients');
    }

    // Get patient details
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select(`
        *,
        user:users(email, phone)
      `)
      .eq('id', patientId)
      .single();

    // Get consultation history with this doctor
    const { data: consultations } = await supabaseAdmin
      .from('consultations')
      .select(`
        *,
        prescriptions(*)
      `)
      .eq('doctor_id', doctor.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    // Get reports
    const { data: reports } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false })
      .limit(10);

    return {
      ...patient,
      consultations: consultations || [],
      reports: reports || [],
    };
  }
}

module.exports = new DoctorService();
