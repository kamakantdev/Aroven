-- ============================================================
-- 003: HOSPITALS & CLINICS
-- Hospital profiles, departments, managers, clinics
-- ============================================================

-- 3.1 Hospitals
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    pincode TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    email TEXT,
    website TEXT,
    emergency_phone TEXT,
    license_number TEXT UNIQUE,
    type TEXT DEFAULT 'Multi-Specialty',
    description TEXT,
    specializations TEXT[] DEFAULT '{}',
    departments TEXT[] DEFAULT '{}',
    facilities TEXT[] DEFAULT '{}',
    accreditations TEXT[] DEFAULT '{}',
    total_beds INTEGER DEFAULT 0,
    beds_available INTEGER DEFAULT 0,
    icu_beds INTEGER DEFAULT 0,
    icu_beds_available INTEGER DEFAULT 0,
    emergency_beds INTEGER DEFAULT 0,
    opening_time TIME,
    closing_time TIME,
    is_24_hours BOOLEAN DEFAULT FALSE,
    is_emergency_available BOOLEAN DEFAULT FALSE,
    ambulance_available BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    gallery_urls TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    opening_hours JSONB DEFAULT '{}',
    license_document_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN (
        'pending', 'under_review', 'approved', 'rejected', 'suspended'
    )),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT,
    rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 Hospital Departments
CREATE TABLE IF NOT EXISTS hospital_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    head_doctor_id UUID, -- FK added after doctors table is created
    description TEXT,
    floor_number TEXT,
    contact_extension TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 Hospital Managers
CREATE TABLE IF NOT EXISTS hospital_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'manager',
    permissions JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 Clinics
CREATE TABLE IF NOT EXISTS clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    registration_number TEXT UNIQUE,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    email TEXT,
    license_number TEXT,
    specializations TEXT[] DEFAULT '{}',
    facilities TEXT[] DEFAULT '{}',
    opening_hours JSONB DEFAULT '{}',
    is_24_hours BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    gallery_urls TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    license_document_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN (
        'pending', 'under_review', 'approved', 'rejected', 'suspended'
    )),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT,
    rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
