-- ============================================================
-- 015: VIEWS FOR ADMIN DASHBOARD
-- Pending approvals, active emergencies, today's appointments
-- ============================================================

-- Pending approvals across all provider types
CREATE OR REPLACE VIEW pending_approvals AS
SELECT 'doctor' as entity_type, id as entity_id, name, created_at, approval_status
FROM doctors WHERE approval_status = 'pending'
UNION ALL
SELECT 'hospital', id, name, created_at, approval_status
FROM hospitals WHERE approval_status = 'pending'
UNION ALL
SELECT 'clinic', id, name, created_at, approval_status
FROM clinics WHERE approval_status = 'pending'
UNION ALL
SELECT 'pharmacy', id, name, created_at, approval_status
FROM pharmacies WHERE approval_status = 'pending'
UNION ALL
SELECT 'diagnostic_center', id, name, created_at, approval_status
FROM diagnostic_centers WHERE approval_status = 'pending'
UNION ALL
SELECT 'ambulance', id, name, created_at, approval_status
FROM ambulance_operators WHERE approval_status = 'pending'
ORDER BY created_at DESC;

-- Active (in-progress) emergencies
DROP VIEW IF EXISTS active_emergencies;

CREATE OR REPLACE VIEW active_emergencies AS
SELECT
    er.*,
    p.name as patient_name,
    ao.name as operator_name,
    a.vehicle_number,
    a.driver_name,
    a.driver_phone
FROM emergency_requests er
LEFT JOIN patients p ON er.patient_id = p.id
LEFT JOIN ambulance_operators ao ON er.operator_id = ao.id
LEFT JOIN ambulances a ON er.vehicle_id = a.id
WHERE er.status NOT IN ('completed', 'cancelled')
ORDER BY
    CASE er.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        ELSE 3
    END,
    er.requested_at;

-- Today's appointments
CREATE OR REPLACE VIEW todays_appointments AS
SELECT
    a.*,
    p.name as patient_name,
    d.name as doctor_name,
    d.specialization
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN doctors d ON a.doctor_id = d.id
WHERE a.appointment_date = CURRENT_DATE
ORDER BY a.time_slot;

-- Hospital dispatch dashboard — MOVED to 016_migrations.sql
-- (references dispatch_mode & broadcast_round columns added in 016)

-- Grant view access to authenticated users
DO $$
BEGIN
    GRANT SELECT ON pending_approvals TO authenticated;
    GRANT SELECT ON active_emergencies TO authenticated;
    GRANT SELECT ON todays_appointments TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
