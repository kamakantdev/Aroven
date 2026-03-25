/**
 * Consultation Service
 * Handles video consultations, prescriptions, and consultation history
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const eventEmitter = require('./eventEmitter');
const config = require('../config');

// Redis client for doctor AI rate limiting
let cacheIncr;
try {
  ({ cacheIncr } = require('../config/redis'));
} catch { cacheIncr = null; }

// MongoDB for doctor AI conversation memory + audit trail
let getDb;
try {
  ({ getDb } = require('../config/mongodb'));
} catch { getDb = null; }

// Get consultation history
const getConsultationHistory = async (userId, role, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin.from('consultations').select(
    '*, doctor:doctors(id, name, specialization, profile_image_url), patient:patients(id, name), appointment:appointments(id, appointment_date, time_slot, type), prescriptions(*, prescription_medicines(*))',
    { count: 'exact' }
  );

  if (role === 'patient') {
    const { data: patient } = await supabaseAdmin.from('patients').select('id').eq('user_id', userId).single();
    if (!patient) {
      // Fix #4: No patient record found — return empty instead of unfiltered query
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
    query = query.eq('patient_id', patient.id);
  } else if (role === 'doctor') {
    const { data: doctor } = await supabaseAdmin.from('doctors').select('id').eq('user_id', userId).single();
    if (!doctor) {
      // Fix #4: No doctor record found — return empty instead of unfiltered query
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
    query = query.eq('doctor_id', doctor.id);
  } else if (role === 'hospital_owner') {
    // Scope to doctors affiliated with the owner's hospital(s)
    const { data: hospitals } = await supabaseAdmin.from('hospitals').select('id').eq('owner_id', userId);
    const hospitalIds = (hospitals || []).map(h => h.id);
    if (hospitalIds.length > 0) {
      const { data: doctors } = await supabaseAdmin.from('doctors').select('id').in('hospital_id', hospitalIds);
      const doctorIds = (doctors || []).map(d => d.id);
      if (doctorIds.length > 0) {
        query = query.in('doctor_id', doctorIds);
      } else {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
    } else {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  } else if (role === 'clinic_owner') {
    // Scope to doctors affiliated with the owner's clinic(s)
    const { data: clinics } = await supabaseAdmin.from('clinics').select('id').eq('owner_id', userId);
    const clinicIds = (clinics || []).map(c => c.id);
    if (clinicIds.length > 0) {
      const { data: doctors } = await supabaseAdmin.from('doctors').select('id').in('clinic_id', clinicIds);
      const doctorIds = (doctors || []).map(d => d.id);
      if (doctorIds.length > 0) {
        query = query.in('doctor_id', doctorIds);
      } else {
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
    } else {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  } else if (role === 'admin') {
    // admin role can view all consultations (no filter)
  } else {
    // Unknown role — deny access to prevent data leak
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    pagination: {
      page, limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
};

// Start consultation (doctor) — C7 Fix: atomic via RPC
const startConsultation = async (doctorUserId, appointmentId) => {
  const { data: doctor } = await supabaseAdmin
    .from('doctors')
    .select('id')
    .eq('user_id', doctorUserId)
    .single();

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  // C7: Atomic start — creates consultation + updates appointment in one transaction
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('rpc_start_consultation', {
    p_appointment_id: appointmentId,
    p_doctor_id: doctor.id,
  });

  if (rpcError) throw rpcError;

  if (!rpcResult?.success) {
    const reasons = {
      appointment_not_found: 'Valid appointment not found',
    };
    throw new ApiError(404, reasons[rpcResult?.reason] || 'Failed to start consultation');
  }

  const consultation = rpcResult.consultation;

  // Get patient's user_id for notification
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('user_id')
    .eq('id', consultation.patient_id)
    .single();

  eventEmitter.emitConsultationStarted({
    ...consultation,
    doctor_id: doctorUserId,
    patient_id: patient?.user_id,
  });

  return consultation;
};

// Join consultation (patient)
// Supports both consultation ID and appointment ID (for Android app compatibility)
const joinConsultation = async (patientUserId, idParam) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', patientUserId)
    .single();

  // BUG-H1 Fix: Guard against null patient — prevents eq('patient_id', null) query
  if (!patient) {
    throw new ApiError(404, 'Patient profile not found. Please complete your profile first.');
  }

  // First try: lookup by consultation ID directly
  let { data: consultation, error } = await supabaseAdmin
    .from('consultations')
    .select('*')
    .eq('id', idParam)
    .eq('patient_id', patient.id)
    .eq('status', 'in_progress')
    .single();

  // Fallback: if not found, try lookup by appointment ID (Android sends appointmentId)
  if (!consultation) {
    const fallback = await supabaseAdmin
      .from('consultations')
      .select('*')
      .eq('appointment_id', idParam)
      .eq('patient_id', patient.id)
      .eq('status', 'in_progress')
      .single();

    consultation = fallback.data;
    error = fallback.error;
  }

  if (error || !consultation) {
    throw new ApiError(404, 'Active consultation not found');
  }

  return consultation;
};

// Get consultation by ID
const getConsultation = async (userId, role, consultationId) => {
  const { data: consultation, error } = await supabaseAdmin
    .from('consultations')
    .select('*, doctor:doctors(id, name, specialization, profile_image_url), patient:patients(id, name), appointment:appointments(*), prescriptions(*, prescription_medicines(*))')
    .eq('id', consultationId)
    .single();

  if (error || !consultation) {
    throw new ApiError(404, 'Consultation not found');
  }

  // Authorization: verify requesting user is the doctor or patient of this consultation
  if (role === 'doctor') {
    const { data: doctor } = await supabaseAdmin.from('doctors').select('id').eq('user_id', userId).single();
    if (!doctor || consultation.doctor_id !== doctor.id) {
      throw new ApiError(403, 'Unauthorized to view this consultation');
    }
  } else if (role === 'patient') {
    const { data: patient } = await supabaseAdmin.from('patients').select('id').eq('user_id', userId).single();
    if (!patient || consultation.patient_id !== patient.id) {
      throw new ApiError(403, 'Unauthorized to view this consultation');
    }
  } else if (role === 'hospital_owner') {
    // Scope: consultation's doctor must belong to one of the owner's hospitals
    const { data: hospitals } = await supabaseAdmin.from('hospitals').select('id').eq('owner_id', userId);
    const hospitalIds = (hospitals || []).map(h => h.id);
    const { data: doctor } = await supabaseAdmin.from('doctors').select('id').eq('id', consultation.doctor_id).in('hospital_id', hospitalIds).maybeSingle();
    if (!doctor) {
      throw new ApiError(403, 'Unauthorized to view this consultation');
    }
  } else if (role === 'clinic_owner') {
    // Scope: consultation's doctor must belong to one of the owner's clinics
    const { data: clinics } = await supabaseAdmin.from('clinics').select('id').eq('owner_id', userId);
    const clinicIds = (clinics || []).map(c => c.id);
    const { data: doctor } = await supabaseAdmin.from('doctors').select('id').eq('id', consultation.doctor_id).in('clinic_id', clinicIds).maybeSingle();
    if (!doctor) {
      throw new ApiError(403, 'Unauthorized to view this consultation');
    }
  }
  // admin role can view any consultation

  return consultation;
};

// End consultation (doctor) — C7 Fix: atomic via RPC
const endConsultation = async (doctorUserId, consultationId, data = {}) => {
  const { data: doctor } = await supabaseAdmin
    .from('doctors')
    .select('id')
    .eq('user_id', doctorUserId)
    .single();

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  // C7: Atomic end — updates consultation + appointment in one transaction
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('rpc_end_consultation', {
    p_consultation_id: consultationId,
    p_doctor_id: doctor.id,
    p_diagnosis: data.diagnosis || null,
    p_notes: data.notes || null,
    p_follow_up_date: data.followUpDate || null,
  });

  if (rpcError) throw rpcError;

  if (!rpcResult?.success) {
    throw new ApiError(404, 'Consultation not found or unauthorized');
  }

  const consultation = rpcResult.consultation;

  // Get patient user_id
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('user_id')
    .eq('id', consultation.patient_id)
    .single();

  eventEmitter.emitConsultationEnded({
    ...consultation,
    doctor_id: doctorUserId,
    patient_id: patient?.user_id,
  });

  return consultation;
};

// Leave consultation (patient) — signal the patient has left the video call
// Unlike endConsultation (doctor-only), this just emits a socket event and returns OK.
const leaveConsultation = async (patientUserId, consultationId) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', patientUserId)
    .single();

  if (!patient) {
    throw new ApiError(404, 'Patient profile not found');
  }

  // Verify patient is a participant
  const { data: consultation } = await supabaseAdmin
    .from('consultations')
    .select('id, doctor_id, patient_id, status')
    .eq('id', consultationId)
    .eq('patient_id', patient.id)
    .single();

  if (!consultation) {
    throw new ApiError(404, 'Consultation not found or unauthorized');
  }

  // Get doctor's user_id for notification
  const { data: doctor } = await supabaseAdmin
    .from('doctors')
    .select('user_id')
    .eq('id', consultation.doctor_id)
    .single();

  // Emit event so doctor's UI shows "Patient left the call"
  eventEmitter.emit('consultation:patient-left', {
    consultationId,
    patientUserId,
    doctorUserId: doctor?.user_id,
    timestamp: new Date().toISOString(),
  });

  return { message: 'Left consultation' };
};

const deriveReminderTimes = (frequency = '') => {
  const f = String(frequency || '').toLowerCase();

  // Try explicit times first: 08:00, 8:30 pm, etc.
  const explicit = [];
  const explicitRegex = /(\d{1,2}:\d{2}(?:\s*(?:am|pm))?)/gi;
  for (const match of f.matchAll(explicitRegex)) {
    explicit.push(match[1]);
  }
  if (explicit.length > 0) return explicit;

  const slots = [];
  if (f.includes('morning')) slots.push('08:00');
  if (f.includes('afternoon')) slots.push('14:00');
  if (f.includes('evening')) slots.push('19:00');
  if (f.includes('night') || f.includes('bedtime')) slots.push('22:00');
  if (slots.length > 0) return slots;

  if (f.includes('thrice') || f.includes('three times') || f.includes('3 times')) {
    return ['08:00', '14:00', '20:00'];
  }
  if (f.includes('twice') || f.includes('two times') || f.includes('2 times')) {
    return ['09:00', '21:00'];
  }
  return ['09:00'];
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateAndUploadPrescriptionPdfWithRetry = async ({
  prescription,
  doctor,
  patient,
  consultationPatientId,
  enrichedItems,
}) => {
  const maxAttempts = Math.max(1, Number(process.env.PRESCRIPTION_PDF_UPLOAD_RETRIES || 3));
  const baseDelayMs = Math.max(100, Number(process.env.PRESCRIPTION_PDF_UPLOAD_RETRY_DELAY_MS || 400));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { generatePrescriptionPdf } = require('../utils/prescriptionPdf');
      const { uploadBuffer } = require('../config/minio');

      const pdfBuffer = await generatePrescriptionPdf({
        ...prescription,
        doctor: { name: doctor.name, specialization: null },
        patient: { name: patient?.name, phone: patient?.phone },
        prescription_medicines: enrichedItems.map(item => ({
          medicine_name: item.medicineName,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          instructions: item.instructions,
          quantity: item.quantity,
          generic_name: item.generic_name || null,
          before_food: item.beforeFood || false,
          is_critical: item.isCritical || false,
        })),
      });

      if (!pdfBuffer) return null;

      const pdfObjectName = `prescriptions/${consultationPatientId}/${prescription.id}.pdf`;
      const uploadResult = await uploadBuffer(pdfObjectName, pdfBuffer, 'application/pdf');

      await supabaseAdmin
        .from('prescriptions')
        .update({ pdf_url: uploadResult.url, file_url: uploadResult.url })
        .eq('id', prescription.id);

      return uploadResult.url;
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw err;
      }
      const backoffMs = baseDelayMs * (2 ** (attempt - 1));
      await sleep(backoffMs);
    }
  }

  return null;
};

const createMedicineRemindersFromPrescription = async (patientId, prescriptionId, items = []) => {
  if (!patientId || !Array.isArray(items) || items.length === 0) return;

  const reminders = [];
  for (const item of items) {
    const times = deriveReminderTimes(item.frequency);
    for (const time of times) {
      reminders.push({
        patient_id: patientId,
        title: `${item.medicineName}${item.dosage ? ` (${item.dosage})` : ''}`,
        type: 'medicine',
        time,
        days: [],
        notes: item.instructions || `Prescription ${prescriptionId}`,
        is_active: true,
      });
    }
  }

  // Best-effort only (non-blocking)
  if (reminders.length > 0) {
    const { error } = await supabaseAdmin.from('reminders').insert(reminders);
    if (error) {
      console.warn('[ConsultationService] Reminder auto-create skipped:', error.message);
    }
  }
};

// Add prescription
const addPrescription = async (doctorUserId, consultationId, prescriptionData) => {
  const { data: doctor } = await supabaseAdmin
    .from('doctors')
    .select('id, name')
    .eq('user_id', doctorUserId)
    .single();

  // Verify consultation belongs to doctor AND is in valid status
  const { data: consultation } = await supabaseAdmin
    .from('consultations')
    .select('id, patient_id, status')
    .eq('id', consultationId)
    .eq('doctor_id', doctor?.id)
    .single();

  if (!consultation) {
    throw new ApiError(404, 'Consultation not found or unauthorized');
  }

  // Allow prescriptions only during active or recently completed consultations
  const allowedStatuses = ['in_progress', 'completed'];
  if (!allowedStatuses.includes(consultation.status)) {
    throw new ApiError(400, `Cannot add prescription to a ${consultation.status} consultation`);
  }

  // Prevent accidental duplicate writes (double-click/retry). Allow override when explicitly requested.
  if (!prescriptionData.allowMultiplePrescriptions) {
    const { data: existingPrescription, error: existingError } = await supabaseAdmin
      .from('prescriptions')
      .select('id, created_at, prescription_number')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingPrescription) {
      throw new ApiError(
        409,
        `Prescription already exists for this consultation (${existingPrescription.prescription_number || existingPrescription.id})`
      );
    }
  }

  // Fix #32: Generate a unique prescription number with crypto-secure randomness (8 chars)
  const crypto = require('crypto');
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  const prescriptionNumber = `RX-${datePart}-${randomPart}`;

  // Validate medicines against drug catalog (non-blocking — warns for unknown)
  let catalogWarnings = [];
  let enrichedItems = prescriptionData.items || [];
  try {
    const medicineService = require('./medicineService');
    const validation = await medicineService.validatePrescribedMedicines(enrichedItems);
    enrichedItems = validation.items;
    catalogWarnings = validation.warnings;
  } catch (valErr) {
    console.error('[ConsultationService] Drug catalog validation skipped:', valErr.message);
  }

  // Build medicines JSONB for backward compatibility
  const medicinesJson = enrichedItems.map(item => ({
    medicine_name: item.medicineName,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    instructions: item.instructions || null,
    quantity: item.quantity || null,
  }));

  // Create prescription
  const validFrom = new Date().toISOString().slice(0, 10);
  // Default validity: 30 days (configurable per prescription)
  const validityDays = prescriptionData.validityDays || 30;
  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + validityDays);
  const validUntil = validUntilDate.toISOString().slice(0, 10);

  const { data: prescription, error } = await supabaseAdmin
    .from('prescriptions')
    .insert({
      consultation_id: consultationId,
      doctor_id: doctor.id,
      patient_id: consultation.patient_id,
      diagnosis: prescriptionData.diagnosis,
      notes: prescriptionData.notes,
      prescription_number: prescriptionNumber,
      medicines: medicinesJson,
      valid_from: validFrom,
      valid_until: validUntil,
      dietary_advice: prescriptionData.dietaryAdvice || null,
      lifestyle_advice: prescriptionData.lifestyleAdvice || null,
      instructions: prescriptionData.instructions || null,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Add prescription medicines (with rollback on failure for atomicity)
  if (enrichedItems.length > 0) {
    const medicines = enrichedItems.map((item) => ({
      prescription_id: prescription.id,
      medicine_name: item.medicineName,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.instructions,
      quantity: item.quantity,
      generic_name: item.generic_name || null,
      before_food: item.beforeFood || false,
      is_critical: item.isCritical || false,
    }));

    const { error: medError } = await supabaseAdmin.from('prescription_medicines').insert(medicines);

    if (medError) {
      // Rollback: delete the orphaned prescription header
      await supabaseAdmin.from('prescriptions').delete().eq('id', prescription.id);
      throw medError;
    }
  }

  // Get patient user_id
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('user_id, name, phone')
    .eq('id', consultation.patient_id)
    .single();

  // Generate PDF (non-blocking — don't fail prescription creation if PDF fails)
  try {
    const pdfUrl = await generateAndUploadPrescriptionPdfWithRetry({
      prescription,
      doctor,
      patient,
      consultationPatientId: consultation.patient_id,
      enrichedItems,
    });
    if (pdfUrl) prescription.pdf_url = pdfUrl;
  } catch (pdfErr) {
    console.error('[ConsultationService] PDF generation failed (non-blocking):', pdfErr.message);
  }

  eventEmitter.emitPrescriptionCreated({
    ...prescription,
    patient_id: patient?.user_id,
  });

  // Persist notification so patient sees it even if offline
  if (patient?.user_id) {
    const { enqueueNotification } = require('./notificationQueueService');
    await enqueueNotification(patient.user_id, {
      title: '💊 New Prescription',
      message: `Dr. ${doctor.name} has written a prescription for you`,
      type: 'prescription_created',
      data: {
        prescriptionId: prescription.id,
        consultationId,
        doctorName: doctor.name,
        idempotencyKey: `prescription-created:${prescription.id}`,
      },
    });
  }

  // Auto-create medicine reminders in background so API response is not blocked by DB latency
  createMedicineRemindersFromPrescription(consultation.patient_id, prescription.id, enrichedItems)
    .catch((reminderErr) => {
      console.warn('[ConsultationService] Reminder auto-create failed (non-blocking):', reminderErr.message);
    });

  return { ...prescription, catalogWarnings };
};

// ==================== AI-ASSISTED CONSULTATION (via FastAPI) ====================

/**
 * Doctor-facing AI assistant during active consultation.
 * Proxies to the FastAPI AI microservice (swastik-ai-service).
 * Sends vitals context from the real-time pipeline for richer reasoning.
 */
const aiAssistDoctor = async (doctorUserId, consultationId, query, context = {}) => {
  const featureToggleService = require('./featureToggleService');

  // 1. Verify doctor owns this consultation
  const { data: doctor } = await supabaseAdmin
    .from('doctors')
    .select('id, user_id, name, specialization')
    .eq('user_id', doctorUserId)
    .single();

  if (!doctor) throw new ApiError(403, 'Doctor profile not found');

  const { data: consultation } = await supabaseAdmin
    .from('consultations')
    .select('id, status, diagnosis, notes, appointment_id, doctor_id, patient_id')
    .eq('id', consultationId)
    .eq('doctor_id', doctor.id)
    .single();

  if (!consultation) throw new ApiError(404, 'Consultation not found or unauthorized');

  if (consultation.status !== 'in_progress') {
    throw new ApiError(400, 'AI assistant is only available during active consultations');
  }

  // 2. Rate limit: 50 AI requests per doctor per day
  if (cacheIncr) {
    const rateLimitKey = `doctor_ai:${doctorUserId}:${new Date().toISOString().slice(0, 10)}`;
    const count = await cacheIncr(rateLimitKey, 86400);
    if (count !== null && count > 50) {
      throw new ApiError(429, 'Daily AI assistant limit reached (50/day). Resets at midnight.');
    }
  }

  // 3. Check if AI consultation assistant is enabled
  const toggles = await featureToggleService.getToggles(doctorUserId);
  if (!toggles.ai_consultation_assistant) {
    throw new ApiError(400, 'AI consultation assistant is disabled. Enable it in feature toggles.');
  }

  // 4. Vitals are now handled natively inside FastAPI WebSockets. We omit them here.
  let vitalsData = null;

  // 5. Get patient history
  let patientHistory = '';
  try {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('name, blood_group, allergies, chronic_conditions, emergency_contact')
      .eq('id', consultation.patient_id)
      .single();

    if (patient) {
      const parts = [];
      if (patient.blood_group) parts.push(`Blood Group: ${patient.blood_group}`);
      if (patient.allergies) parts.push(`Allergies: ${patient.allergies}`);
      if (patient.chronic_conditions) parts.push(`Chronic Conditions: ${patient.chronic_conditions}`);
      patientHistory = parts.join(', ') || 'No medical history on file';
    }
  } catch {}

  // 6. Call FastAPI AI service
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const axios = require('axios');

  const requestPayload = {
    consultation_id: consultationId,
    doctor_name: doctor.name,
    doctor_specialization: doctor.specialization || 'General Medicine',
    symptoms: (context.symptoms || '').slice(0, 500),
    vitals: vitalsData,
    history: patientHistory,
    diagnosis_notes: (consultation.diagnosis || '').slice(0, 500),
    query,
  };

  try {
    // Get the doctor's JWT token to forward to FastAPI
    const jwt = require('jsonwebtoken');
    const tempToken = jwt.sign(
      { userId: doctorUserId, id: doctorUserId, role: 'doctor' },
      config.jwt.accessSecret,
      { expiresIn: '1m' }
    );

    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/consult`, requestPayload, {
      headers: {
        'Authorization': `Bearer ${tempToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    if (response.data?.success) {
      return response.data.data;
    }

    throw new Error('FastAPI returned unsuccessful response');
  } catch (err) {
    console.error('[ConsultationService] FastAPI AI call failed:', err.message);

    // Fallback: Return a basic response with vitals alerts if FastAPI is down
    const vitalsAlerts = [];
    if (vitalsData) {
      if (vitalsData.heart_rate > 120) vitalsAlerts.push('Tachycardia detected');
      if (vitalsData.heart_rate && vitalsData.heart_rate < 50) vitalsAlerts.push('Bradycardia detected');
      if (vitalsData.spo2 && vitalsData.spo2 < 92) vitalsAlerts.push('Low SpO2');
      if (vitalsData.fall_detected) vitalsAlerts.push('Fall detected');
    }

    return {
      response: {
        answer: 'AI assistant is temporarily unavailable. Please try again in a moment.',
        alerts: vitalsAlerts,
        possible_conditions: [],
        suggested_questions: [],
        summary: '',
        clinical_notes: '',
        risk_indicators: vitalsAlerts,
        severity_assessment: vitalsAlerts.length > 0 ? 'warning' : 'mild',
        suggested_medications: [],
        differential_diagnoses: [],
        recommended_tests: [],
        vitals_interpretation: vitalsData ? `Live vitals: HR ${vitalsData.heart_rate || '-'} bpm, RR ${vitalsData.respiration_rate || '-'}/min` : 'No vitals',
      },
      provider: 'fallback',
      latencyMs: 0,
    };
  }
};

module.exports = {
  getConsultationHistory,
  startConsultation,
  joinConsultation,
  getConsultation,
  endConsultation,
  leaveConsultation,
  addPrescription,
  aiAssistDoctor,
};

