-- ============================================================
-- 004: DOCTORS
-- Doctor profiles, slots, reviews, hospital/clinic associations
-- ============================================================

-- 4.1 Doctors
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    specialization TEXT NOT NULL,
    sub_specialization TEXT,
    experience_years INTEGER DEFAULT 0,
    qualifications TEXT[] DEFAULT '{}',
    education TEXT[] DEFAULT '{}',
    certifications TEXT[] DEFAULT '{}',
    registration_number TEXT UNIQUE,
    license_number TEXT,
    medical_council TEXT,
    consultation_fee DECIMAL(10, 2) DEFAULT 0,
    video_consultation_fee DECIMAL(10, 2) DEFAULT 0,
    bio TEXT,
    languages TEXT[] DEFAULT '{}',
    available_days TEXT[] DEFAULT '{}',
    available_hours JSONB DEFAULT '{}',
    profile_image_url TEXT,
    license_document_url TEXT,
    degree_certificate_url TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN (
        'pending', 'under_review', 'approved', 'rejected', 'suspended'
    )),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT,
    rejection_reason TEXT,
    suspension_reason TEXT,
    suspended_at TIMESTAMPTZ,
    is_available BOOLEAN DEFAULT TRUE,
    is_accepting_new_patients BOOLEAN DEFAULT TRUE,
    rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_consultations INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 Add deferred FK on hospital_departments.head_doctor_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_dept_head_doctor'
    ) THEN
        ALTER TABLE hospital_departments
            ADD CONSTRAINT fk_dept_head_doctor
            FOREIGN KEY (head_doctor_id) REFERENCES doctors(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4.3 Doctor Slots (availability schedule)
CREATE TABLE IF NOT EXISTS doctor_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration INTEGER DEFAULT 15,
    is_video_enabled BOOLEAN DEFAULT TRUE,
    is_clinic_enabled BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.4 Doctor Reviews (direct doctor reviews)
CREATE TABLE IF NOT EXISTS doctor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    consultation_id UUID, -- FK added after consultations table
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.5 Hospital-Doctor Association
CREATE TABLE IF NOT EXISTS hospital_doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    department TEXT,
    designation TEXT,
    schedule JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hospital_id, doctor_id)
);

-- 4.6 Clinic-Doctor Association
CREATE TABLE IF NOT EXISTS clinic_doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    schedule JSONB DEFAULT '{}',
    consultation_fee DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, doctor_id)
);
