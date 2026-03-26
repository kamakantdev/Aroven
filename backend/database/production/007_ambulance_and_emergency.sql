-- ============================================================
-- 007: AMBULANCE & EMERGENCY
-- Ambulance operators, vehicles, location pings, emergency requests
-- ============================================================

-- 7.1 Ambulance Operators (fleet owners)
CREATE TABLE IF NOT EXISTS ambulance_operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company_name TEXT,
    registration_number TEXT UNIQUE,
    address TEXT,
    city TEXT,
    state TEXT,
    phone TEXT,
    alternate_phone TEXT,
    email TEXT,
    total_vehicles INTEGER DEFAULT 0,
    available_vehicles INTEGER DEFAULT 0,
    license_document_url TEXT,
    license_expiry DATE,
    service_area TEXT[] DEFAULT '{}',
    base_fare DECIMAL(10, 2) DEFAULT 500,
    per_km_rate DECIMAL(10, 2) DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN (
        'pending', 'under_review', 'approved', 'rejected', 'suspended'
    )),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT,
    total_requests INTEGER DEFAULT 0,
    completed_requests INTEGER DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    avg_response_time_minutes INTEGER,
    rating DECIMAL(3, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.2 Ambulances (individual vehicles)
CREATE TABLE IF NOT EXISTS ambulances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES ambulance_operators(id) ON DELETE CASCADE,
    vehicle_number TEXT UNIQUE NOT NULL,
    vehicle_type TEXT DEFAULT 'basic' CHECK (vehicle_type IN (
        'basic', 'advanced', 'icu', 'neonatal', 'cardiac',
        'Basic Life Support', 'Advanced Life Support', 'ICU on Wheels'
    )),
    model TEXT,
    vehicle_model TEXT,
    year INTEGER,
    vehicle_year INTEGER,
    has_oxygen BOOLEAN DEFAULT TRUE,
    has_ventilator BOOLEAN DEFAULT FALSE,
    has_defibrillator BOOLEAN DEFAULT FALSE,
    equipment TEXT[] DEFAULT '{}',
    equipment_list TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'available' CHECK (status IN (
        'available', 'busy', 'dispatched', 'maintenance', 'offline'
    )),
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    last_location_update TIMESTAMPTZ,
    current_request_id UUID,
    driver_name TEXT,
    driver_phone TEXT,
    driver_license_number TEXT,
    driver_user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    is_on_duty BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIEW alias: some services join as 'ambulance_vehicles'
CREATE OR REPLACE VIEW ambulance_vehicles AS SELECT * FROM ambulances;

-- 7.3 Ambulance Location Pings (high-frequency GPS fallback)
CREATE TABLE IF NOT EXISTS ambulance_location_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ambulance_id UUID REFERENCES ambulances(id) ON DELETE CASCADE,
    request_id UUID,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.4 Emergency Requests
CREATE TABLE IF NOT EXISTS emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    requester_name TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION,
    pickup_longitude DOUBLE PRECISION,
    destination_hospital_id UUID REFERENCES hospitals(id),
    destination_address TEXT,
    emergency_type TEXT DEFAULT 'medical' CHECK (emergency_type IN (
        'medical', 'general', 'accident', 'cardiac', 'trauma', 'pregnancy', 'other'
    )),
    priority TEXT DEFAULT 'normal' CHECK (priority IN (
        'normal', 'high', 'critical'
    )),
    patient_condition TEXT,
    special_requirements TEXT,
    description TEXT,
    symptoms TEXT[] DEFAULT '{}',
    operator_id UUID REFERENCES ambulance_operators(id),
    vehicle_id UUID REFERENCES ambulances(id),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'assigned', 'dispatched',
        'broadcasting', 'accepted', 'timeout', 'no_ambulance',
        'en_route', 'en_route_pickup',
        'arrived', 'arrived_pickup',
        'picked_up', 'patient_onboard',
        'en_route_hospital', 'arrived_hospital',
        'completed', 'cancelled'
    )),
    status_history JSONB DEFAULT '[]',
    -- Dispatch system columns
    dispatch_mode VARCHAR(30) DEFAULT 'sos_broadcast' CHECK (dispatch_mode IN ('sos_broadcast', 'hospital_controlled')),
    broadcast_round INTEGER DEFAULT 0,
    broadcast_ambulance_ids UUID[] DEFAULT '{}',
    accepted_by UUID,
    assigned_by UUID,
    hospital_id UUID,
    rejection_count INTEGER DEFAULT 0,
    timeout_at TIMESTAMPTZ,
    -- Timestamps
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    pickup_arrived_at TIMESTAMPTZ,
    patient_loaded_at TIMESTAMPTZ,
    hospital_arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    response_time_minutes INTEGER,
    total_time_minutes INTEGER,
    estimated_arrival_minutes INTEGER,
    distance_km DECIMAL(10, 2),
    fare DECIMAL(10, 2),
    payment_status TEXT DEFAULT 'pending',
    notes TEXT,
    admin_notes TEXT,
    cancellation_reason TEXT,
    cancelled_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIEW alias: patient & ambulance routes query 'ambulance_requests'
CREATE OR REPLACE VIEW ambulance_requests AS SELECT * FROM emergency_requests;
