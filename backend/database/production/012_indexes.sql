-- ============================================================
-- 012: PERFORMANCE INDEXES
-- All indexes for query optimization
-- ============================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Patients
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_city ON patients(city);

-- Doctors
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors(specialization);
CREATE INDEX IF NOT EXISTS idx_doctors_approval_status ON doctors(approval_status);
CREATE INDEX IF NOT EXISTS idx_doctors_hospital ON doctors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_doctors_is_available ON doctors(is_available) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_doctors_is_approved ON doctors(is_approved);

-- Hospitals (including spatial)
CREATE INDEX IF NOT EXISTS idx_hospitals_owner_id ON hospitals(owner_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_hospitals_type ON hospitals(type);
CREATE INDEX IF NOT EXISTS idx_hospitals_approval ON hospitals(approval_status);
CREATE INDEX IF NOT EXISTS idx_hospitals_lat_lng ON hospitals(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Clinics (including spatial)
CREATE INDEX IF NOT EXISTS idx_clinics_owner_id ON clinics(owner_id);
CREATE INDEX IF NOT EXISTS idx_clinics_city ON clinics(city);
CREATE INDEX IF NOT EXISTS idx_clinics_approval ON clinics(approval_status);
CREATE INDEX IF NOT EXISTS idx_clinics_lat_lng ON clinics(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Pharmacies (including spatial)
CREATE INDEX IF NOT EXISTS idx_pharmacies_owner_id ON pharmacies(owner_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_city ON pharmacies(city);
CREATE INDEX IF NOT EXISTS idx_pharmacies_approval ON pharmacies(approval_status);
CREATE INDEX IF NOT EXISTS idx_pharmacies_lat_lng ON pharmacies(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Diagnostic Centers (including spatial)
CREATE INDEX IF NOT EXISTS idx_diagnostic_centers_owner ON diagnostic_centers(owner_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_centers_city ON diagnostic_centers(city);
CREATE INDEX IF NOT EXISTS idx_diagnostic_centers_approval ON diagnostic_centers(approval_status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_centers_active_approved ON diagnostic_centers(is_active, is_approved) WHERE is_active = TRUE AND is_approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_diagnostic_centers_location ON diagnostic_centers(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Diagnostic Tests
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_center ON diagnostic_tests(center_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_category ON diagnostic_tests(category);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_active ON diagnostic_tests(center_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_price ON diagnostic_tests(price);

-- Diagnostic Bookings
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_patient ON diagnostic_bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_center ON diagnostic_bookings(center_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_test ON diagnostic_bookings(test_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_status ON diagnostic_bookings(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_result_status ON diagnostic_bookings(result_status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_date ON diagnostic_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_center_date ON diagnostic_bookings(center_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_number ON diagnostic_bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_diagnostic_bookings_pending_results ON diagnostic_bookings(center_id, result_status) WHERE result_status IN ('pending', 'processing');

-- Ambulances (including spatial)
CREATE INDEX IF NOT EXISTS idx_ambulances_operator ON ambulances(operator_id);
CREATE INDEX IF NOT EXISTS idx_ambulances_status ON ambulances(status);
CREATE INDEX IF NOT EXISTS idx_ambulances_lat_lng ON ambulances(current_latitude, current_longitude) WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ambulances_driver ON ambulances(driver_user_id);

-- Ambulance Operators
CREATE INDEX IF NOT EXISTS idx_ambulance_operators_user_id ON ambulance_operators(user_id);
CREATE INDEX IF NOT EXISTS idx_ambulance_operators_approval ON ambulance_operators(approval_status);

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_hospital ON appointments(hospital_id);

-- Consultations
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_appointment ON consultations(appointment_id);

-- Prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);

-- Emergency Requests
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_emergency_priority ON emergency_requests(priority);
CREATE INDEX IF NOT EXISTS idx_emergency_operator ON emergency_requests(operator_id);
CREATE INDEX IF NOT EXISTS idx_emergency_patient ON emergency_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_location ON emergency_requests(pickup_latitude, pickup_longitude);

-- Pharmacy
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_pharmacy ON pharmacy_inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_medicine ON pharmacy_inventory(medicine_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy ON pharmacy_orders(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_patient ON pharmacy_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status ON pharmacy_orders(status);

-- Medicines
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(generic_name);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_reviewable ON reviews(reviewable_type, reviewable_id);
CREATE INDEX IF NOT EXISTS idx_reviews_patient ON reviews(patient_id);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Auth
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON otp_verifications(phone);

-- Hospital Associations
CREATE INDEX IF NOT EXISTS idx_hospital_managers_user ON hospital_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_hospital_managers_hospital ON hospital_managers(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctors_hospital ON hospital_doctors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_doctors_doctor ON hospital_doctors(doctor_id);
CREATE INDEX IF NOT EXISTS idx_clinic_doctors_clinic ON clinic_doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_doctors_doctor ON clinic_doctors(doctor_id);

-- Doctor Slots & Reviews
CREATE INDEX IF NOT EXISTS idx_doctor_slots_doctor ON doctor_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_reviews_doctor ON doctor_reviews(doctor_id);

-- Location Pings
CREATE INDEX IF NOT EXISTS idx_location_pings_ambulance ON ambulance_location_pings(ambulance_id);
CREATE INDEX IF NOT EXISTS idx_location_pings_created ON ambulance_location_pings(created_at DESC);

-- Reminders
CREATE INDEX IF NOT EXISTS idx_reminders_patient ON reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_type ON reminders(type);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(patient_id, is_active) WHERE is_active = TRUE;

-- Patient Vitals
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient ON patient_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_by ON patient_vitals(recorded_by);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_at ON patient_vitals(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_consultation ON patient_vitals(consultation_id);

-- ============================================================
-- COMPOSITE & PARTIAL INDEXES (query optimization + constraints)
-- ============================================================

-- Appointments: composite for patient dashboard queries
CREATE INDEX IF NOT EXISTS idx_appointments_patient_status
  ON appointments(patient_id, status, appointment_date);

-- Appointments: composite for doctor schedule queries
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
  ON appointments(doctor_id, appointment_date);

-- Appointments: UNIQUE partial index to prevent double-booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment
  ON appointments(doctor_id, appointment_date, time_slot)
  WHERE status IN ('scheduled', 'confirmed', 'in_progress');

-- Consultations: partial index for stale consultation cleanup (cron)
CREATE INDEX IF NOT EXISTS idx_consultations_status_started
  ON consultations(status, started_at)
  WHERE status = 'in_progress';

-- Consultations: created_at for timeline queries
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- Reports: composite for patient records tab
CREATE INDEX IF NOT EXISTS idx_reports_patient_date ON reports(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_patient_type ON reports(patient_id, type);
CREATE INDEX IF NOT EXISTS idx_reports_patient_status ON reports(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Prescriptions: composite for patient history
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_created
  ON prescriptions(patient_id, created_at DESC);

-- Prescription Medicines: lookup by prescription
CREATE INDEX IF NOT EXISTS idx_prescription_medicines_prescription
  ON prescription_medicines(prescription_id);

-- Pharmacy Orders: composite for pharmacy dashboard
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy_status
  ON pharmacy_orders(pharmacy_id, status);

-- Report Shares
CREATE INDEX IF NOT EXISTS idx_report_shares_report ON report_shares(report_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_doctor ON report_shares(doctor_id);

-- Chat Sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, created_at DESC);

-- Refresh Tokens: partial index for active (non-revoked) tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON refresh_tokens(token)
  WHERE is_revoked = false;

-- Emergency: broadcast status index (dispatch_mode index moved to 016_migrations.sql)
CREATE INDEX IF NOT EXISTS idx_emergency_broadcast_status
  ON emergency_requests(status)
  WHERE status IN ('pending', 'broadcasting', 'assigned');

-- Ambulances: partial index for available units
CREATE INDEX IF NOT EXISTS idx_ambulances_available
  ON ambulances(status, is_active)
  WHERE status = 'available' AND is_active = true;
