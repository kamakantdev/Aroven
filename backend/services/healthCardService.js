/**
 * Health Card Service — QR-Based Portable Medical Records
 *
 * Allows patients to generate a secure, time-limited token that encodes
 * a URL. When a doctor (registered or external) scans the QR / opens the URL,
 * they see the patient's complete medical profile without needing to log in.
 *
 * Security model:
 *   - Token stored in Redis with 24h TTL
 *   - Patient can revoke at any time
 *   - Each generation invalidates previous tokens
 *   - Public endpoint requires only the token (no auth)
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { ApiError } = require('../middleware/errorHandler');
const config = require('../config');

const HEALTH_CARD_PREFIX = 'health_card:';
const HEALTH_CARD_REVERSE = 'health_card_user:'; // maps userId → token for revocation
const TOKEN_EXPIRY_SECONDS = 86400; // 24 hours

class HealthCardService {
  /**
   * Generate (or regenerate) a health card token for a patient.
   * Invalidates any existing token for this user.
   */
  async generateToken(userId) {
    // Verify user is a patient
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, name, user_id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    // Revoke any existing token
    const existingToken = await cacheGet(`${HEALTH_CARD_REVERSE}${userId}`);
    if (existingToken) {
      await cacheDel(`${HEALTH_CARD_PREFIX}${existingToken}`);
    }

    // Generate a cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Store: token → userId mapping (for public lookup)
    await cacheSet(`${HEALTH_CARD_PREFIX}${token}`, {
      userId,
      patientId: patient.id,
      patientName: patient.name,
      generatedAt: new Date().toISOString(),
    }, TOKEN_EXPIRY_SECONDS);

    // Store: userId → token mapping (for revocation)
    await cacheSet(`${HEALTH_CARD_REVERSE}${userId}`, token, TOKEN_EXPIRY_SECONDS);

    return {
      token,
      url: `${config.frontendWebUrl}/health-card/${token}`,
      expires_at: new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000).toISOString(),
      expires_in_hours: 24,
    };
  }

  /**
   * Revoke the current health card token.
   */
  async revokeToken(userId) {
    const existingToken = await cacheGet(`${HEALTH_CARD_REVERSE}${userId}`);
    if (existingToken) {
      await cacheDel(`${HEALTH_CARD_PREFIX}${existingToken}`);
      await cacheDel(`${HEALTH_CARD_REVERSE}${userId}`);
    }
    return { revoked: true };
  }

  /**
   * Get the current active token status for a patient (used by the app).
   */
  async getTokenStatus(userId) {
    const token = await cacheGet(`${HEALTH_CARD_REVERSE}${userId}`);
    if (!token) {
      return { has_active_card: false, url: null, generated_at: null, expires_at: null };
    }

    // Verify the token data still exists (hasn't expired from Redis)
    const data = await cacheGet(`${HEALTH_CARD_PREFIX}${token}`);
    if (!data) {
      // Token expired, clean up reverse mapping
      await cacheDel(`${HEALTH_CARD_REVERSE}${userId}`);
      return { has_active_card: false, url: null, generated_at: null, expires_at: null };
    }

    return {
      has_active_card: true,
      url: `${config.frontendWebUrl}/health-card/${token}`,
      generated_at: data.generatedAt,
      expires_at: null, // Redis doesn't expose exact TTL easily; UI shows "24h from generation"
    };
  }

  /**
   * PUBLIC: Fetch complete health record by token.
   * No authentication required — the token IS the authorization.
   * @param {string} token
   * @param {object} accessInfo - IP address, user-agent for audit logging
   */
  async getHealthRecord(token, accessInfo = {}) {
    const tokenData = await cacheGet(`${HEALTH_CARD_PREFIX}${token}`);

    if (!tokenData) {
      throw new ApiError(404, 'Health card not found or expired. Please ask the patient to generate a new QR code.');
    }

    const { patientId, userId } = tokenData;

    // Audit log: record who accessed this health card
    try {
      const { logAudit } = require('../utils/auditLogger');
      logAudit({
        userId: 'anonymous',
        userRole: 'public',
        action: 'health_card.accessed',
        entityType: 'health_card',
        entityId: patientId,
        details: {
          ip: accessInfo.ip || 'unknown',
          userAgent: accessInfo.userAgent || 'unknown',
          accessedAt: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      // Non-blocking — don’t fail the request if audit logging fails
      console.warn('Health card audit log failed:', auditErr.message);
    }

    // Fetch all data in parallel for speed
    const [
      patientResult,
      prescriptionsResult,
      reportsResult,
      vitalsResult,
      consultationsResult,
      emergencyContactsResult,
      familyMembersResult,
    ] = await Promise.all([
      // 1. Patient profile
      supabaseAdmin
        .from('patients')
        .select(`
          id, name, date_of_birth, gender, blood_group,
          weight, height, address, city, state, abha_number,
          medical_conditions, allergies, chronic_conditions,
          current_medications, medical_history,
          insurance_provider, insurance_id,
          user:users(email, phone)
        `)
        .eq('id', patientId)
        .single(),

      // 2. Prescriptions (last 20)
      supabaseAdmin
        .from('prescriptions')
        .select(`
          id, notes, is_active, created_at,
          doctor:doctors(id, name, specialization),
          consultation:consultations(id, chief_complaint, notes),
          prescription_medicines(id, medicine_name, dosage, frequency, duration, instructions, quantity)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(20),

      // 3. Reports (last 20)
      supabaseAdmin
        .from('reports')
        .select(`
          id, name, type, lab_name, test_date, result_date,
          status, doctor_notes, file_url, file_size, parameters
        `)
        .eq('patient_id', patientId)
        .order('report_date', { ascending: false })
        .limit(20),

      // 4. Vitals (last 30 entries)
      supabaseAdmin
        .from('patient_vitals')
        .select(`
          id, heart_rate, blood_pressure_systolic, blood_pressure_diastolic,
          temperature, oxygen_level, respiratory_rate, weight, height,
          blood_sugar, notes, recorded_at
        `)
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
        .limit(30),

      // 5. Consultations (last 15)
      supabaseAdmin
        .from('consultations')
        .select(`
          id, chief_complaint, notes, diagnosis, advice,
          diagnosis_codes, follow_up_required, follow_up_date,
          status, started_at, ended_at,
          doctor:doctors(id, name, specialization)
        `)
        .eq('patient_id', patientId)
        .in('status', ['completed', 'in_progress'])
        .order('started_at', { ascending: false })
        .limit(15),

      // 6. Emergency contacts
      supabaseAdmin
        .from('emergency_contacts')
        .select('id, name, phone, relationship')
        .eq('patient_id', patientId),

      // 7. Family members
      supabaseAdmin
        .from('family_members')
        .select('id, name, relationship, date_of_birth, gender, blood_group')
        .eq('patient_id', patientId),
    ]);

    const patient = patientResult.data;
    if (!patient) {
      throw new ApiError(404, 'Patient record not found');
    }

    // Compute age from date_of_birth
    const dob = patient.date_of_birth ? new Date(patient.date_of_birth) : null;
    const computedAge = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    return {
      patient: {
        name: patient.name,
        age: computedAge,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        bloodGroup: patient.blood_group,
        weight: patient.weight,
        height: patient.height,
        address: [patient.address, patient.city, patient.state].filter(Boolean).join(', ') || null,
        abhaNumber: patient.abha_number,
        phone: patient.user?.phone,
        email: patient.user?.email,
        // Critical medical info
        allergies: patient.allergies || [],
        medicalConditions: patient.medical_conditions || [],
        chronicConditions: patient.chronic_conditions || [],
        currentMedications: patient.current_medications || [],
        medicalHistory: patient.medical_history || [],
        // Fix #36: Redact insurance details — PHI not needed for clinical viewing
        insuranceProvider: patient.insurance_provider ? 'On file' : null,
      },
      prescriptions: (prescriptionsResult.data || []).map(rx => ({
        id: rx.id,
        notes: rx.notes,
        isActive: rx.is_active,
        createdAt: rx.created_at,
        medications: rx.prescription_medicines || [],
        doctor: rx.doctor ? { name: rx.doctor.name, specialization: rx.doctor.specialization } : null,
        chiefComplaint: rx.consultation?.chief_complaint,
        consultationNotes: rx.consultation?.notes,
      })),
      reports: (reportsResult.data || []).map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        labName: r.lab_name,
        testDate: r.test_date,
        resultDate: r.result_date,
        status: r.status,
        doctorNotes: r.doctor_notes,
        // Fix #36: Do NOT expose file_url in public health card — prevents unauthenticated file access
        parameters: r.parameters,
      })),
      vitals: (vitalsResult.data || []).map(v => ({
        heartRate: v.heart_rate,
        bpSystolic: v.blood_pressure_systolic,
        bpDiastolic: v.blood_pressure_diastolic,
        temperature: v.temperature,
        oxygenLevel: v.oxygen_level,
        respiratoryRate: v.respiratory_rate,
        weight: v.weight,
        height: v.height,
        bloodSugar: v.blood_sugar,
        notes: v.notes,
        recordedAt: v.recorded_at,
      })),
      consultations: (consultationsResult.data || []).map(c => ({
        id: c.id,
        chiefComplaint: c.chief_complaint,
        notes: c.notes,
        diagnosis: c.diagnosis,
        advice: c.advice,
        diagnosisCodes: c.diagnosis_codes,
        followUpRequired: c.follow_up_required,
        followUpDate: c.follow_up_date,
        status: c.status,
        date: c.started_at,
        doctor: c.doctor ? { name: c.doctor.name, specialization: c.doctor.specialization } : null,
      })),
      emergencyContacts: emergencyContactsResult.data || [],
      familyMembers: familyMembersResult.data || [],
      generatedAt: tokenData.generatedAt,
    };
  }
}

module.exports = new HealthCardService();
