-- ============================================================
-- 016: MIGRATIONS (safe column additions for existing databases)
-- These ALTER statements ensure existing databases get new columns
-- without breaking. Only adds if column doesn't already exist.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason TEXT;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS weight DECIMAL(5, 2);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS height DECIMAL(5, 2);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS abha_number TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_conditions TEXT[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS chronic_conditions TEXT[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '[]';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_provider TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_id TEXT;

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS sub_specialization TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS medical_council TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS degree_certificate_url TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS license_document_url TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS specializations TEXT[] DEFAULT '{}';
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS accreditations TEXT[] DEFAULT '{}';
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS emergency_beds INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS opening_time TIME;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS closing_time TIME;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_24_hours BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_emergency_available BOOLEAN DEFAULT FALSE;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';

ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION;
ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION;
ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS current_request_id UUID;
ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS driver_user_id UUID;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_number TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time_slot TIME;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reason_for_visit TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_notes TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_notes TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS requester_name TEXT;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS requester_phone TEXT;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS vehicle_id UUID;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS operator_id UUID;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_number TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dietary_advice TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS lifestyle_advice TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medicines JSONB DEFAULT '[]';

ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS prescription_url TEXT;

-- Dispatch system columns on emergency_requests
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS dispatch_mode VARCHAR(30) DEFAULT 'sos_broadcast';
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS broadcast_round INTEGER DEFAULT 0;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS broadcast_ambulance_ids UUID[] DEFAULT '{}';
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS accepted_by UUID;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS assigned_by UUID;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS hospital_id UUID;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;
ALTER TABLE emergency_requests ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ;

-- ============================================================
-- CHECK CONSTRAINTS (data integrity safety nets)
-- ============================================================

-- Dispatch mode validation (may already exist from CREATE TABLE inline CHECK)
DO $$ BEGIN
  ALTER TABLE emergency_requests ADD CONSTRAINT emergency_requests_dispatch_mode_check
    CHECK (dispatch_mode IN ('sos_broadcast', 'hospital_controlled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Single patient profile per user
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'patients_user_id_unique') THEN
    ALTER TABLE patients ADD CONSTRAINT patients_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Single admin profile per user
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'admins_user_id_unique') THEN
    ALTER TABLE admins ADD CONSTRAINT admins_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Rating must be 1-5
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'reviews_rating_range') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5);
  END IF;
END $$;

-- Hospital beds must be non-negative
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'hospitals_beds_non_negative') THEN
    ALTER TABLE hospitals ADD CONSTRAINT hospitals_beds_non_negative
      CHECK (total_beds >= 0 AND beds_available >= 0);
  END IF;
END $$;

-- Pharmacy inventory quantity must be non-negative
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'pharmacy_inventory_qty_non_negative') THEN
    ALTER TABLE pharmacy_inventory ADD CONSTRAINT pharmacy_inventory_qty_non_negative
      CHECK (quantity >= 0);
  END IF;
END $$;

-- Medicine price must be non-negative
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'medicines_price_positive') THEN
    ALTER TABLE medicines ADD CONSTRAINT medicines_price_positive CHECK (price >= 0);
  END IF;
END $$;

-- ============================================================
-- INDEXES for columns added above (must come after ALTER TABLE)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_emergency_dispatch_mode ON emergency_requests(dispatch_mode);

-- ============================================================
-- VIEWS that depend on columns added above
-- ============================================================
CREATE OR REPLACE VIEW hospital_dispatch_view AS
SELECT
    er.id,
    er.request_number,
    er.requester_name,
    er.requester_phone,
    er.pickup_address,
    er.pickup_latitude,
    er.pickup_longitude,
    er.emergency_type,
    er.priority,
    er.status,
    er.dispatch_mode,
    er.notes,
    er.created_at,
    er.assigned_at,
    er.vehicle_id,
    er.broadcast_round,
    a.vehicle_number AS ambulance_vehicle_number,
    a.driver_name AS ambulance_driver_name,
    a.driver_phone AS ambulance_driver_phone,
    a.vehicle_type AS ambulance_type,
    p.name AS patient_name,
    p.user_id AS patient_user_id
FROM emergency_requests er
LEFT JOIN ambulances a ON er.vehicle_id = a.id
LEFT JOIN patients p ON er.patient_id = p.id
WHERE er.status NOT IN ('completed', 'cancelled')
ORDER BY
    CASE er.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        ELSE 3
    END,
    er.created_at ASC;

DO $$
BEGIN
    GRANT SELECT ON hospital_dispatch_view TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
