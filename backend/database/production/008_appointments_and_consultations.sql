-- ============================================================
-- 008: APPOINTMENTS & CONSULTATIONS
-- Appointments, video consultations, vitals, prescriptions, payments
-- ============================================================

-- 8.1 Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_number TEXT UNIQUE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id),
    clinic_id UUID REFERENCES clinics(id),
    appointment_date DATE NOT NULL,
    time_slot TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    type TEXT DEFAULT 'video' CHECK (type IN (
        'video', 'clinic', 'home_visit', 'in_person'
    )),
    status TEXT DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'in_progress', 'completed',
        'cancelled', 'no_show', 'rescheduled'
    )),
    consultation_fee DECIMAL(10, 2) DEFAULT 0,
    fee DECIMAL(10, 2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'paid', 'refunded', 'failed'
    )),
    payment_reference TEXT,
    payment_id TEXT,
    reason_for_visit TEXT,
    reason TEXT,
    symptoms TEXT[] DEFAULT '{}',
    notes TEXT,
    patient_notes TEXT,
    doctor_notes TEXT,
    cancellation_reason TEXT,
    cancelled_by UUID,
    cancelled_at TIMESTAMPTZ,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8.2 Consultations (video call sessions)
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id),
    doctor_id UUID REFERENCES doctors(id),
    room_id TEXT UNIQUE,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'pending'
    )),
    type TEXT DEFAULT 'video',
    patient_joined_at TIMESTAMPTZ,
    doctor_joined_at TIMESTAMPTZ,
    chief_complaint TEXT,
    symptoms TEXT[] DEFAULT '{}',
    diagnosis TEXT,
    diagnosis_codes TEXT[] DEFAULT '{}',
    notes TEXT,
    advice TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_notes TEXT,
    recording_url TEXT,
    rating INTEGER,
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add deferred FK on doctor_reviews.consultation_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_doctor_reviews_consultation'
    ) THEN
        ALTER TABLE doctor_reviews
            ADD CONSTRAINT fk_doctor_reviews_consultation
            FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8.3 Patient Vitals
CREATE TABLE IF NOT EXISTS patient_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    heart_rate INTEGER,
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    temperature DECIMAL(4, 1),
    oxygen_level DECIMAL(5, 2),
    respiratory_rate INTEGER,
    weight DECIMAL(5, 2),
    height DECIMAL(5, 2),
    blood_sugar DECIMAL(6, 2),
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8.4 Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_number TEXT UNIQUE,
    consultation_id UUID REFERENCES consultations(id),
    patient_id UUID REFERENCES patients(id),
    doctor_id UUID REFERENCES doctors(id),
    diagnosis TEXT,
    instructions TEXT,
    dietary_advice TEXT,
    lifestyle_advice TEXT,
    medicines JSONB DEFAULT '[]',
    notes TEXT,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    file_url TEXT,
    pdf_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'fulfilled', 'expired', 'cancelled'
    )),
    is_dispensed BOOLEAN DEFAULT FALSE,
    dispensed_at TIMESTAMPTZ,
    dispensed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8.5 Prescription Medicines (individual items)
CREATE TABLE IF NOT EXISTS prescription_medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    generic_name TEXT,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration TEXT NOT NULL,
    quantity INTEGER,
    before_food BOOLEAN DEFAULT FALSE,
    instructions TEXT,
    is_critical BOOLEAN DEFAULT FALSE
);

-- 8.6 Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'completed', 'failed', 'refunded'
    )),
    payment_method TEXT,
    payment_reference TEXT,
    gateway_response JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
