/**
 * Feature Toggle Service
 * Manages doctor-level AI feature toggles for consultations.
 * Stored in Supabase (persistent) + cached in Redis (fast reads).
 *
 * When a doctor disables a feature, the vitals pipeline skips
 * that signal and the AI assistant omits it from context.
 */
const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');

// 12 CV Health Signals + AI feature toggles (matches database schema)
const DEFAULT_TOGGLES = {
  ai_vitals_monitoring: true,
  // Signal 1: Heart Rate (rPPG)
  heart_rate_rppg: true,
  // Signal 2: Respiration Rate (chest motion)
  respiration_monitoring: true,
  // Signal 3: SpO2 (experimental rPPG variant)
  spo2_estimation: true,
  // Signal 4: Stress / HRV
  stress_hrv: true,
  // Signal 5: Drowsiness / Fatigue (EAR)
  drowsiness_detection: true,
  // Signal 6: Pain Level (Facial Action Units / FACS)
  pain_level_facs: true,
  // Signal 7: Abnormal Posture
  posture_analysis: true,
  // Signal 8: Fall Detection
  fall_detection: true,
  // Signal 9: Tremor Detection (Parkinson screening)
  tremor_detection: true,
  // Signal 10: Skin Condition Screening (CNN)
  skin_condition_screening: true,
  // Signal 11: Facial Pallor / Anemia Indicator
  facial_pallor_anemia: true,
  // Signal 12: Facial Asymmetry (Stroke Warning)
  facial_asymmetry_stroke: true,
  // Additional vitals (manual or device-reported)
  blood_pressure_monitoring: true,
  temperature_monitoring: true,
  // AI features
  ai_consultation_assistant: true,
  automated_consultation_notes: true,
  risk_alerts: true,
};

const REDIS_KEY = (doctorUserId) => `feature_toggles:${doctorUserId}`;
const CACHE_TTL = 600; // 10 minutes

/**
 * Get feature toggles for a doctor.
 * Priority: Redis cache → Supabase → defaults
 */
const getToggles = async (doctorUserId) => {
  // 1. Try Redis cache
  const cached = await cacheGet(REDIS_KEY(doctorUserId));
  if (cached && typeof cached === 'object') {
    return { ...DEFAULT_TOGGLES, ...cached };
  }

  // 2. Try Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from('doctor_feature_toggles')
      .select('toggles')
      .eq('doctor_user_id', doctorUserId)
      .single();

    if (!error && data?.toggles) {
      const toggles = { ...DEFAULT_TOGGLES, ...data.toggles };
      await cacheSet(REDIS_KEY(doctorUserId), toggles, CACHE_TTL);
      return toggles;
    }
  } catch (err) {
    console.warn('[FeatureToggle] Supabase read failed:', err.message);
  }

  // 3. Return defaults
  return { ...DEFAULT_TOGGLES };
};

/**
 * Update feature toggles for a doctor.
 */
const updateToggles = async (doctorUserId, updates) => {
  // Validate: only allow known toggle keys
  const validKeys = Object.keys(DEFAULT_TOGGLES);
  const sanitized = {};

  for (const [key, value] of Object.entries(updates)) {
    if (validKeys.includes(key) && typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw new Error('No valid toggle updates provided');
  }

  // Get current toggles and merge
  const current = await getToggles(doctorUserId);
  const merged = { ...current, ...sanitized };

  // Upsert to Supabase
  const { error } = await supabaseAdmin
    .from('doctor_feature_toggles')
    .upsert({
      doctor_user_id: doctorUserId,
      toggles: merged,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'doctor_user_id',
    });

  if (error) {
    console.error('[FeatureToggle] Supabase upsert failed:', error.message);
    // Still update cache even if DB fails
  }

  // Update Redis cache
  await cacheSet(REDIS_KEY(doctorUserId), merged, CACHE_TTL);

  return merged;
};

/**
 * Check if a specific feature is enabled for a doctor.
 */
const isFeatureEnabled = async (doctorUserId, featureKey) => {
  const toggles = await getToggles(doctorUserId);
  return toggles[featureKey] !== false;
};

/**
 * Filter vitals data based on doctor's toggles.
 * Returns only the vitals the doctor wants to see.
 */
const filterVitalsByToggles = async (doctorUserId, vitalsData) => {
  const toggles = await getToggles(doctorUserId);

  if (!toggles.ai_vitals_monitoring) {
    return null; // All vitals monitoring disabled
  }

  const filtered = { session_id: vitalsData.session_id };

  // Signal 1: Heart Rate (rPPG)
  if (toggles.heart_rate_rppg && vitalsData.heart_rate !== undefined) {
    filtered.heart_rate = vitalsData.heart_rate;
  }
  // Signal 2: Respiration Rate
  if (toggles.respiration_monitoring && vitalsData.respiration_rate !== undefined) {
    filtered.respiration_rate = vitalsData.respiration_rate;
  }
  // Signal 3: SpO2
  if (toggles.spo2_estimation && vitalsData.spo2 !== undefined) {
    filtered.spo2 = vitalsData.spo2;
  }
  // Signal 4: Stress / HRV
  if (toggles.stress_hrv && vitalsData.stress_level !== undefined) {
    filtered.stress_level = vitalsData.stress_level;
    if (vitalsData.hrv_rmssd !== undefined) filtered.hrv_rmssd = vitalsData.hrv_rmssd;
    if (vitalsData.hrv_sdnn !== undefined) filtered.hrv_sdnn = vitalsData.hrv_sdnn;
  }
  // Signal 5: Drowsiness / Fatigue
  if (toggles.drowsiness_detection && vitalsData.drowsiness_score !== undefined) {
    filtered.drowsiness_score = vitalsData.drowsiness_score;
  }
  // Signal 6: Pain Level (FACS)
  if (toggles.pain_level_facs && vitalsData.pain_score !== undefined) {
    filtered.pain_score = vitalsData.pain_score;
    if (vitalsData.pain_action_units !== undefined) filtered.pain_action_units = vitalsData.pain_action_units;
  }
  // Signal 7: Posture Analysis
  if (toggles.posture_analysis && vitalsData.posture !== undefined) {
    filtered.posture = vitalsData.posture;
    if (vitalsData.spine_angle !== undefined) filtered.spine_angle = vitalsData.spine_angle;
  }
  // Signal 8: Fall Detection
  if (toggles.fall_detection && vitalsData.fall_detected !== undefined) {
    filtered.fall_detected = vitalsData.fall_detected;
  }
  // Signal 9: Tremor Detection
  if (toggles.tremor_detection) {
    if (vitalsData.tremor_detected !== undefined) filtered.tremor_detected = vitalsData.tremor_detected;
    if (vitalsData.tremor_severity !== undefined) filtered.tremor_severity = vitalsData.tremor_severity;
    if (vitalsData.tremor_frequency !== undefined) filtered.tremor_frequency = vitalsData.tremor_frequency;
  }
  // Signal 10: Skin Condition
  if (toggles.skin_condition_screening && vitalsData.skin_condition !== undefined) {
    filtered.skin_condition = vitalsData.skin_condition;
    if (vitalsData.skin_classification !== undefined) filtered.skin_classification = vitalsData.skin_classification;
  }
  // Signal 11: Facial Pallor / Anemia
  if (toggles.facial_pallor_anemia && vitalsData.pallor_score !== undefined) {
    filtered.pallor_score = vitalsData.pallor_score;
    if (vitalsData.hemoglobin_estimate !== undefined) filtered.hemoglobin_estimate = vitalsData.hemoglobin_estimate;
  }
  // Signal 12: Facial Asymmetry / Stroke
  if (toggles.facial_asymmetry_stroke && vitalsData.facial_asymmetry_score !== undefined) {
    filtered.facial_asymmetry_score = vitalsData.facial_asymmetry_score;
  }
  // Additional vitals
  if (toggles.temperature_monitoring && vitalsData.temperature !== undefined) {
    filtered.temperature = vitalsData.temperature;
  }
  if (toggles.blood_pressure_monitoring) {
    if (vitalsData.blood_pressure_systolic !== undefined) filtered.blood_pressure_systolic = vitalsData.blood_pressure_systolic;
    if (vitalsData.blood_pressure_diastolic !== undefined) filtered.blood_pressure_diastolic = vitalsData.blood_pressure_diastolic;
  }

  // Always include metadata
  filtered.processed_at = vitalsData.processed_at;
  filtered.patient_user_id = vitalsData.patient_user_id;

  // Filter alerts based on toggles
  if (toggles.risk_alerts && vitalsData.alerts) {
    filtered.alerts = vitalsData.alerts.filter(alert => {
      const v = alert.vital;
      if (v === 'heart_rate') return toggles.heart_rate_rppg;
      if (v === 'respiration_rate') return toggles.respiration_monitoring;
      if (v === 'spo2') return toggles.spo2_estimation;
      if (v === 'stress') return toggles.stress_hrv;
      if (v === 'drowsiness_score') return toggles.drowsiness_detection;
      if (v === 'pain_score') return toggles.pain_level_facs;
      if (v === 'posture') return toggles.posture_analysis;
      if (v === 'fall_detected') return toggles.fall_detection;
      if (v === 'tremor') return toggles.tremor_detection;
      if (v === 'skin_condition') return toggles.skin_condition_screening;
      if (v === 'pallor') return toggles.facial_pallor_anemia;
      if (v === 'facial_asymmetry') return toggles.facial_asymmetry_stroke;
      if (v === 'temperature') return toggles.temperature_monitoring;
      return true;
    });
  } else {
    filtered.alerts = [];
  }

  return filtered;
};

/**
 * Reset toggles to defaults for a doctor.
 */
const resetToggles = async (doctorUserId) => {
  await cacheDel(REDIS_KEY(doctorUserId));

  await supabaseAdmin
    .from('doctor_feature_toggles')
    .upsert({
      doctor_user_id: doctorUserId,
      toggles: DEFAULT_TOGGLES,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'doctor_user_id',
    });

  return { ...DEFAULT_TOGGLES };
};

module.exports = {
  DEFAULT_TOGGLES,
  getToggles,
  updateToggles,
  isFeatureEnabled,
  filterVitalsByToggles,
  resetToggles,
};
