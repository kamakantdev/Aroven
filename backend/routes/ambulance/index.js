/**
 * Ambulance Routes — Production-Ready Dispatch System
 *
 * Supports TWO dispatch models:
 *   1) SOS Broadcast  — POST /request/sos  (patient SOS → broadcast → first-accept locks)
 *   2) Hospital Manual — POST /request/hospital (hospital creates → assigns ambulance independently)
 *
 * Driver flow:  POST /:requestId/accept | /:requestId/reject
 * Hospital:     POST /:requestId/assign | GET /available | GET /hospital/emergencies
 * Admin:        Monitor-only via /api/admin/emergencies (no dispatch control)
 * Tracking:     GET  /track/:requestId | PUT /location | PUT /request/:requestId/status
 */
const express = require('express');
const { query, body } = require('express-validator');
const { validate, validateUUID } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { requireRole, requireApproval, ROLES } = require('../../middleware/rbac');
const ambulanceService = require('../../services/ambulanceService');
const dispatchService = require('../../services/dispatchService');
const { asyncHandler } = require('../../middleware/errorHandler');
const { supabaseAdmin } = require('../../config/supabase');

const router = express.Router();

const getVehiclesForUser = async (user) => {
  let query = supabaseAdmin.from('ambulances').select('*').order('created_at', { ascending: false });

  if (user.role === ROLES.AMBULANCE_OPERATOR) {
    const { data: operator } = await supabaseAdmin
      .from('ambulance_operators')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!operator) return [];
    query = query.eq('operator_id', operator.id);
  } else if (user.role === ROLES.AMBULANCE_DRIVER) {
    query = query.eq('driver_user_id', user.id);
  }

  const { data: vehicles } = await query;
  return vehicles || [];
};

// =====================================================================
// PUBLIC
// =====================================================================

router.get('/types', asyncHandler(async (req, res) => {
  res.json({ success: true, data: ambulanceService.getAmbulanceTypes() });
}));

router.get('/nearby', authenticate,
  [query('latitude').isFloat(), query('longitude').isFloat()], validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 25 } = req.query;
    const data = await ambulanceService.getNearbyAmbulances(+latitude, +longitude, +radius);
    res.json({ success: true, data });
  })
);

// =====================================================================
// PATIENT — SOS Broadcast Dispatch
// =====================================================================

router.post('/request/sos', authenticate,
  [body('latitude').isFloat(), body('longitude').isFloat(),
   body('emergencyType').optional().isIn(['medical','general','cardiac','accident','trauma','pregnancy','other'])],
  validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.requestSOS(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  })
);

// Legacy route — backward-compatible with existing patient app
router.post('/request', authenticate,
  [body('latitude').isFloat(), body('longitude').isFloat(),
   body('emergencyType').optional().isIn(['medical','general','cardiac','accident','trauma','pregnancy','other'])],
  validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.requestSOS(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  })
);

router.post('/cancel/:requestId', authenticate,
  [validateUUID('requestId'), body('reason').optional().isString()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.cancelByPatient(req.user.id, req.params.requestId, req.body.reason);
    res.json({ success: true, ...result });
  })
);

router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await ambulanceService.getRequestHistory(req.user.id, +page, +limit);
  res.json({ success: true, ...result });
}));

// =====================================================================
// DRIVER — Accept / Reject / Status / Location
// =====================================================================

router.post('/:requestId/accept', authenticate,
  requireRole(ROLES.AMBULANCE_OPERATOR, ROLES.AMBULANCE_DRIVER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  [validateUUID('requestId')], validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.acceptRequest(req.user.id, req.params.requestId);
    res.json({ success: true, data: result });
  })
);

router.post('/:requestId/reject', authenticate,
  requireRole(ROLES.AMBULANCE_OPERATOR, ROLES.AMBULANCE_DRIVER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  [validateUUID('requestId')], validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.rejectRequest(req.user.id, req.params.requestId);
    res.json({ success: true, data: result });
  })
);

router.put('/location', authenticate,
  requireRole(ROLES.AMBULANCE_OPERATOR, ROLES.AMBULANCE_DRIVER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  [body('latitude').isFloat(), body('longitude').isFloat(),
   body('heading').optional().isFloat(), body('speed').optional().isFloat()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await ambulanceService.updateAmbulanceLocation(req.user.id, req.body);
    res.json({ success: true, ...result });
  })
);

router.put('/request/:requestId/status', authenticate,
  requireRole(ROLES.AMBULANCE_OPERATOR, ROLES.AMBULANCE_DRIVER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  [validateUUID('requestId'), body('status').isIn(['en_route','arrived','picked_up','en_route_hospital','arrived_hospital','completed','cancelled'])],
  validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.updateStatus(req.user.id, req.params.requestId, req.body.status, req.body);
    res.json({ success: true, ...result });
  })
);

// =====================================================================
// HOSPITAL — Controlled Dispatch
// =====================================================================

router.post('/request/hospital', authenticate,
  requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER),
  [body('latitude').isFloat(), body('longitude').isFloat(),
   body('emergencyType').optional().isIn(['medical','general','cardiac','accident','trauma','pregnancy','other']),
   body('patientName').optional().isString(), body('patientPhone').optional().isString()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.createHospitalRequest(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  })
);

router.post('/:requestId/assign', authenticate,
  requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER, ROLES.AMBULANCE_OPERATOR),
  [
    validateUUID('requestId'),
    body('ambulanceId')
      .isString()
      .matches(/^[0-9a-fA-F-]{36}$/)
      .withMessage('ambulanceId must be a valid UUID-like identifier'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.hospitalAssignAmbulance(req.user.id, req.params.requestId, req.body.ambulanceId);
    res.json({ success: true, data: result });
  })
);

router.get('/available', authenticate,
  requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER, ROLES.AMBULANCE_OPERATOR),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 50 } = req.query;
    if (!latitude || !longitude) return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
    const data = await dispatchService.getAvailableAmbulances(+latitude, +longitude, +radius);
    res.json({ success: true, data });
  })
);

router.get('/hospital/emergencies', authenticate,
  requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER),
  asyncHandler(async (req, res) => {
    const data = await dispatchService.getActiveEmergenciesForHospital(req.user.id);
    res.json({ success: true, data });
  })
);

// =====================================================================
// OPERATOR DASHBOARD
// =====================================================================

router.get('/dashboard', authenticate,
  requireRole(ROLES.AMBULANCE_OPERATOR, ROLES.AMBULANCE_DRIVER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requireApproval,
  asyncHandler(async (req, res) => {
    const vehicles = await getVehiclesForUser(req.user);
    const vehicleIds = (vehicles || []).map(v => v.id);

    let activeRequests = [];
    if (vehicleIds.length > 0) {
      const { data } = await supabaseAdmin.from('emergency_requests').select('*')
        .in('vehicle_id', vehicleIds)
        .in('status', ['pending','assigned','accepted','broadcasting','dispatched','en_route','arrived','picked_up','en_route_hospital'])
        .order('created_at', { ascending: false }).limit(20);
      activeRequests = data || [];
    }

    // Also include unassigned SOS broadcasts
    const { data: broadcastRequests } = await supabaseAdmin.from('emergency_requests').select('*')
      .in('status', ['pending', 'broadcasting']).order('created_at', { ascending: false }).limit(10);
    const allRequests = [...activeRequests];
    (broadcastRequests || []).forEach(br => { if (!allRequests.find(ar => ar.id === br.id)) allRequests.push(br); });

    const today = new Date().toISOString().split('T')[0];
    let completedToday = 0;
    if (vehicleIds.length > 0) {
      const { count } = await supabaseAdmin.from('emergency_requests').select('*', { count: 'exact', head: true })
        .in('vehicle_id', vehicleIds).eq('status', 'completed').gte('created_at', today + 'T00:00:00Z');
      completedToday = count || 0;
    }

    // Real avg response time
    let avgResponseTime = 'N/A';
    if (vehicleIds.length > 0) {
      const { data: completed } = await supabaseAdmin.from('emergency_requests')
        .select('created_at, assigned_at').in('vehicle_id', vehicleIds).eq('status', 'completed')
        .not('assigned_at', 'is', null).order('created_at', { ascending: false }).limit(20);
      if (completed?.length > 0) {
        const totalMin = completed.reduce((s, r) => s + (new Date(r.assigned_at) - new Date(r.created_at)) / 60000, 0);
        avgResponseTime = `${Math.round(totalMin / completed.length)} min`;
      }
    }

    const activeEmergencies = allRequests.map(r => ({
      id: r.id, requestNumber: r.request_number,
      priority: r.priority || (r.emergency_type === 'cardiac' || r.emergency_type === 'accident' ? 'critical' : r.emergency_type === 'pregnancy' ? 'high' : 'normal'),
      location: r.pickup_address || `${r.pickup_latitude}, ${r.pickup_longitude}`,
      latitude: r.pickup_latitude, longitude: r.pickup_longitude,
      status: r.status, dispatchMode: r.dispatch_mode, time: r.created_at,
      emergencyType: r.emergency_type, requesterName: r.requester_name,
      requesterPhone: r.requester_phone,
      // Aliases for ambulance app DTO compatibility (EmergencyDto uses @SerializedName)
      patient_name: r.requester_name, patient_phone: r.requester_phone,
      patientName: r.requester_name, patientPhone: r.requester_phone,
      pickup_latitude: r.pickup_latitude, pickup_longitude: r.pickup_longitude,
      pickup_address: r.pickup_address, emergency_type: r.emergency_type,
      dispatch_mode: r.dispatch_mode, broadcast_round: r.broadcast_round,
      created_at: r.created_at,
      vehicleId: r.vehicle_id, notes: r.notes,
    }));

    const vehicleList = (vehicles || []).map(v => ({
      id: v.id, vehicleNumber: v.vehicle_number, driver: v.driver_name || null,
      driverPhone: v.driver_phone, status: v.status || 'available', type: v.vehicle_type,
      latitude: v.current_latitude, longitude: v.current_longitude,
    }));

    res.json({
      success: true,
      stats: { activeEmergencies: activeEmergencies.length, availableVehicles: vehicleList.filter(v => v.status === 'available').length, completedToday, avgResponseTime },
      activeEmergencies, vehicles: vehicleList,
    });
  })
);

router.get('/vehicles', authenticate,
  requireRole(ROLES.AMBULANCE_OPERATOR, ROLES.AMBULANCE_DRIVER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const vehicles = await getVehiclesForUser(req.user);
    res.json({ success: true, vehicles: (vehicles || []).map(v => ({
      id: v.id, vehicleNumber: v.vehicle_number, driver: v.driver_name || null,
      driverPhone: v.driver_phone, status: v.status || 'available', type: v.vehicle_type,
      latitude: v.current_latitude, longitude: v.current_longitude,
    })) });
  })
);

// =====================================================================
// TRACKING
// =====================================================================

router.get('/track/:requestId', authenticate,
  [validateUUID('requestId')], validate,
  asyncHandler(async (req, res) => {
  const { data: reqData, error: reqError } = await supabaseAdmin
    .from('emergency_requests')
    .select('id, patient_id, vehicle:ambulances(id, operator_id), patient:patients(id, user_id)')
    .eq('id', req.params.requestId)
    .maybeSingle();

  if (reqError || !reqData) {
    return res.status(404).json({ success: false, message: 'Emergency request not found' });
  }

  let isPatient = reqData.patient?.user_id === req.user.id;
  if (!isPatient && req.user.role === 'patient' && reqData.patient_id) {
    const { data: mePatient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();
    isPatient = mePatient?.id === reqData.patient_id;
  }

  const isOperator = reqData.vehicle?.operator_id === req.user.id;
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  const isHospitalOwner = ['hospital_owner', 'hospital_manager'].includes(req.user.role);
  const isAmbulanceRole = ['ambulance_operator', 'ambulance_driver'].includes(req.user.role);

  if (!isPatient && !isOperator && !isAdmin && !isHospitalOwner && !isAmbulanceRole) {
    return res.status(403).json({ success: false, message: 'You do not have permission to track this request' });
  }

  const data = await ambulanceService.getAmbulanceLocation(req.params.requestId);
  res.json({ success: true, data });
}));

router.get('/request/:id', authenticate,
  [validateUUID('id')], validate,
  asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('emergency_requests')
    .select('*, vehicle:ambulances(id, vehicle_number, driver_name, driver_phone, vehicle_type, current_latitude, current_longitude, operator_id), patient:patients(id, name, user_id)')
    .eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ success: false, message: 'Emergency request not found' });

  // SECURITY FIX: Ownership check — only the patient, the assigned driver/operator, or admin can view
  let isPatient = data.patient?.user_id === req.user.id;
  if (!isPatient && req.user.role === 'patient') {
    // Fallback 1: match via patients table (patient_id → patients.id → user_id)
    if (data.patient_id) {
      const { data: mePatient } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('user_id', req.user.id)
        .maybeSingle();
      if (mePatient?.id === data.patient_id) isPatient = true;
    }
    // Fallback 2: match by user_id stored directly on the request
    if (!isPatient && data.user_id === req.user.id) isPatient = true;
    // Fallback 3: look up the patient row for this user and compare
    if (!isPatient) {
      const { data: mePatient2 } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('user_id', req.user.id)
        .maybeSingle();
      if (mePatient2) {
        const { data: reqCheck } = await supabaseAdmin
          .from('emergency_requests')
          .select('id')
          .eq('id', req.params.id)
          .eq('patient_id', mePatient2.id)
          .maybeSingle();
        if (reqCheck) isPatient = true;
      }
    }
  }
  const isOperator = data.vehicle?.operator_id === req.user.id;
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  const isHospitalOwner = ['hospital_owner', 'hospital_manager'].includes(req.user.role);
  const isAmbulanceRole = ['ambulance_operator', 'ambulance_driver'].includes(req.user.role);

  if (!isPatient && !isOperator && !isAdmin && !isHospitalOwner && !isAmbulanceRole) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view this request' });
  }

  res.json({ success: true, data: {
    ...data,
    ambulance: data.vehicle ? { id: data.vehicle.id, vehicleNumber: data.vehicle.vehicle_number,
      driverName: data.vehicle.driver_name, driverPhone: data.vehicle.driver_phone,
      type: data.vehicle.vehicle_type, latitude: data.vehicle.current_latitude, longitude: data.vehicle.current_longitude } : null,
  } });
}));

module.exports = router;
