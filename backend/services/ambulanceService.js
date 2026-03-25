const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { calculateDistance, formatDistance, calculateETA, sortByDistance, getBoundingBox } = require('../utils/geo');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('./notificationService');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');

class AmbulanceService {
  constructor() {
    // M5 Fix: No more in-memory Maps — all state stored in Redis
    // Redis keys:
    //   ambulance:loc:<ambulanceId>  → JSON { latitude, longitude, heading, speed, updatedAt }
    //   ambulance:req:<requestId>    → JSON { ...sosRequest, ambulance }
  }

  // Request ambulance (SOS) — C11 Fix: atomic dispatch via RPC
  async requestAmbulance(userId, requestData) {
    const { latitude, longitude, emergencyType, patientName, patientPhone, notes } = requestData;

    // Get patient info
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, name, user_id')
      .eq('user_id', userId)
      .single();

    // Find nearest available ambulances
    const nearbyAmbulances = await this.getNearbyAmbulances(latitude, longitude, 25);

    if (nearbyAmbulances.length === 0) {
      throw new ApiError(404, 'No ambulances available in your area');
    }

    // Get the nearest available ambulance
    const nearestAmbulance = nearbyAmbulances[0];

    // Create SOS request
    const requestId = uuidv4();
    const { data: sosRequest, error } = await supabaseAdmin
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
        notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(400, 'Failed to request ambulance');
    }

    // C11: Atomic dispatch — updates request status + locks ambulance in one TX
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('rpc_dispatch_ambulance', {
      p_request_id: requestId,
      p_ambulance_id: nearestAmbulance.id,
    });

    if (rpcError || !rpcResult?.success) {
      // Fallback: if RPC fails, clean up the pending request
      await supabaseAdmin.from('emergency_requests').delete().eq('id', requestId);
      throw new ApiError(400, rpcResult?.reason === 'ambulance_unavailable'
        ? 'Selected ambulance is no longer available'
        : 'Failed to dispatch ambulance');
    }

    // Notify ambulance driver
    await notificationService.sendNotification(nearestAmbulance.driver_user_id, {
      title: '🚨 Emergency Request',
      message: `New emergency pickup request at ${notes || 'patient location'}`,
      type: 'ambulance_request',
      data: {
        requestId,
        pickupLatitude: latitude,
        pickupLongitude: longitude,
        emergencyType,
      },
    });

    // M5: Store active request in Redis instead of in-memory Map
    try {
      await cacheSet(`ambulance:req:${requestId}`, JSON.stringify({
        ...sosRequest,
        ambulance: nearestAmbulance,
      }), 86400); // 24h TTL
    } catch (_) { /* non-fatal */ }

    // Emit Socket.IO events so ambulance-app and patient get real-time updates
    const eventEmitter = require('./eventEmitter');
    eventEmitter.emitEmergencyRequest({
      requestId,
      patient_id: patient?.id,
      pickupLatitude: latitude,
      pickupLongitude: longitude,
      emergencyType: emergencyType || 'medical',
    });
    // Notify patient via Socket that ambulance has been assigned
    if (patient?.user_id) {
      eventEmitter.emitAmbulanceAssigned({
        patient_id: patient.user_id,
        requestId,
        ambulance: {
          id: nearestAmbulance.id,
          vehicleNumber: nearestAmbulance.vehicle_number,
          driverName: nearestAmbulance.driver_name,
          driverPhone: nearestAmbulance.driver_phone,
        },
      });
    }

    return {
      requestId,
      ambulance: {
        id: nearestAmbulance.id,
        vehicleNumber: nearestAmbulance.vehicle_number,
        driverName: nearestAmbulance.driver_name,
        driverPhone: nearestAmbulance.driver_phone,
        type: nearestAmbulance.type,
        currentLocation: {
          latitude: nearestAmbulance.latitude,
          longitude: nearestAmbulance.longitude,
        },
      },
      estimatedArrival: nearestAmbulance.eta,
      distance: nearestAmbulance.distanceText,
      status: 'dispatched',
      message: 'Ambulance has been dispatched to your location',
    };
  }

  // Get nearby available ambulances
  async getNearbyAmbulances(latitude, longitude, radiusKm = 25) {
    const bounds = getBoundingBox({ latitude, longitude }, radiusKm);

    const { data: ambulances, error } = await supabaseAdmin
      .from('ambulances')
      .select(`
        *,
        hospital:hospitals(id, name, phone)
      `)
      .eq('is_active', true)
      .eq('status', 'available')
      .gte('current_latitude', bounds.minLat)
      .lte('current_latitude', bounds.maxLat)
      .gte('current_longitude', bounds.minLng)
      .lte('current_longitude', bounds.maxLng);

    if (error) {
      throw new ApiError(400, 'Failed to fetch ambulances');
    }

    const operatorIds = [...new Set((ambulances || []).map((amb) => amb.operator_id).filter(Boolean))];
    let approvedOperatorIds = new Set();

    if (operatorIds.length > 0) {
      const { data: operators, error: operatorError } = await supabaseAdmin
        .from('ambulance_operators')
        .select('id')
        .in('id', operatorIds)
        .eq('is_active', true)
        .eq('is_approved', true)
        .eq('approval_status', 'approved');

      if (operatorError) {
        throw new ApiError(400, 'Failed to verify ambulance operators');
      }

      approvedOperatorIds = new Set((operators || []).map((operator) => operator.id));
    }

    // Calculate distance and sort
    const ambulancesWithDistance = (ambulances || []).map(amb => {
      const distance = calculateDistance(
        { latitude, longitude },
        { latitude: amb.current_latitude, longitude: amb.current_longitude }
      );
      return {
        ...amb,
        latitude: amb.current_latitude,
        longitude: amb.current_longitude,
        distance,
        distanceText: formatDistance(distance),
        eta: calculateETA(distance, 50), // 50 km/h average speed for ambulance
      };
    }).filter(amb => approvedOperatorIds.has(amb.operator_id) && amb.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return ambulancesWithDistance;
  }

  // Update ambulance location (for driver/operator app)
  async updateAmbulanceLocation(driverUserId, locationData) {
    const { latitude, longitude, heading, speed } = locationData;

    // Resolve operator record (if user logs in as ambulance_operator)
    const { data: operator } = await supabaseAdmin
      .from('ambulance_operators')
      .select('id')
      .eq('user_id', driverUserId)
      .maybeSingle();

    // Get ambulance by driver OR operator mapping
    let ambulanceQuery = supabaseAdmin
      .from('ambulances')
      .select('id, current_request_id')
      .eq('driver_user_id', driverUserId);

    if (operator?.id) {
      ambulanceQuery = supabaseAdmin
        .from('ambulances')
        .select('id, current_request_id')
        .or(`driver_user_id.eq.${driverUserId},operator_id.eq.${operator.id}`);
    }

    const { data: ambulance } = await ambulanceQuery.limit(1).maybeSingle();

    if (!ambulance) {
      throw new ApiError(404, 'Ambulance not found');
    }

    // Update in database
    await supabaseAdmin
      .from('ambulances')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        heading,
        speed,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', ambulance.id);

    // M5: Store in Redis for real-time access (replaces in-memory Map)
    try {
      await cacheSet(`ambulance:loc:${ambulance.id}`, JSON.stringify({
        latitude,
        longitude,
        heading,
        speed,
        updatedAt: new Date().toISOString(),
      }), 300); // 5 min TTL — stale locations expire automatically
    } catch (_) { /* non-fatal */ }

    // Log location ping to MongoDB (high-frequency, with TTL)
    try {
      const { AmbulanceLocation } = require('../database/models');
      if (AmbulanceLocation) {
        await AmbulanceLocation.create({
          ambulanceId: ambulance.id,
          requestId: ambulance.current_request_id,
          latitude,
          longitude,
          heading,
          speed,
          timestamp: new Date(),
        });
      }
    } catch (mongoError) {
      // Fallback to Supabase if MongoDB unavailable
      console.warn('MongoDB unavailable for location ping, using Supabase');
      await supabaseAdmin
        .from('ambulance_location_pings')
        .insert({
          ambulance_id: ambulance.id,
          latitude,
          longitude,
          heading,
          speed,
          request_id: ambulance.current_request_id,
        });
    }

    return { success: true };
  }

  // Get ambulance location for tracking
  async getAmbulanceLocation(requestId) {
    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select(`
        *,
        vehicle:ambulances(
          id, vehicle_number, driver_name, driver_phone, vehicle_type,
          current_latitude, current_longitude, heading, speed
        )
      `)
      .eq('id', requestId)
      .single();

    if (!request) {
      throw new ApiError(404, 'Request not found');
    }

    // Join alias is 'vehicle' — use request.vehicle.* for ambulance data
    const vehicle = request.vehicle || {};

    // M5: Get real-time location from Redis if available (replaces in-memory Map)
    let realtimeLocation = null;
    try {
      const cached = await cacheGet(`ambulance:loc:${request.vehicle_id}`);
      if (cached) realtimeLocation = JSON.parse(cached);
    } catch (_) { /* fallback to DB */ }

    const currentLocation = realtimeLocation || {
      latitude: vehicle.current_latitude,
      longitude: vehicle.current_longitude,
      heading: vehicle.heading,
      speed: vehicle.speed,
    };

    const hasLiveCoords = Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude);

    if (!request.vehicle_id || !hasLiveCoords) {
      return {
        requestId,
        status: request.status,
        ambulance: request.vehicle_id ? {
          id: request.vehicle_id,
          vehicleNumber: vehicle.vehicle_number,
          driverName: vehicle.driver_name,
          driverPhone: vehicle.driver_phone,
          type: vehicle.vehicle_type,
        } : null,
        currentLocation: hasLiveCoords ? currentLocation : null,
        pickupLocation: {
          latitude: request.pickup_latitude,
          longitude: request.pickup_longitude,
        },
        distance: null,
        estimatedArrival: null,
      };
    }

    // Calculate current distance and ETA
    const distance = calculateDistance(
      { latitude: request.pickup_latitude, longitude: request.pickup_longitude },
      currentLocation
    );

    return {
      requestId,
      status: request.status,
      ambulance: {
        id: request.vehicle_id,
        vehicleNumber: vehicle.vehicle_number,
        driverName: vehicle.driver_name,
        driverPhone: vehicle.driver_phone,
        type: vehicle.vehicle_type,
      },
      currentLocation,
      pickupLocation: {
        latitude: request.pickup_latitude,
        longitude: request.pickup_longitude,
      },
      distance: formatDistance(distance),
      estimatedArrival: calculateETA(distance, 50),
    };
  }

  // Update request status (for driver)
  async updateRequestStatus(driverUserId, requestId, status, data = {}) {
    const { data: ambulance } = await supabaseAdmin
      .from('ambulances')
      .select('id')
      .eq('driver_user_id', driverUserId)
      .single();

    if (!ambulance) {
      throw new ApiError(404, 'Ambulance not found');
    }

    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select('*')
      .eq('id', requestId)
      .eq('vehicle_id', ambulance.id)
      .single();

    if (!request) {
      throw new ApiError(404, 'Request not found');
    }

    const updateData = { status };

    if (status === 'arrived' || status === 'arrived_pickup') {
      updateData.pickup_arrived_at = new Date().toISOString();
    } else if (status === 'picked_up' || status === 'patient_onboard') {
      updateData.patient_loaded_at = new Date().toISOString();
      if (data.hospitalId) updateData.destination_hospital_id = data.hospitalId;
      if (data.destinationAddress) updateData.destination_address = data.destinationAddress;
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();

      // Make ambulance available again
      await supabaseAdmin
        .from('ambulances')
        .update({
          status: 'available',
          current_request_id: null,
        })
        .eq('id', ambulance.id);
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancellation_reason = data.reason;

      // Make ambulance available again
      await supabaseAdmin
        .from('ambulances')
        .update({
          status: 'available',
          current_request_id: null,
        })
        .eq('id', ambulance.id);
    }

    await supabaseAdmin
      .from('emergency_requests')
      .update(updateData)
      .eq('id', requestId);

    // Notify patient — resolve user_id from patient_id FK
    const statusMessages = {
      en_route: 'Ambulance is on the way to your location',
      arrived: 'Ambulance has arrived at your location',
      picked_up: 'Patient picked up, heading to hospital',
      completed: 'Ambulance service completed',
      cancelled: 'Ambulance request has been cancelled',
    };

    // emergency_requests stores patient_id (FK to patients table), NOT user_id
    // We need the user_id for Socket.IO notification routing
    let patientUserId = null;
    if (request.patient_id) {
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('user_id')
        .eq('id', request.patient_id)
        .single();
      patientUserId = patient?.user_id;
    }

    if (patientUserId) {
      await notificationService.sendNotification(patientUserId, {
        title: 'Ambulance Update',
        message: statusMessages[status] || `Status updated to ${status}`,
        type: 'ambulance_update',
        data: { requestId, status },
      });

      const eventEmitter = require('./eventEmitter');
      eventEmitter.emitAmbulanceStatus(requestId, patientUserId, status, {
        message: statusMessages[status] || `Status updated to ${status}`
      });
    }

    return { success: true, status };
  }

  // Cancel request (by patient)
  async cancelRequest(userId, requestId, reason) {
    // userId here is the user_id of the patient (from JWT), but emergency_requests
    // stores patient_id (FK to patients table), so look up patient first
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    const { data: request } = await supabaseAdmin
      .from('emergency_requests')
      .select('*, vehicle:ambulances(id, driver_user_id)')
      .eq('id', requestId)
      .eq('patient_id', patient?.id || userId)
      .single();

    if (!request) {
      throw new ApiError(404, 'Request not found');
    }

    if (['completed', 'cancelled'].includes(request.status)) {
      throw new ApiError(400, 'Cannot cancel this request');
    }

    // Update request
    await supabaseAdmin
      .from('emergency_requests')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // Make ambulance available (only if one was assigned)
    if (request.vehicle_id) {
      await supabaseAdmin
        .from('ambulances')
        .update({
          status: 'available',
          current_request_id: null,
        })
        .eq('id', request.vehicle_id);
    }

    // Notify driver (resolve from vehicle join)
    const driverUserId = request.vehicle?.driver_user_id;
    if (driverUserId) {
      await notificationService.sendNotification(driverUserId, {
        title: 'Request Cancelled',
        message: 'Patient has cancelled the ambulance request',
        type: 'ambulance_cancelled',
        data: { requestId },
      });
    }

    // M5: Clean up Redis cache instead of in-memory Map
    try { await cacheDel(`ambulance:req:${requestId}`); } catch (_) { /* non-fatal */ }

    return { success: true, message: 'Request cancelled successfully' };
  }

  // Get request history
  async getRequestHistory(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    // Try to resolve the user as a patient first
    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('user_id', userId).single();

    // Also try to resolve the user as an ambulance driver
    const { data: ambulance } = await supabaseAdmin
      .from('ambulances').select('id').eq('driver_user_id', userId).single();

    // Build the query — filter by patient_id OR ambulance_id depending on who's calling
    let query = supabaseAdmin
      .from('emergency_requests')
      .select(`
        *,
        vehicle:ambulances(vehicle_number, driver_name, vehicle_type),
        hospital:hospitals(name, address)
      `, { count: 'exact' });

    if (patient?.id && ambulance?.id) {
      // User is both — unlikely but handle it: return requests for either
      query = query.or(`patient_id.eq.${patient.id},ambulance_id.eq.${ambulance.id}`);
    } else if (patient?.id) {
      query = query.eq('patient_id', patient.id);
    } else if (ambulance?.id) {
      query = query.eq('ambulance_id', ambulance.id);
    } else {
      // User is neither patient nor driver — return empty
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    const { data: requests, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ApiError(400, 'Failed to fetch request history');
    }

    return {
      data: requests || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  // Get ambulance types
  getAmbulanceTypes() {
    return [
      { id: 'basic', name: 'Basic Life Support', icon: '🚑', description: 'For non-critical emergencies' },
      { id: 'advanced', name: 'Advanced Life Support', icon: '🏥', description: 'For critical emergencies with medical equipment' },
      { id: 'icu', name: 'ICU Ambulance', icon: '⚕️', description: 'Mobile ICU for critical patients' },
      { id: 'neonatal', name: 'Neonatal', icon: '👶', description: 'For newborn emergencies' },
    ];
  }
}

module.exports = new AmbulanceService();
