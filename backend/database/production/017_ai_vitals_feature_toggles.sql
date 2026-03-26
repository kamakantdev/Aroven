-- ============================================================
-- 017: AI Vitals & Feature Toggles (Telemedicine AI Pipeline)
-- Adds doctor_feature_toggles table for per-doctor AI settings
-- Safe to re-run (idempotent)
-- ============================================================

-- ── Doctor Feature Toggles ───────────────────────────────────
-- Stores per-doctor preferences for 12 CV health signals + AI features
CREATE TABLE IF NOT EXISTS doctor_feature_toggles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toggles JSONB NOT NULL DEFAULT '{
        "ai_vitals_monitoring": true,
        "heart_rate_rppg": true,
        "respiration_monitoring": true,
        "spo2_estimation": true,
        "stress_hrv": true,
        "drowsiness_detection": true,
        "pain_level_facs": true,
        "posture_analysis": true,
        "fall_detection": true,
        "tremor_detection": true,
        "skin_condition_screening": true,
        "facial_pallor_anemia": true,
        "facial_asymmetry_stroke": true,
        "blood_pressure_monitoring": true,
        "temperature_monitoring": true,
        "ai_consultation_assistant": true,
        "automated_consultation_notes": true,
        "risk_alerts": true
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_user_id)
);

-- Fast lookup index
CREATE INDEX IF NOT EXISTS idx_feature_toggles_doctor
    ON doctor_feature_toggles(doctor_user_id);

-- ── RLS Policies ─────────────────────────────────────────────
ALTER TABLE doctor_feature_toggles ENABLE ROW LEVEL SECURITY;

-- RLS: All access via service_role (backend handles auth via JWT)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Doctors can view own toggles" ON doctor_feature_toggles;
  DROP POLICY IF EXISTS "Doctors can update own toggles" ON doctor_feature_toggles;
  DROP POLICY IF EXISTS "Doctors can insert own toggles" ON doctor_feature_toggles;
  DROP POLICY IF EXISTS "Service role full access toggles" ON doctor_feature_toggles;
END $$;

CREATE POLICY "Service role full access toggles" ON doctor_feature_toggles
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Consultation Vitals Log (Supabase mirror for reporting) ──
CREATE TABLE IF NOT EXISTS consultation_vitals_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    doctor_id UUID REFERENCES doctors(id),
    signals_detected TEXT[] DEFAULT '{}',
    alerts_generated INTEGER DEFAULT 0,
    critical_alerts INTEGER DEFAULT 0,
    vitals_snapshot JSONB,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vitals_log_consultation
    ON consultation_vitals_log(consultation_id);
CREATE INDEX IF NOT EXISTS idx_vitals_log_patient
    ON consultation_vitals_log(patient_id);

ALTER TABLE consultation_vitals_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Doctors can view vitals logs" ON consultation_vitals_log;
  DROP POLICY IF EXISTS "Service role full access vitals log" ON consultation_vitals_log;
END $$;

CREATE POLICY "Service role full access vitals log" ON consultation_vitals_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

SELECT '✅ 017_ai_vitals_feature_toggles applied' AS status;
