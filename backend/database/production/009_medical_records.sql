-- ============================================================
-- 009: MEDICAL RECORDS & REPORTS
-- Patient medical reports
-- ============================================================

-- 9.1 Medical Reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN (
        'blood_test', 'urine_test', 'x_ray', 'mri', 'ct_scan',
        'ecg', 'ultrasound', 'other'
    )),
    lab_name TEXT,
    test_date DATE,
    result_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'normal', 'abnormal', 'critical'
    )),
    doctor_notes TEXT,
    file_url TEXT,
    file_size TEXT,
    parameters JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9.2 Report Shares (track which doctors have access to patient reports)
CREATE TABLE IF NOT EXISTS report_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE (report_id, doctor_id)
);
