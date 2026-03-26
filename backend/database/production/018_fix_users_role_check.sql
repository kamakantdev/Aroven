-- ============================================================
-- 018: Fix users role check constraint for current role set
-- Ensures diagnostic_center_owner is allowed in users.role
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK (role IN (
    'patient', 'doctor', 'hospital_owner', 'hospital_manager',
    'clinic_owner', 'pharmacy_owner', 'ambulance_operator',
    'ambulance_driver', 'diagnostic_center_owner',
    'admin', 'super_admin'
));
