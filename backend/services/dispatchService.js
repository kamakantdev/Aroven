/**
 * Dispatch Service — Production-Grade Ambulance Dispatch Engine
 *
 * Supports two dispatch models:
 *   1) SOS Broadcast — auto-detect → broadcast to nearest → first-accept locks
 *   2) Hospital Controlled — hospital creates request → hospital assigns ambulance (no admin involvement)
 *
 * Admin role: monitoring-only (view emergencies on dashboard, no dispatch control)
 *
 * Features:
 *   - Atomic accept via PostgreSQL row-level locking (no double assignment)
 *   - Expanding-radius broadcast with configurable rounds
 *   - Timeout + cascade to next set of ambulances
 *   - Complete status lifecycle state machine
 *   - Status history JSONB tracking
 *   - Event-driven architecture (Socket.IO + FCM push)
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { calculateDistance, formatDistance, calculateETA, getBoundingBox } = require('../utils/geo');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('./notificationService');
const eventEmitter = require('./eventEmitter');

// ── Status State Machine ────────────────────────────────────────
const STATUS_TRANSITIONS = {
  pending:           ['broadcasting', 'assigned', 'cancelled', 'no_ambulance'],
  broadcasting:      ['accepted', 'timeout', 'cancelled'],
  assigned:          ['accepted', 'en_route', 'cancelled', 'timeout'],
  accepted:          ['en_route', 'cancelled'],
  en_route:          ['arrived', 'cancelled'],
  arrived:           ['picked_up', 'cancelled'],
  picked_up:         ['en_route_hospital', 'completed'],
  en_route_hospital: ['arrived_hospital', 'completed'],
  arrived_hospital:  ['completed'],
  completed:         [],
  cancelled:         [],
  timeout:           ['broadcasting', 'cancelled', 'no_ambulance'],
  no_ambulance:      ['broadcasting', 'cancelled'],
};

const TERMINAL_STATUSES = ['completed', 'cancelled', 'no_ambulance'];

const DISPATCH_MODES = {
  SOS_BROADCAST: 'sos_broadcast',
  HOSPITAL_CONTROLLED: 'hospital_controlled',
};

// ── Priority from emergency type ─────────────────────────────────
function derivePriority(emergencyType) {
  const critical = ['cardiac', 'accident', 'trauma'];
  const high = ['pregnancy'];
  if (critical.includes(emergencyType)) return 'critical';
  if (high.includes(emergencyType)) return 'high';
  return 'normal';
}

class DispatchService {
  constructor() {
    // Fix #47: In-memory Map is acceptable for single-instance deployment.
    // On restart, recoverBroadcasts() re-arms timeouts from DB state.
    // For multi-instance, migrate timeout tracking to Redis EXPIRE keys.
    this.pendingTimeouts = new Map(); // requestId → timeoutId
    this.ACCEPT_TIMEOUT_MS = 30_000;  // 30 s for each broadcast round
    this.MAX_BROADCAST_ROUNDS = 3;
    this.BROADCAST_RADIUS_KM = [10, 25, 50]; // expanding radius per round
  }

  async _resolveAmbulanceForUser(userId, { requireAvailable = false } = {}) {
    const baseSelect = 'id, vehicle_number, driver_name, driver_phone, vehicle_type, driver_user_id, operator_id, status';

    let driverQuery = supabaseAdmin
      .from('ambulances')
      .select(baseSelect)
      .eq('driver_user_id', userId)
      .limit(1);
    if (requireAvailable) driverQuery = driverQuery.eq('status', 'available');

    const { data: driverAmbulance } = await driverQuery.maybeSingle();
    if (driverAmbulance) return driverAmbulance;

    const { data: operator } = await supabaseAdmin
      .from('ambulance_operators')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!operator?.id) return null;

    let operatorQuery = supabaseAdmin
      .from('ambulances')
      .select(baseSelect)
      .eq('operator_id', operator.id)
      .limit(1);
    if (requireAvailable) operatorQuery = operatorQuery.eq('status', 'available');

    const { data: operatorAmbulance } = await operatorQuery.maybeSingle();
    return operatorAmbulance || null;
  }

  async _resolveAmbulanceRecipientUserIds(ambulance) {
    const recipients = new Set();
    if (ambulance?.driver_user_id) recipients.add(ambulance.driver_user_id);

    if (ambulance?.operator_id) {
      const { data: operator } = await supabaseAdmin
        .from('ambulance_operators')
        .select('user_id')
        .eq('id', ambulance.operator_id)
        .maybeSingle();
      if (operator?.user_id) recipients.add(operator.user_id);
    }

    return Array.from(recipients);
  }

  // ── Startup recovery: re-arm timeouts for stuck broadcasting requests ──
  async recoverBroadcasts() {
    try {
      const { data: stuckRequests } = await supabaseAdmin
        .from('emergency_requests')
        .select('id, pickup_latitude, pickup_longitude, broadcast_round, timeout_at, status')
        .in('status', ['broadcasting'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (!stuckRequests || stuckRequests.length === 0) {
        console.log('🔄 No stuck broadcasts to recover');
        return;
      }

      console.log(`🔄 Recovering ${stuckRequests.length} stuck broadcast(s)...`);

      for (const req of stuckRequests) {
        const now = Date.now();
        const timeoutAt = req.timeout_at ? new Date(req.timeout_at).getTime() : 0;
        const remainingMs = timeoutAt - now;

        if (remainingMs > 0) {
          // Timeout hasn't expired yet — re-arm with remaining time
          console.log(`  ⏱ Re-arming timeout for ${req.id} (${Math.ceil(remainingMs / 1000)}s remaining)`);
          const timeoutId = setTimeout(async () => {
            this.pendingTimeouts.delete(req.id);
            const { data: current } = await supabaseAdmin
              .from('emergency_requests').select('status').eq('id', req.id).single();
            if (!current || current.status !== 'broadcasting') return;

            const nextRound = (req.broadcast_round || 1) + 1;
            if (nextRound <= this.MAX_BROADCAST_ROUNDS) {
              await this._broadcastToNearestAmbulances(req.id, req.pickup_latitude, req.pickup_longitude, nextRound);
            } else {
              await this._updateRequestStatus(req.id, 'timeout', null, {
                reason: 'No driver accepted (recovered after restart)',
              });
            }
          }, remainingMs);
          this.pendingTimeouts.set(req.id, timeoutId);
        } else {
          // Timeout already expired while server was down — cascade immediately
          console.log(`  ⚡ Timeout expired for ${req.id}, cascading now`);
          const nextRound = (req.broadcast_round || 1) + 1;
          if (nextRound <= this.MAX_BROADCAST_ROUNDS) {
            this._broadcastToNearestAmbulances(req.id, req.pickup_latitude, req.pickup_longitude, nextRound)
              .catch(err => console.error(`  Recovery broadcast error for ${req.id}:`, err.message));
          } else {
            this._updateRequestStatus(req.id, 'timeout', null, {
              reason: 'No driver accepted (timed out during server restart)',
            }).catch(err => console.error(`  Recovery timeout error for ${req.id}:`, err.message));
          }
        }
      }
    } catch (err) {
      console.error('❌ Broadcast recovery failed:', err.message);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // MODEL 1: SOS BROADCAST DISPATCH
  // Patient presses SOS → backend broadcasts to nearest ambulances
  // First driver to accept gets locked atomically
  // ══════════════════════════════════════════════════════════════

  async requestSOS(userId, requestData) {
    const { latitude, longitude, emergencyType, patientName, patientPhone, notes } = requestData;

    if (!latitude || !longitude) {
      throw new ApiError(400, 'Location (latitude, longitude) is required for SOS');
    }

    // Resolve patient profile strictly (no synthetic profile creation)
    let { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, name, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!patient) {
      throw new ApiError(403, 'Patient profile not found. Please complete patient registration before SOS requests.');
    }

    const requestId = uuidv4();
    const priority = derivePriority(emergencyType || 'medical');

    // Create the emergency request in PENDING state
    const { data: sosRequest, error: insertError } = await supabaseAdmin
      .from('emergency_requests')
      .insert({
        id: requestId,
        patient_id: patient?.id,
        requester_name: patientName || patient?.name || null,
        requester_phone: patientPhone || '',
        pickup_address: `${latitude}, ${longitude}`,
        pickup_latitude: latitude,
        pickup_longitude: longitude,
        emergency_type: emergencyType || 'medical',
        priority,
        status: 'pending',
        dispatch_mode: DISPATCH_MODES.SOS_BROADCAST,
        broadcast_round: 0,
        status_history: JSON.stringify([{
          status: 'pending',
          timestamp: new Date().toISOString(),
          by: userId,
        }]),
        notes,
      })
      .select()
      .single();

    if (insertError) {
      console.error('SOS insert error:', insertError);
      throw new ApiError(400, 'Failed to create emergency request');
    }

    // Start broadcast round 1
    const broadcastResult = await this._broadcastToNearestAmbulances(requestId, latitude, longitude, 1);

    // Emit to hospital dashboards / admin
    eventEmitter.emitEmergencyRequest({
      requestId,
      patient_id: patient?.user_id,
      patientName: patientName || patient?.name,
      pickupLatitude: latitude,
      pickupLongitude: longitude,
      emergencyType: emergencyType || 'medical',
      priority,
      status: broadcastResult.broadcastedTo > 0 ? 'broadcasting' : 'no_ambulance',
      dispatchMode: DISPATCH_MODES.SOS_BROADCAST,
    });

    return {
      requestId,
      status: broadcastResult.broadcastedTo > 0 ? 'broadcasting' : 'no_ambulance',
      message: broadcastResult.broadcastedTo > 0
        ? `SOS broadcast sent to ${broadcastResult.broadcastedTo} nearby ambulance(s)`
        : 'No ambulances available in your area. We are expanding the search.',
      broadcastedTo: broadcastResult.broadcastedTo,
      estimatedWait: '1-3 minutes',
    };
  }

  // ── Internal: Broadcast to nearest ambulances ──────────────────
  async _broadcastToNearestAmbulances(requestId, latitude, longitude, round) {
    const radiusKm = this.BROADCAST_RADIUS_KM[round - 1] || 50;

    // Get the request to check already-broadcast IDs
    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select('broadcast_ambulance_ids')
      .eq('id', requestId)
      .single();

    const alreadyBroadcasted = request?.broadcast_ambulance_ids || [];

    // Find available ambulances in radius, excluding already-contacted ones
    const bounds = getBoundingBox({ latitude, longitude }, radiusKm);
    const { data: ambulances } = await supabaseAdmin
      .from('ambulances')
      .select('id, vehicle_number, driver_name, driver_phone, driver_user_id, vehicle_type, current_latitude, current_longitude, operator_id')
      .eq('is_active', true)
      .eq('status', 'available')
      .gte('current_latitude', bounds.minLat)
      .lte('current_latitude', bounds.maxLat)
      .gte('current_longitude', bounds.minLng)
      .lte('current_longitude', bounds.maxLng);

    // Filter out already-broadcasted and sort by distance
    const candidates = (ambulances || [])
      .filter(a => !alreadyBroadcasted.includes(a.id))
      .map(a => ({
        ...a,
        distance: calculateDistance(
          { latitude, longitude },
          { latitude: a.current_latitude, longitude: a.current_longitude }
        ),
      }))
      .filter(a => a.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5); // Broadcast to max 5 at a time

    if (candidates.length === 0 && round < this.MAX_BROADCAST_ROUNDS) {
      // No ambulances in this radius — expand and try next round
      return this._broadcastToNearestAmbulances(requestId, latitude, longitude, round + 1);
    }

    if (candidates.length === 0) {
      // No ambulances found even at max radius
      await this._updateRequestStatus(requestId, 'no_ambulance', null, {
        reason: `No ambulances found within ${radiusKm}km after ${round} rounds`,
      });
      return { broadcastedTo: 0 };
    }

    // Update request to broadcasting state
    const newBroadcastIds = [...alreadyBroadcasted, ...candidates.map(c => c.id)];
    await supabaseAdmin
      .from('emergency_requests')
      .update({
        status: 'broadcasting',
        broadcast_round: round,
        broadcast_ambulance_ids: newBroadcastIds,
        timeout_at: new Date(Date.now() + this.ACCEPT_TIMEOUT_MS).toISOString(),
        status_history: supabaseAdmin.rpc ? undefined : undefined, // handled in _updateRequestStatus
      })
      .eq('id', requestId);

    // Append to status_history
    await this._appendStatusHistory(requestId, 'broadcasting', {
      round,
      radiusKm,
      candidateCount: candidates.length,
    });

    // Send push notifications + Socket.IO to each candidate driver
    const notifyPromises = candidates.map(async (ambulance) => {
      const eta = calculateETA(ambulance.distance, 50);
      try {
        // FCM + DB notification
        if (ambulance.driver_user_id) {
          await notificationService.sendNotification(ambulance.driver_user_id, {
            title: '🚨 SOS Emergency Request',
            message: `Emergency pickup ${formatDistance(ambulance.distance)} away — ${eta}`,
            type: 'ambulance_sos_broadcast',
            data: {
              requestId,
              pickupLatitude: latitude,
              pickupLongitude: longitude,
              distance: ambulance.distance,
              eta,
              round,
            },
          });

          // Socket.IO direct push to driver
          eventEmitter.notifyUser(ambulance.driver_user_id, 'ambulance:broadcast', {
            requestId,
            pickupLatitude: latitude,
            pickupLongitude: longitude,
            distance: formatDistance(ambulance.distance),
            eta,
            round,
            timestamp: new Date().toISOString(),
          });
        }

        // Also notify mapped operator/driver users (operator_id is not a user_id)
        const recipients = await this._resolveAmbulanceRecipientUserIds(ambulance);
        recipients.forEach((recipientUserId) => {
          eventEmitter.notifyUser(recipientUserId, 'ambulance:broadcast', {
            requestId,
            ambulanceId: ambulance.id,
            vehicleNumber: ambulance.vehicle_number,
            distance: formatDistance(ambulance.distance),
          });
        });
      } catch (err) {
        console.warn(`Failed to notify ambulance ${ambulance.id}:`, err.message);
      }
    });

    await Promise.allSettled(notifyPromises);

    // Set timeout for this broadcast round
    this._setAcceptTimeout(requestId, latitude, longitude, round);

    return { broadcastedTo: candidates.length };
  }

  // ── Timeout handler — cascade to next round or mark no_ambulance ──
  _setAcceptTimeout(requestId, latitude, longitude, currentRound) {
    // Clear any existing timeout for this request
    if (this.pendingTimeouts.has(requestId)) {
      clearTimeout(this.pendingTimeouts.get(requestId));
    }

    const timeoutId = setTimeout(async () => {
      this.pendingTimeouts.delete(requestId);

      // Check if request is still in broadcasting state
      const { data: request } = await supabaseAdmin
        .from('emergency_requests')
        .select('status')
        .eq('id', requestId)
        .single();

      if (!request || request.status !== 'broadcasting') {
        return; // Already accepted, cancelled, etc.
      }

      const nextRound = currentRound + 1;
      if (nextRound <= this.MAX_BROADCAST_ROUNDS) {
        console.log(`⏱ Broadcast timeout for ${requestId}, expanding to round ${nextRound}`);
        await this._broadcastToNearestAmbulances(requestId, latitude, longitude, nextRound);
      } else {
        console.log(`⏱ All broadcast rounds exhausted for ${requestId}`);
        await this._updateRequestStatus(requestId, 'timeout', null, {
          reason: 'No driver accepted within timeout period',
          rounds: currentRound,
        });

        // Notify patient
        const { data: req } = await supabaseAdmin
          .from('emergency_requests')
          .select('patient_id')
          .eq('id', requestId)
          .single();
        if (req?.patient_id) {
          const { data: patient } = await supabaseAdmin
            .from('patients').select('user_id').eq('id', req.patient_id).single();
          if (patient?.user_id) {
            eventEmitter.notifyUser(patient.user_id, 'ambulance:timeout', {
              requestId,
              message: 'No ambulance could accept your request. Please try again or call 108.',
            });
          }
        }
      }
    }, this.ACCEPT_TIMEOUT_MS);

    this.pendingTimeouts.set(requestId, timeoutId);
  }

  // ══════════════════════════════════════════════════════════════
  // MODEL 2: HOSPITAL-CONTROLLED DISPATCH
  // Hospital creates request → hospital assigns ambulance independently
  // Admin has NO involvement — only receives notifications for monitoring
  // ══════════════════════════════════════════════════════════════

  async createHospitalRequest(userId, requestData) {
    const { latitude, longitude, emergencyType, patientName, patientPhone, notes, hospitalId } = requestData;

    if (!latitude || !longitude) {
      throw new ApiError(400, 'Location is required');
    }

    const requestId = uuidv4();
    const priority = derivePriority(emergencyType || 'medical');

    const { data: sosRequest, error } = await supabaseAdmin
      .from('emergency_requests')
      .insert({
        id: requestId,
        patient_id: null, // Hospital creates on behalf
        requester_name: patientName || null,
        requester_phone: patientPhone || '',
        pickup_address: `${latitude}, ${longitude}`,
        pickup_latitude: latitude,
        pickup_longitude: longitude,
        emergency_type: emergencyType || 'medical',
        priority,
        status: 'pending',
        dispatch_mode: DISPATCH_MODES.HOSPITAL_CONTROLLED,
        hospital_id: hospitalId,
        notes,
        status_history: JSON.stringify([{
          status: 'pending',
          timestamp: new Date().toISOString(),
          by: userId,
          mode: 'hospital_controlled',
        }]),
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(400, 'Failed to create hospital dispatch request');
    }

    // Notify admin dashboards
    eventEmitter.emitEmergencyRequest({
      requestId,
      patientName: patientName || null,
      pickupLatitude: latitude,
      pickupLongitude: longitude,
      emergencyType: emergencyType || 'medical',
      priority,
      status: 'pending',
      dispatchMode: DISPATCH_MODES.HOSPITAL_CONTROLLED,
    });

    return {
      requestId,
      status: 'pending',
      message: 'Emergency request created. Assign an ambulance from the dashboard.',
    };
  }

  async hospitalAssignAmbulance(assignedByUserId, requestId, ambulanceId) {
    // Use the atomic PostgreSQL function for concurrency safety
    const { data, error } = await supabaseAdmin.rpc('hospital_assign_ambulance', {
      p_request_id: requestId,
      p_ambulance_id: ambulanceId,
      p_assigned_by: assignedByUserId,
    });

    if (error) {
      console.error('Hospital assign RPC error:', error);
      throw new ApiError(500, 'Failed to assign ambulance');
    }

    if (!data?.success) {
      const reasons = {
        request_not_found: 'Emergency request not found',
        invalid_status: `Request is already ${data?.current_status || 'processed'}`,
        ambulance_unavailable: 'Selected ambulance is not available',
        concurrent_lock: 'Another assignment is in progress, please retry',
      };
      throw new ApiError(409, reasons[data?.reason] || 'Assignment failed');
    }

    // Get the full ambulance details to notify the driver
    const { data: ambulance } = await supabaseAdmin
      .from('ambulances')
      .select('id, vehicle_number, driver_name, driver_phone, driver_user_id, operator_id, vehicle_type')
      .eq('id', ambulanceId)
      .single();

    // Get request details for the notification
    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select('pickup_latitude, pickup_longitude, emergency_type, requester_name, patient_id')
      .eq('id', requestId)
      .single();

    // Notify mapped ambulance recipients (driver + operator user)
    const recipients = await this._resolveAmbulanceRecipientUserIds(ambulance);
    for (const recipientUserId of recipients) {
      await notificationService.sendNotification(recipientUserId, {
        title: '🏥 Hospital Assignment',
        message: `You have been assigned to emergency pickup for ${request?.requester_name || 'a patient'}`,
        type: 'ambulance_hospital_assignment',
        data: {
          requestId,
          pickupLatitude: request?.pickup_latitude,
          pickupLongitude: request?.pickup_longitude,
          emergencyType: request?.emergency_type,
        },
      });

      eventEmitter.notifyUser(recipientUserId, 'ambulance:assigned', {
        requestId,
        pickupLatitude: request?.pickup_latitude,
        pickupLongitude: request?.pickup_longitude,
        emergencyType: request?.emergency_type,
        requesterName: request?.requester_name,
        dispatchMode: 'hospital_controlled',
      });
    }

    // Notify patient if exists
    if (request?.patient_id) {
      const { data: patient } = await supabaseAdmin
        .from('patients').select('user_id').eq('id', request.patient_id).single();
      if (patient?.user_id) {
        eventEmitter.emitAmbulanceAssigned({
          patient_id: patient.user_id,
          requestId,
          ambulance: {
            id: ambulance?.id,
            vehicleNumber: ambulance?.vehicle_number,
            driverName: ambulance?.driver_name,
            driverPhone: ambulance?.driver_phone,
          },
        });
      }
    }

    // Emit to all dashboards
    eventEmitter.notifyRoom('ambulance:dispatch', 'emergency:updated', {
      requestId,
      status: 'assigned',
      ambulanceId,
      vehicleNumber: ambulance?.vehicle_number,
      driverName: ambulance?.driver_name,
    });

    return {
      success: true,
      message: 'Ambulance assigned successfully',
      ambulance: {
        id: ambulance?.id,
        vehicleNumber: ambulance?.vehicle_number,
        driverName: ambulance?.driver_name,
        driverPhone: ambulance?.driver_phone,
        type: ambulance?.vehicle_type,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // DRIVER ACCEPTANCE (used by both models)
  // ══════════════════════════════════════════════════════════════

  async acceptRequest(driverUserId, requestId) {
    // Find an ambulance for this user (driver or operator login)
    const ambulance = await this._resolveAmbulanceForUser(driverUserId, { requireAvailable: true });

    if (!ambulance) {
      throw new ApiError(404, 'No available ambulance found for your account');
    }

    // Atomic accept via PostgreSQL function (row-level locking)
    let { data, error } = await supabaseAdmin.rpc('accept_emergency_request', {
      p_request_id: requestId,
      p_ambulance_id: ambulance.id,
      p_driver_user_id: driverUserId,
    });

    if (error) {
      console.error('Accept RPC error:', error);
      // Backward-compat fallback: some DBs have stricter status check constraints
      // that reject 'accepted'. In that case, fallback to 'assigned'.
      if (String(error.code) === '23514' && String(error.message || '').includes('emergency_requests_status_check')) {
        const { data: currentReq } = await supabaseAdmin
          .from('emergency_requests')
          .select('id, status, vehicle_id')
          .eq('id', requestId)
          .single();

        if (!currentReq) throw new ApiError(404, 'Emergency request not found');
        if (!['pending', 'broadcasting', 'assigned'].includes(currentReq.status)) {
          throw new ApiError(409, `Could not accept request from status '${currentReq.status}'`);
        }

        const { data: currentAmb } = await supabaseAdmin
          .from('ambulances')
          .select('id, status')
          .eq('id', ambulance.id)
          .single();

        if (!currentAmb || currentAmb.status !== 'available') {
          throw new ApiError(409, 'Your ambulance is not available');
        }

        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from('emergency_requests')
          .update({
            status: 'assigned',
            vehicle_id: ambulance.id,
            accepted_by: driverUserId,
            assigned_at: nowIso,
          })
          .eq('id', requestId);

        await supabaseAdmin
          .from('ambulances')
          .update({
            status: 'dispatched',
            is_available: false,
            current_request_id: requestId,
          })
          .eq('id', ambulance.id);

        data = { success: true, status: 'assigned', reason: 'fallback_status_constraint' };
      } else {
        throw new ApiError(500, 'Failed to accept request');
      }
    }

    if (!data?.success) {
      const reasons = {
        request_not_found: 'Emergency request not found',
        already_accepted: 'This request has already been accepted by another ambulance',
        already_assigned: 'This request is already assigned to another ambulance',
        ambulance_unavailable: 'Your ambulance is not available',
        concurrent_lock: 'Another driver is accepting this request simultaneously',
      };
      throw new ApiError(409, reasons[data?.reason] || 'Could not accept request');
    }

    // Clear broadcast timeout since request is accepted
    if (this.pendingTimeouts.has(requestId)) {
      clearTimeout(this.pendingTimeouts.get(requestId));
      this.pendingTimeouts.delete(requestId);
    }

    // Get request details for notifications
    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select('patient_id, pickup_latitude, pickup_longitude, requester_name')
      .eq('id', requestId)
      .single();

    // Notify the patient
    if (request?.patient_id) {
      const { data: patient } = await supabaseAdmin
        .from('patients').select('user_id').eq('id', request.patient_id).single();
      if (patient?.user_id) {
        await notificationService.sendNotification(patient.user_id, {
          title: '🚑 Ambulance Accepted',
          message: `Ambulance ${ambulance.vehicle_number} (${ambulance.driver_name}) is coming to you`,
          type: 'ambulance_accepted',
          data: { requestId },
        });

        eventEmitter.emitAmbulanceAssigned({
          patient_id: patient.user_id,
          requestId,
          ambulance: {
            id: ambulance.id,
            vehicleNumber: ambulance.vehicle_number,
            driverName: ambulance.driver_name,
            driverPhone: ambulance.driver_phone,
          },
        });
      }
    }

    // Notify other broadcasted drivers that request is taken
    const { data: reqFull } = await supabaseAdmin
      .from('emergency_requests')
      .select('broadcast_ambulance_ids')
      .eq('id', requestId)
      .single();

    if (reqFull?.broadcast_ambulance_ids?.length) {
      const otherAmbulanceIds = reqFull.broadcast_ambulance_ids.filter(id => id !== ambulance.id);
      if (otherAmbulanceIds.length > 0) {
        const { data: otherAmbulances } = await supabaseAdmin
          .from('ambulances')
          .select('driver_user_id')
          .in('id', otherAmbulanceIds);

        (otherAmbulances || []).forEach(other => {
          if (other.driver_user_id) {
            eventEmitter.notifyUser(other.driver_user_id, 'ambulance:request-taken', {
              requestId,
              message: 'This request has been accepted by another ambulance',
            });
          }
        });
      }
    }

    // Emit to dashboards
    eventEmitter.notifyRoom('ambulance:dispatch', 'emergency:updated', {
      requestId,
      status: 'accepted',
      ambulanceId: ambulance.id,
      vehicleNumber: ambulance.vehicle_number,
      driverName: ambulance.driver_name,
    });

    return {
      success: true,
      message: 'Emergency request accepted. Navigate to patient now.',
      requestId,
      ambulance: {
        id: ambulance.id,
        vehicleNumber: ambulance.vehicle_number,
        type: ambulance.vehicle_type,
      },
    };
  }

  async rejectRequest(driverUserId, requestId) {
    // Record rejection (for analytics)
    const ambulance = await this._resolveAmbulanceForUser(driverUserId, { requireAvailable: false });

    if (ambulance) {
      // Atomic increment with retry loop (optimistic lock + 3 retries)
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: req } = await supabaseAdmin
          .from('emergency_requests')
          .select('rejection_count')
          .eq('id', requestId)
          .single();

        if (!req) break;

        const currentCount = req.rejection_count || 0;
        const { data: updated } = await supabaseAdmin
          .from('emergency_requests')
          .update({ rejection_count: currentCount + 1 })
          .eq('id', requestId)
          .eq('rejection_count', currentCount)
          .select('id')
          .maybeSingle();

        if (updated) break; // Success
        // Otherwise another write raced us — retry
      }
    }

    await this._appendStatusHistory(requestId, 'rejected', {
      by: driverUserId,
      ambulanceId: ambulance?.id,
    });

    return { success: true, message: 'Request rejected' };
  }

  // ══════════════════════════════════════════════════════════════
  // STATUS LIFECYCLE (used by ambulance driver app)
  // ══════════════════════════════════════════════════════════════

  async updateStatus(driverUserId, requestId, newStatus, data = {}) {
    const ambulance = await this._resolveAmbulanceForUser(driverUserId, { requireAvailable: false });

    if (!ambulance) {
      throw new ApiError(404, 'Ambulance not found for your account');
    }

    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select('*, vehicle:ambulances(id, driver_user_id, operator_id)')
      .eq('id', requestId)
      .single();

    if (!request) {
      throw new ApiError(404, 'Emergency request not found');
    }

    if (request.vehicle_id && request.vehicle_id !== ambulance.id) {
      throw new ApiError(403, 'This emergency is assigned to a different ambulance');
    }

    // Validate state transition
    const allowed = STATUS_TRANSITIONS[request.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(400,
        `Cannot transition from '${request.status}' to '${newStatus}'. Allowed: ${allowed.join(', ')}`
      );
    }

    // Build update payload with timestamps
    const updateData = {
      status: newStatus,
    };

    switch (newStatus) {
      case 'en_route':
        updateData.dispatched_at = new Date().toISOString();
        break;
      case 'arrived':
        updateData.pickup_arrived_at = new Date().toISOString();
        break;
      case 'picked_up':
        updateData.patient_loaded_at = new Date().toISOString();
        if (data.hospitalId) updateData.destination_hospital_id = data.hospitalId;
        if (data.destinationLatitude) updateData.destination_latitude = data.destinationLatitude;
        if (data.destinationLongitude) updateData.destination_longitude = data.destinationLongitude;
        break;
      case 'en_route_hospital':
        // Already picked up, heading to hospital
        break;
      case 'arrived_hospital':
        updateData.hospital_arrived_at = new Date().toISOString();
        break;
      case 'completed':
        updateData.completed_at = new Date().toISOString();
        // Release ambulance
        await supabaseAdmin
          .from('ambulances')
          .update({ status: 'available', current_request_id: null, is_available: true })
          .eq('id', ambulance.id);
        break;
      case 'cancelled':
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = data.reason;
        updateData.cancelled_by = driverUserId;
        // Release ambulance
        await supabaseAdmin
          .from('ambulances')
          .update({ status: 'available', current_request_id: null, is_available: true })
          .eq('id', ambulance.id);
        break;
    }

    await supabaseAdmin
      .from('emergency_requests')
      .update(updateData)
      .eq('id', requestId);

    await this._appendStatusHistory(requestId, newStatus, { by: driverUserId });

    // Notify patient
    const statusMessages = {
      en_route: '🚑 Ambulance is on the way to your location',
      arrived: '📍 Ambulance has arrived at your location',
      picked_up: '🏥 Patient picked up, heading to hospital',
      en_route_hospital: '🏥 En route to hospital',
      arrived_hospital: '🏥 Arrived at hospital',
      completed: '✅ Ambulance service completed. Stay safe!',
      cancelled: '❌ Ambulance request has been cancelled',
    };

    let patientUserId = null;
    if (request.patient_id) {
      const { data: patient } = await supabaseAdmin
        .from('patients').select('user_id').eq('id', request.patient_id).single();
      patientUserId = patient?.user_id;
    }

    if (patientUserId) {
      await notificationService.sendNotification(patientUserId, {
        title: 'Ambulance Update',
        message: statusMessages[newStatus] || `Status: ${newStatus}`,
        type: 'ambulance_update',
        data: { requestId, status: newStatus },
      });

      eventEmitter.emitAmbulanceStatus(requestId, patientUserId, newStatus, {
        message: statusMessages[newStatus] || `Status: ${newStatus}`,
      });
    }

    // Emit to dashboards
    eventEmitter.notifyRoom('ambulance:dispatch', 'emergency:updated', {
      requestId,
      status: newStatus,
      ambulanceId: ambulance.id,
    });

    return { success: true, status: newStatus };
  }

  // ── Patient cancel ─────────────────────────────────────────────
  async cancelByPatient(userId, requestId, reason) {
    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('user_id', userId).single();

    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select('*, vehicle:ambulances(id, driver_user_id)')
      .eq('id', requestId)
      .eq('patient_id', patient?.id || userId)
      .single();

    if (!request) {
      throw new ApiError(404, 'Request not found');
    }

    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new ApiError(400, 'Cannot cancel a completed or already cancelled request');
    }

    await supabaseAdmin
      .from('emergency_requests')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: userId,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    await this._appendStatusHistory(requestId, 'cancelled', { by: userId, reason });

    // Release ambulance if assigned
    if (request.vehicle_id) {
      await supabaseAdmin
        .from('ambulances')
        .update({ status: 'available', current_request_id: null, is_available: true })
        .eq('id', request.vehicle_id);
    }

    // Clear any pending timeouts
    if (this.pendingTimeouts.has(requestId)) {
      clearTimeout(this.pendingTimeouts.get(requestId));
      this.pendingTimeouts.delete(requestId);
    }

    // Notify driver
    const driverUserId = request.vehicle?.driver_user_id;
    if (driverUserId) {
      await notificationService.sendNotification(driverUserId, {
        title: 'Request Cancelled',
        message: 'Patient has cancelled the ambulance request',
        type: 'ambulance_cancelled',
        data: { requestId },
      });

      eventEmitter.notifyUser(driverUserId, 'ambulance:request-cancelled', { requestId });
    }

    eventEmitter.notifyRoom('ambulance:dispatch', 'emergency:updated', {
      requestId,
      status: 'cancelled',
    });

    return { success: true, message: 'Request cancelled successfully' };
  }

  // ══════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ══════════════════════════════════════════════════════════════

  async getAvailableAmbulances(latitude, longitude, radiusKm = 50) {
    const bounds = getBoundingBox({ latitude, longitude }, radiusKm);

    const { data: ambulances, error: ambulancesError } = await supabaseAdmin
      .from('ambulances')
      .select(`
        id, vehicle_number, driver_name, driver_phone, vehicle_type,
        current_latitude, current_longitude, heading, speed,
        status, is_active, operator_id
      `)
      .eq('is_active', true)
      .eq('status', 'available')
      .gte('current_latitude', bounds.minLat)
      .lte('current_latitude', bounds.maxLat)
      .gte('current_longitude', bounds.minLng)
      .lte('current_longitude', bounds.maxLng);

    if (ambulancesError) {
      throw new ApiError(400, `Failed to fetch available ambulances: ${ambulancesError.message}`);
    }

    return (ambulances || []).map(a => {
      const distance = calculateDistance(
        { latitude, longitude },
        { latitude: a.current_latitude, longitude: a.current_longitude }
      );
      return {
        ...a,
        distance,
        distanceText: formatDistance(distance),
        eta: calculateETA(distance, 50),
      };
    }).sort((a, b) => a.distance - b.distance);
  }

  async getActiveEmergenciesForHospital(hospitalUserId) {
    // Get the hospital owned by this user
    const { data: hospital } = await supabaseAdmin
      .from('hospitals')
      .select('id')
      .eq('owner_id', hospitalUserId)
      .single();

    // Get all active emergencies (hospital can see all in their area)
    const { data: emergencies } = await supabaseAdmin
      .from('emergency_requests')
      .select(`
        *,
        vehicle:ambulances(id, vehicle_number, driver_name, driver_phone, vehicle_type, current_latitude, current_longitude),
        patient:patients(id, name, user_id)
      `)
      .in('status', ['pending', 'broadcasting', 'assigned', 'accepted', 'en_route', 'arrived', 'picked_up', 'en_route_hospital'])
      .order('created_at', { ascending: false })
      .limit(50);

    return (emergencies || []).map(e => ({
      id: e.id,
      requestNumber: e.request_number,
      patientName: e.requester_name || e.patient?.name || null,
      patientPhone: e.requester_phone || e.patient?.phone || '',
      location: e.pickup_address,
      latitude: e.pickup_latitude,
      longitude: e.pickup_longitude,
      type: e.emergency_type,
      priority: e.priority || derivePriority(e.emergency_type),
      status: e.status,
      dispatchMode: e.dispatch_mode,
      createdAt: e.created_at,
      assignedAt: e.assigned_at,
      ambulance: e.vehicle ? {
        id: e.vehicle.id,
        vehicleNumber: e.vehicle.vehicle_number,
        driverName: e.vehicle.driver_name,
        driverPhone: e.vehicle.driver_phone,
        type: e.vehicle.vehicle_type,
        latitude: e.vehicle.current_latitude,
        longitude: e.vehicle.current_longitude,
      } : null,
      notes: e.notes,
    }));
  }

  // ── Helper: append to status_history JSONB ──────────────────
  // M3 Fix: Atomic JSONB append via RPC — no read-modify-write race
  async _appendStatusHistory(requestId, status, extra = {}) {
    const entry = {
      status,
      timestamp: new Date().toISOString(),
      ...extra,
    };

    try {
      await supabaseAdmin.rpc('rpc_append_status_history', {
        p_request_id: requestId,
        p_entry: entry,
      });
    } catch (err) {
      // Fallback: if RPC not yet deployed, use legacy read-modify-write
      console.warn('rpc_append_status_history unavailable, using fallback:', err.message);
      const { data: req } = await supabaseAdmin
        .from('emergency_requests')
        .select('status_history')
        .eq('id', requestId)
        .single();

      const history = Array.isArray(req?.status_history) ? req.status_history : [];
      history.push(entry);

      await supabaseAdmin
        .from('emergency_requests')
        .update({ status_history: history })
        .eq('id', requestId);
    }
  }

  // ── Helper: update status with history ──────────────────────
  async _updateRequestStatus(requestId, status, userId, extra = {}) {
    await supabaseAdmin
      .from('emergency_requests')
      .update({ status })
      .eq('id', requestId);

    await this._appendStatusHistory(requestId, status, { by: userId, ...extra });
  }
}

module.exports = new DispatchService();
