-- ============================================================
-- 014: TRIGGERS & FUNCTIONS
-- updated_at auto-trigger, number generators, auto-assign triggers
-- ============================================================

-- ============================================
-- Auto-update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to ALL tables that have the column
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT c.table_name FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.column_name = 'updated_at' AND c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', tbl, tbl);
            EXECUTE format('
                CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
            ', tbl, tbl);
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END LOOP;
END $$;

-- ============================================
-- Unique number generators (collision-resistant using gen_random_uuid)
-- ============================================

CREATE OR REPLACE FUNCTION generate_order_number(prefix TEXT DEFAULT 'ORD')
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || '-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
           UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_appointment_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'APT-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
           UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_prescription_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'RX-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
           UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_emergency_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'SOS-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
           UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_diagnostic_booking_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'DCB-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
           UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Auto-assign triggers for all *_number columns
-- ============================================

-- Appointment number
CREATE OR REPLACE FUNCTION auto_assign_appointment_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appointment_number IS NULL THEN
        NEW.appointment_number := generate_appointment_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointment_number ON appointments;
CREATE TRIGGER trg_appointment_number
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_appointment_number();

-- Prescription number
CREATE OR REPLACE FUNCTION auto_assign_prescription_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.prescription_number IS NULL THEN
        NEW.prescription_number := generate_prescription_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prescription_number ON prescriptions;
CREATE TRIGGER trg_prescription_number
    BEFORE INSERT ON prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_prescription_number();

-- Emergency request number
CREATE OR REPLACE FUNCTION auto_assign_emergency_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL THEN
        NEW.request_number := generate_emergency_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emergency_number ON emergency_requests;
CREATE TRIGGER trg_emergency_number
    BEFORE INSERT ON emergency_requests
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_emergency_number();

-- Pharmacy order number
CREATE OR REPLACE FUNCTION auto_assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_number ON pharmacy_orders;
CREATE TRIGGER trg_order_number
    BEFORE INSERT ON pharmacy_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_order_number();

-- Diagnostic booking number
CREATE OR REPLACE FUNCTION auto_assign_diagnostic_booking_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_number IS NULL THEN
        NEW.booking_number := generate_diagnostic_booking_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_diagnostic_booking_number ON diagnostic_bookings;
CREATE TRIGGER trg_diagnostic_booking_number
    BEFORE INSERT ON diagnostic_bookings
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_diagnostic_booking_number();

-- ============================================
-- Atomic RPC Functions (race condition prevention)
-- ============================================

-- C7: Atomic start consultation — creates consultation + updates appointment in one TX
CREATE OR REPLACE FUNCTION rpc_start_consultation(
  p_appointment_id UUID,
  p_doctor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment RECORD;
  v_consultation RECORD;
BEGIN
  SELECT * INTO v_appointment
    FROM appointments
    WHERE id = p_appointment_id
      AND doctor_id = p_doctor_id
      AND status IN ('scheduled', 'confirmed')
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'appointment_not_found');
  END IF;

  INSERT INTO consultations (
    appointment_id, doctor_id, patient_id, status, started_at, type
  ) VALUES (
    p_appointment_id, p_doctor_id, v_appointment.patient_id,
    'in_progress', now(), v_appointment.type
  )
  RETURNING * INTO v_consultation;

  UPDATE appointments
    SET status = 'in_progress', updated_at = now()
    WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'consultation', row_to_json(v_consultation)::jsonb
  );
END;
$$;

-- C7: Atomic end consultation — completes consultation + appointment in one TX
CREATE OR REPLACE FUNCTION rpc_end_consultation(
  p_consultation_id UUID,
  p_doctor_id UUID,
  p_diagnosis TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_follow_up_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_consultation RECORD;
BEGIN
  UPDATE consultations
    SET status = 'completed',
        ended_at = now(),
        diagnosis = COALESCE(p_diagnosis, diagnosis),
        notes = COALESCE(p_notes, notes),
        follow_up_date = COALESCE(p_follow_up_date, follow_up_date)
    WHERE id = p_consultation_id
      AND doctor_id = p_doctor_id
    RETURNING * INTO v_consultation;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'consultation_not_found');
  END IF;

  IF v_consultation.appointment_id IS NOT NULL THEN
    UPDATE appointments
      SET status = 'completed', updated_at = now()
      WHERE id = v_consultation.appointment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consultation', row_to_json(v_consultation)::jsonb
  );
END;
$$;

-- C11: Atomic ambulance dispatch — assigns ambulance + locks it in one TX
CREATE OR REPLACE FUNCTION rpc_dispatch_ambulance(
  p_request_id UUID,
  p_ambulance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ambulance RECORD;
BEGIN
  SELECT * INTO v_ambulance
    FROM ambulances
    WHERE id = p_ambulance_id
      AND status = 'available'
      AND is_active = true
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ambulance_unavailable');
  END IF;

  UPDATE emergency_requests
    SET status = 'dispatched',
        vehicle_id = p_ambulance_id,
        assigned_at = now()
    WHERE id = p_request_id
      AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'request_not_pending');
  END IF;

  UPDATE ambulances
    SET status = 'dispatched',
        current_request_id = p_request_id
    WHERE id = p_ambulance_id;

  RETURN jsonb_build_object(
    'success', true,
    'ambulance', row_to_json(v_ambulance)::jsonb
  );
END;
$$;

-- M2: Atomic doctor slot replacement — delete all + reinsert in one TX
CREATE OR REPLACE FUNCTION rpc_replace_doctor_slots(
  p_doctor_id UUID,
  p_slots JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot JSONB;
  v_inserted INTEGER := 0;
BEGIN
  DELETE FROM doctor_slots WHERE doctor_id = p_doctor_id;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots)
  LOOP
    INSERT INTO doctor_slots (
      doctor_id, day_of_week, start_time, end_time, is_active
    ) VALUES (
      p_doctor_id,
      (v_slot->>'day_of_week')::INTEGER,
      v_slot->>'start_time',
      v_slot->>'end_time',
      true
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted', v_inserted);
END;
$$;

-- M3: Atomic JSONB status_history append (prevents read-modify-write race)
CREATE OR REPLACE FUNCTION rpc_append_status_history(
  p_request_id UUID,
  p_entry JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE emergency_requests
    SET status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(p_entry)
    WHERE id = p_request_id;
END;
$$;

-- Atomic booking with advisory lock (prevents double-booking)
CREATE OR REPLACE FUNCTION rpc_book_appointment(
    p_patient_id UUID,
    p_doctor_id UUID,
    p_appointment_date DATE,
    p_time_slot TEXT,
    p_type TEXT DEFAULT 'clinic',
    p_notes TEXT DEFAULT NULL,
    p_hospital_id UUID DEFAULT NULL,
    p_fee NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_appointment RECORD;
    v_conflict_count INT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_doctor_id::text || p_appointment_date::text || p_time_slot));

    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_appointment_date
      AND time_slot = p_time_slot
      AND status IN ('scheduled', 'confirmed', 'in_progress');

    IF v_conflict_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'slot_taken');
    END IF;

    INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, type, notes, hospital_id, fee, status)
    VALUES (p_patient_id, p_doctor_id, p_appointment_date, p_time_slot, p_type, p_notes, p_hospital_id, p_fee, 'scheduled')
    RETURNING * INTO v_appointment;

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', v_appointment.id,
        'appointment_number', v_appointment.appointment_number
    );
END;
$$ LANGUAGE plpgsql;

-- SOS Broadcast: Atomic accept with row-level locking (prevents double assignment)
CREATE OR REPLACE FUNCTION accept_emergency_request(
  p_request_id UUID,
  p_ambulance_id UUID,
  p_driver_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_current_vehicle_id UUID;
  v_ambulance_status TEXT;
BEGIN
  SELECT status, vehicle_id INTO v_current_status, v_current_vehicle_id
  FROM emergency_requests
  WHERE id = p_request_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'request_not_found');
  END IF;

  IF v_current_status NOT IN ('pending', 'broadcasting', 'assigned') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_accepted',
      'current_status', v_current_status);
  END IF;

  IF v_current_vehicle_id IS NOT NULL AND v_current_vehicle_id != p_ambulance_id
     AND v_current_status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  SELECT status INTO v_ambulance_status
  FROM ambulances
  WHERE id = p_ambulance_id
  FOR UPDATE NOWAIT;

  IF v_ambulance_status != 'available' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ambulance_unavailable',
      'ambulance_status', v_ambulance_status);
  END IF;

  UPDATE emergency_requests
  SET status = 'accepted',
      vehicle_id = p_ambulance_id,
      accepted_by = p_driver_user_id,
      assigned_at = NOW(),
      status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_object(
        'status', 'accepted',
        'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'by', p_driver_user_id::text
      )
  WHERE id = p_request_id;

  UPDATE ambulances
  SET status = 'dispatched',
      is_available = false,
      current_request_id = p_request_id
  WHERE id = p_ambulance_id;

  RETURN jsonb_build_object('success', true, 'status', 'accepted');
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'reason', 'concurrent_lock');
END;
$$ LANGUAGE plpgsql;

-- Hospital-controlled dispatch: Manual ambulance assignment with locking
CREATE OR REPLACE FUNCTION hospital_assign_ambulance(
  p_request_id UUID,
  p_ambulance_id UUID,
  p_assigned_by UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_ambulance_status TEXT;
BEGIN
  SELECT status INTO v_current_status
  FROM emergency_requests
  WHERE id = p_request_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'request_not_found');
  END IF;

  IF v_current_status NOT IN ('pending') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_status',
      'current_status', v_current_status);
  END IF;

  SELECT status INTO v_ambulance_status
  FROM ambulances
  WHERE id = p_ambulance_id
  FOR UPDATE NOWAIT;

  IF v_ambulance_status != 'available' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ambulance_unavailable');
  END IF;

  UPDATE emergency_requests
  SET status = 'assigned',
      vehicle_id = p_ambulance_id,
      assigned_by = p_assigned_by,
      dispatch_mode = 'hospital_controlled',
      assigned_at = NOW(),
      status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_object(
        'status', 'assigned',
        'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'by', p_assigned_by::text,
        'mode', 'hospital_controlled'
      )
  WHERE id = p_request_id;

  UPDATE ambulances
  SET status = 'dispatched',
      is_available = false,
      current_request_id = p_request_id
  WHERE id = p_ambulance_id;

  RETURN jsonb_build_object('success', true, 'status', 'assigned');
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'reason', 'concurrent_lock');
END;
$$ LANGUAGE plpgsql;

-- Atomic hospital rating calculation (eliminates concurrent review race)
CREATE OR REPLACE FUNCTION calculate_hospital_rating(p_hospital_id UUID)
RETURNS TABLE(avg_rating NUMERIC, review_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(AVG(rating)::NUMERIC, 0) AS avg_rating,
    COUNT(*)::BIGINT AS review_count
  FROM reviews
  WHERE reviewable_type = 'hospital'
    AND reviewable_id = p_hospital_id;
$$;

-- ============================================
-- Grant execute permissions to service_role
-- ============================================

GRANT EXECUTE ON FUNCTION rpc_start_consultation(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_end_consultation(UUID, UUID, TEXT, TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_dispatch_ambulance(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_replace_doctor_slots(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_append_status_history(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_book_appointment(UUID, UUID, DATE, TEXT, TEXT, TEXT, UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION accept_emergency_request(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION hospital_assign_ambulance(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_hospital_rating(UUID) TO service_role;
