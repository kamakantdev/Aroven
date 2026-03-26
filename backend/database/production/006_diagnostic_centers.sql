-- ============================================================
-- 006: DIAGNOSTIC CENTERS
-- Diagnostic centers, tests catalog, bookings
-- ============================================================

-- 6.1 Diagnostic Centers
CREATE TABLE IF NOT EXISTS diagnostic_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    registration_number TEXT UNIQUE,
    license_number TEXT,
    nabl_accreditation TEXT,
    description TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    email TEXT,
    website TEXT,
    emergency_phone TEXT,
    test_categories TEXT[] DEFAULT '{}',
    accreditations TEXT[] DEFAULT '{}',
    sample_collection_available BOOLEAN DEFAULT TRUE,
    home_collection_available BOOLEAN DEFAULT FALSE,
    home_collection_fee DECIMAL(10, 2) DEFAULT 0,
    opening_hours JSONB DEFAULT '{}',
    is_24_hours BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    images TEXT[] DEFAULT '{}',
    gallery_urls TEXT[] DEFAULT '{}',
    license_document_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
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
    rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.2 Diagnostic Tests (catalog per center)
CREATE TABLE IF NOT EXISTS diagnostic_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES diagnostic_centers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    discounted_price DECIMAL(10, 2) CHECK (discounted_price IS NULL OR discounted_price >= 0),
    turnaround_hours INTEGER DEFAULT 24 CHECK (turnaround_hours > 0),
    sample_type TEXT,
    preparation_instructions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.3 Diagnostic Bookings
CREATE TABLE IF NOT EXISTS diagnostic_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_number TEXT UNIQUE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    center_id UUID REFERENCES diagnostic_centers(id) ON DELETE SET NULL,
    test_id UUID REFERENCES diagnostic_tests(id) ON DELETE SET NULL,
    booking_date DATE NOT NULL,
    booking_time TIME,
    collection_type TEXT DEFAULT 'walk_in' CHECK (collection_type IN (
        'walk_in', 'home_collection'
    )),
    collection_address TEXT,
    notes TEXT,
    status TEXT DEFAULT 'booked' CHECK (status IN (
        'booked', 'sample_collected', 'processing', 'completed', 'cancelled'
    )),
    result_status TEXT DEFAULT 'pending' CHECK (result_status IN (
        'pending', 'processing', 'completed', 'delivered'
    )),
    result_url TEXT,
    result_notes TEXT,
    result_uploaded_at TIMESTAMPTZ,
    result_uploaded_by UUID REFERENCES users(id),
    cancelled_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
