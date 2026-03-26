-- ============================================================
-- 013: ROW LEVEL SECURITY POLICIES
-- Enable RLS on all tables + service_role bypass
-- ============================================================

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'users', 'patients', 'doctors', 'hospitals', 'clinics', 'pharmacies',
        'diagnostic_centers', 'diagnostic_tests', 'diagnostic_bookings',
        'ambulance_operators', 'ambulances', 'admins', 'hospital_managers',
        'hospital_departments', 'hospital_doctors', 'clinic_doctors',
        'medicines', 'pharmacy_inventory', 'pharmacy_orders',
        'appointments', 'consultations', 'prescriptions', 'prescription_medicines',
        'emergency_requests', 'reports', 'reviews', 'notifications',
        'chat_messages', 'refresh_tokens', 'otp_verifications', 'audit_logs',
        'payments', 'emergency_contacts', 'family_members',
        'doctor_slots', 'doctor_reviews', 'ambulance_location_pings',
        'reminders', 'patient_vitals', 'chat_sessions', 'report_shares'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Service role bypass" ON %I', tbl);
            EXECUTE format('CREATE POLICY "Service role bypass" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl);
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END LOOP;
END $$;

-- ============================================================
-- Note: Fine-grained RLS policies using auth.uid() are NOT used
-- because this app uses custom JWT auth (not Supabase Auth).
-- All queries go through service_role which bypasses RLS.
-- If you add Supabase Auth in the future, add per-user policies here.
-- ============================================================
