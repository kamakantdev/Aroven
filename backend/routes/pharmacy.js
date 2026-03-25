/**
 * Pharmacy Routes
 * API endpoints for pharmacy/medical store operations
 */
const express = require('express');
const router = express.Router();
const pharmacyService = require('../services/pharmacyService');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireApproval, ROLES } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');
const { body, param, query: queryValidator } = require('express-validator');
const { validate } = require('../middleware/validate');

// Public routes
router.get('/search', asyncHandler(async (req, res) => {
    const { city, search, page = 1, limit = 20, deliveryAvailable, isOpen } = req.query;

    const result = await pharmacyService.searchPharmacies(
        {
            city,
            search,
            deliveryAvailable: deliveryAvailable === 'true',
            isOpen: isOpen === 'true',
        },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

router.get('/nearby', asyncHandler(async (req, res) => {
    const { latitude, longitude, medicineId, radius = 10 } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Location required' });
    }

    if (!medicineId) {
        return res.status(400).json({ success: false, message: 'Medicine ID required' });
    }

    const pharmacies = await pharmacyService.findNearbyWithMedicine(
        parseFloat(latitude),
        parseFloat(longitude),
        medicineId,
        parseFloat(radius)
    );

    res.json({ success: true, data: pharmacies });
}));

// Protected routes - require authentication
router.use(authenticate);

// Register pharmacy (C9 Fix: restrict to pharmacy_owner role or new registrants)
// Fix #21: Add input validation
router.post('/register', requireRole(ROLES.PHARMACY_OWNER), [
    body('name').trim().notEmpty().withMessage('Pharmacy name is required').isLength({ max: 200 }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('address').optional().trim().isLength({ max: 500 }),
    body('city').optional().trim().isLength({ max: 100 }),
    body('state').optional().trim().isLength({ max: 100 }),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('license_number').optional().trim().isLength({ max: 100 }),
    validate,
], asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.registerPharmacy(req.user.id, req.body);
    res.status(201).json({ success: true, data: pharmacy });
}));

// Dashboard - aggregate data for pharmacy owner
router.get('/dashboard', requireRole(ROLES.PHARMACY_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    
    // Get inventory with low stock filter
    const inventoryResult = await pharmacyService.getInventory(pharmacy.id, { lowStock: 'true' }, 1, 50);
    const lowStockItems = inventoryResult.items || inventoryResult.data || [];
    
    // Get pending orders
    const ordersResult = await pharmacyService.getOrders(pharmacy.id, { status: 'pending' }, 1, 20);
    const pendingOrders = ordersResult.orders || ordersResult.data || [];
    
    // Calculate today's revenue from delivered/completed orders
    let todaysRevenue = 0;
    try {
        const { supabaseAdmin } = require('../config/supabase');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: revenueData } = await supabaseAdmin
            .from('pharmacy_orders')
            .select('total_amount')
            .eq('pharmacy_id', pharmacy.id)
            .in('status', ['delivered', 'completed'])
            .gte('created_at', today.toISOString());
        if (revenueData && revenueData.length > 0) {
            todaysRevenue = revenueData.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0);
        }
    } catch (e) {
        // Silently fallback to 0 if table/column doesn't exist yet
    }

    // Build dashboard stats
    const stats = {
        newPrescriptions: pendingOrders.length,
        pendingOrders: pendingOrders.length,
        lowStockItems: lowStockItems.length,
        todaysRevenue,
    };
    
    res.json({
        success: true,
        stats,
        pendingPrescriptions: pendingOrders.map(o => ({
            id: o.id,
            patientName: o.patient_name || 'Patient',
            patientId: o.patient_id,
            doctorName: o.doctor_name || 'Doctor',
            items: o.items?.length || 0,
            time: o.created_at,
            status: o.status,
        })),
        lowStockItems: lowStockItems.map(item => ({
            id: item.id,
            name: item.name || item.medicine_name,
            quantity: item.quantity || item.stock,
            minQuantity: item.min_quantity || item.reorder_level || 10,
            unit: item.unit || 'units',
            expiryDate: item.expiry_date,
            isLowStock: true,
        })),
    });
}));

// Get own pharmacy
router.get('/profile', requireRole(ROLES.PHARMACY_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    res.json({ success: true, data: pharmacy });
}));

// Update pharmacy
router.put('/profile', requireRole(ROLES.PHARMACY_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    // Whitelist allowed fields to prevent arbitrary column writes
    const allowed = [
        'name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
        'latitude', 'longitude', 'license_number', 'licenseNumber',
        'opening_time', 'closing_time', 'opening_hours', 'is_24_hours',
        'is_open', 'delivery_available', 'offers_delivery', 'delivery_radius_km',
        'image_url', 'profile_image'
    ];
    const safeUpdates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) safeUpdates[key] = req.body[key];
    }
    const updated = await pharmacyService.updatePharmacy(pharmacy.id, req.user.id, safeUpdates);
    res.json({ success: true, data: updated });
}));

// Inventory routes
router.get('/inventory', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    const { search, lowStock, category, page = 1, limit = 50 } = req.query;

    const result = await pharmacyService.getInventory(
        pharmacy.id,
        { search, lowStock: lowStock === 'true', category },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

router.post('/inventory', requireRole(ROLES.PHARMACY_OWNER), [
    body('name').trim().notEmpty().withMessage('Medicine name is required').isLength({ max: 200 }),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be non-negative'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
    body('expiry_date').optional().isISO8601(),
    validate,
], asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    const item = await pharmacyService.addInventoryItem(pharmacy.id, req.user.id, req.body);
    // #13: Real-time inventory update
    const eventEmitter = require('../services/eventEmitter');
    eventEmitter.emitInventoryUpdated(pharmacy.id, req.user.id, item);
    res.status(201).json({ success: true, item });
}));

router.put('/inventory/:itemId', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    const item = await pharmacyService.updateInventoryItem(
        req.params.itemId,
        pharmacy.id,
        req.user.id,
        req.body
    );
    // #13: Real-time inventory update
    const eventEmitter = require('../services/eventEmitter');
    eventEmitter.emitInventoryUpdated(pharmacy.id, req.user.id, item);
    res.json({ success: true, item });
}));

router.delete('/inventory/:itemId', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    await pharmacyService.deleteInventoryItem(req.params.itemId, pharmacy.id, req.user.id);
    // #13: Real-time inventory update (removed item)
    const eventEmitter = require('../services/eventEmitter');
    eventEmitter.emitInventoryUpdated(pharmacy.id, req.user.id, { id: req.params.itemId, deleted: true });
    res.json({ success: true });
}));

// Orders routes
router.get('/orders', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    const { status, page = 1, limit = 20 } = req.query;

    const result = await pharmacyService.getOrders(
        pharmacy.id,
        { status },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

router.patch('/orders/:orderId/status', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    const { status, notes } = req.body;

    const order = await pharmacyService.updateOrderStatus(
        req.params.orderId,
        pharmacy.id,
        req.user.id,
        status,
        notes
    );

    res.json({ success: true, order });
}));

// Prescriptions routes
router.get('/prescriptions', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const { supabaseAdmin } = require('../config/supabase');

    // Get this owner's pharmacy to scope the query
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);

    // Prescriptions don't have pharmacy_id directly — find prescriptions
    // that have orders placed at this pharmacy via pharmacy_orders.prescription_id
    const { data: orderPrescriptionIds } = await supabaseAdmin
        .from('pharmacy_orders')
        .select('prescription_id')
        .eq('pharmacy_id', pharmacy.id)
        .not('prescription_id', 'is', null);

    const prescriptionIds = (orderPrescriptionIds || [])
        .map(o => o.prescription_id)
        .filter(Boolean);

    if (prescriptionIds.length === 0) {
        return res.json({
            success: true,
            data: [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, totalPages: 0 }
        });
    }

    let query = supabaseAdmin
        .from('prescriptions')
        .select(`
            *,
            prescription_medicines (*),
            patients (id, name),
            doctors (id, name, specialization)
        `, { count: 'exact' })
        .in('id', prescriptionIds)
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data, error, count } = await query.range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
        success: true,
        data: data || [],
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || 0,
            totalPages: Math.ceil((count || 0) / parseInt(limit)),
        },
    });
}));

router.patch('/prescriptions/:prescriptionId/dispense', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const { supabaseAdmin } = require('../config/supabase');

    // Verify this pharmacy has an order linked to this prescription
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    const { data: linkedOrder } = await supabaseAdmin
        .from('pharmacy_orders')
        .select('id')
        .eq('pharmacy_id', pharmacy.id)
        .eq('prescription_id', req.params.prescriptionId)
        .limit(1)
        .maybeSingle();

    if (!linkedOrder) {
        return res.status(403).json({ success: false, message: 'This prescription is not linked to your pharmacy' });
    }

    const { data, error } = await supabaseAdmin
        .from('prescriptions')
        .update({
            is_dispensed: true,
            dispensed_at: new Date().toISOString(),
            dispensed_by: req.user.id,
            status: 'fulfilled',
        })
        .eq('id', req.params.prescriptionId)
        .select()
        .single();

    if (error) throw error;

    res.json({ success: true, data });
}));

// Analytics
router.get('/analytics', requireRole(ROLES.PHARMACY_OWNER), asyncHandler(async (req, res) => {
    const pharmacy = await pharmacyService.getPharmacyByOwner(req.user.id);
    const { period = '30d' } = req.query;

    const analytics = await pharmacyService.getAnalytics(pharmacy.id, req.user.id, period);
    res.json({ success: true, ...analytics });
}));

module.exports = router;
