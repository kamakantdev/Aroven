/**
 * Pharmacy Service
 * Inventory, orders, analytics for pharmacy owners
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const eventEmitter = require('./eventEmitter');
const { calculateDistance, getBoundingBox, formatDistance } = require('../utils/geo');
const { maybeGeocodeLocationUpdates } = require('../utils/geocoding');
const { sanitizeSearch } = require('../utils/sanitize');

const enrichMissingPhonesFromOwners = async (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const ownerIdsNeedingFallback = [
    ...new Set(
      rows
        .filter((row) => row && !row.phone && row.owner_id)
        .map((row) => row.owner_id)
    ),
  ];

  if (ownerIdsNeedingFallback.length === 0) return rows;

  const { data: owners, error } = await supabaseAdmin
    .from('users')
    .select('id, phone')
    .in('id', ownerIdsNeedingFallback);

  if (error || !owners) return rows;

  const ownerPhoneById = new Map(
    owners
      .filter((owner) => owner?.id && owner?.phone)
      .map((owner) => [owner.id, owner.phone])
  );

  return rows.map((row) => {
    if (row?.phone || !row?.owner_id) return row;
    const fallbackPhone = ownerPhoneById.get(row.owner_id);
    return fallbackPhone ? { ...row, phone: fallbackPhone } : row;
  });
};

// Search pharmacies globally (not limited to nearby)
const searchPharmacies = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('pharmacies')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .eq('is_approved', true);

  if (filters.city) query = query.ilike('city', `%${sanitizeSearch(filters.city)}%`);
  if (filters.deliveryAvailable === true) query = query.eq('delivery_available', true);
  if (filters.isOpen === true) query = query.eq('is_open', true);
  if (filters.search) {
    const s = sanitizeSearch(filters.search);
    if (s) query = query.or(`name.ilike.%${s}%,city.ilike.%${s}%,address.ilike.%${s}%`);
  }

  const { data, error, count } = await query
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const recordsWithPhone = await enrichMissingPhonesFromOwners(data || []);

  return {
    data: recordsWithPhone,
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Find nearby pharmacies with a specific medicine
const findNearbyWithMedicine = async (latitude, longitude, medicineId, radius = 10) => {
  const bounds = getBoundingBox({ latitude, longitude }, radius);

  // Get active pharmacies within bounding box
  const { data: pharmacies } = await supabaseAdmin
    .from('pharmacies')
    .select('*')
    .eq('is_active', true)
    .eq('is_approved', true)
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng);

  if (!pharmacies || pharmacies.length === 0) return [];

  // Filter by distance
  const pharmaciesWithPhone = await enrichMissingPhonesFromOwners(pharmacies || []);

  let nearby = pharmaciesWithPhone
    .map((p) => {
      const dist = calculateDistance({ latitude, longitude }, { latitude: p.latitude, longitude: p.longitude });
      return { ...p, distance: dist, distanceText: formatDistance(dist) };
    })
    .filter((p) => p.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  // If medicineId provided, filter pharmacies that carry this medicine
  if (medicineId) {
    const pharmacyIds = nearby.map(p => p.id);
    const { data: inventory } = await supabaseAdmin
      .from('pharmacy_inventory')
      .select('pharmacy_id')
      .eq('medicine_id', medicineId)
      .in('pharmacy_id', pharmacyIds)
      .gt('stock', 0);

    if (inventory && inventory.length > 0) {
      const pharmaciesWithMedicine = new Set(inventory.map(i => i.pharmacy_id));
      nearby = nearby.filter(p => pharmaciesWithMedicine.has(p.id));
    } else {
      return []; // No pharmacy carries this medicine
    }
  }

  return nearby;
};

// Register pharmacy
const registerPharmacy = async (userId, data) => {
  const { data: pharmacy, error } = await supabaseAdmin
    .from('pharmacies')
    .insert({
      owner_id: userId,
      name: data.name,
      license_number: data.licenseNumber,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      latitude: data.latitude,
      longitude: data.longitude,
      is_active: false, // Pending admin approval
      is_24_hours: data.is24Hours || false,
      delivery_available: data.deliveryAvailable || false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return pharmacy;
};

// Get pharmacy by owner
const getPharmacyByOwner = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('pharmacies')
    .select('*')
    .eq('owner_id', userId)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Pharmacy not found for this user');
  }

  const [recordWithPhone] = await enrichMissingPhonesFromOwners([data]);
  return recordWithPhone || data;
};

// Update pharmacy
const updatePharmacy = async (pharmacyId, userId, updates) => {
  const { data: existingPharmacy, error: existingPharmacyError } = await supabaseAdmin
    .from('pharmacies')
    .select('id, owner_id, address, city, state, pincode, latitude, longitude')
    .eq('id', pharmacyId)
    .eq('owner_id', userId)
    .single();

  if (existingPharmacyError || !existingPharmacy) {
    throw existingPharmacyError || new ApiError(404, 'Pharmacy not found');
  }

  // Whitelist allowed update fields to prevent mass-assignment
  const allowedFields = ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
    'latitude', 'longitude', 'is_24_hours', 'delivery_available', 'description',
    'opening_hours', 'profile_image_url'];
  const safeUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }
  Object.assign(safeUpdates, await maybeGeocodeLocationUpdates(existingPharmacy, safeUpdates));
  safeUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('pharmacies')
    .update(safeUpdates)
    .eq('id', pharmacyId)
    .eq('owner_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

// Get inventory
const getInventory = async (pharmacyId, filters = {}, page = 1, limit = 50) => {
  if (filters.publicOnly) {
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from('pharmacies')
      .select('id')
      .eq('id', pharmacyId)
      .eq('is_active', true)
      .eq('is_approved', true)
      .maybeSingle();

    if (pharmacyError) throw pharmacyError;
    if (!pharmacy) throw new ApiError(404, 'Pharmacy not found');
  }

  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('pharmacy_inventory')
    .select('*', { count: 'exact' })
    .eq('pharmacy_id', pharmacyId);

  if (filters.search) {
    const s = sanitizeSearch(filters.search);
    if (s) query = query.or(`name.ilike.%${s}%,medicine_name.ilike.%${s}%`);
  }
  // Low-stock filter is applied in JS because PostgREST does not support
  // reliable cross-column comparisons like quantity < reorder_level.
  const isLowStockFilter = filters.lowStock === true || filters.lowStock === 'true';
  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  let data, error, count;
  {
    if (isLowStockFilter) {
      // Fetch matching category/search rows first, then apply low-stock logic
      const result = await query.order('name');
      const allRows = result.data || [];
      const lowStockRows = allRows.filter(i => (i.quantity || 0) < (i.reorder_level || 10));
      data = lowStockRows.slice(offset, offset + limit);
      error = result.error;
      count = lowStockRows.length;
    } else {
      const result = await query
        .order('name')
        .range(offset, offset + limit - 1);
      data = result.data;
      error = result.error;
      count = result.count;
    }
  }

  if (error) throw error;

  return {
    data: data || [],
    items: data || [], // Alias for route compatibility
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Add inventory item
const addInventoryItem = async (pharmacyId, userId, itemData) => {
  const { data, error } = await supabaseAdmin
    .from('pharmacy_inventory')
    .insert({
      pharmacy_id: pharmacyId,
      name: itemData.name || itemData.medicine_name,
      medicine_name: itemData.medicine_name || itemData.name,
      category: itemData.category,
      quantity: itemData.quantity || 0,
      price: itemData.price,
      mrp: itemData.mrp || itemData.price,
      batch_number: itemData.batchNumber || itemData.batch_number,
      expiry_date: itemData.expiryDate || itemData.expiry_date,
      manufacturer: itemData.manufacturer,
      requires_prescription: itemData.requiresPrescription || false,
      reorder_level: itemData.reorder_level || itemData.minQuantity || 10,
      unit: itemData.unit || 'units',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

// Update inventory item
const updateInventoryItem = async (itemId, pharmacyId, userId, updates) => {
  // Whitelist allowed fields
  const allowedFields = ['name', 'medicine_name', 'category', 'quantity', 'price', 'mrp',
    'batch_number', 'expiry_date', 'manufacturer', 'requires_prescription',
    'reorder_level', 'unit', 'description'];
  const safeUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }
  safeUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('pharmacy_inventory')
    .update(safeUpdates)
    .eq('id', itemId)
    .eq('pharmacy_id', pharmacyId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

// Delete inventory item
const deleteInventoryItem = async (itemId, pharmacyId, userId) => {
  const { error } = await supabaseAdmin
    .from('pharmacy_inventory')
    .delete()
    .eq('id', itemId)
    .eq('pharmacy_id', pharmacyId);

  if (error) throw error;
};

// Get orders
const getOrders = async (pharmacyId, filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('pharmacy_orders')
    .select('*, patient:patients(id, name)', { count: 'exact' })
    .eq('pharmacy_id', pharmacyId);

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    orders: data || [], // Alias
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Valid order status transitions
const ORDER_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['dispatched', 'delivered', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [],
  cancelled: [],
};

// Update order status
const updateOrderStatus = async (orderId, pharmacyId, userId, status, notes) => {
  // Fetch current order to validate transition
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('pharmacy_orders')
    .select('status')
    .eq('id', orderId)
    .eq('pharmacy_id', pharmacyId)
    .single();

  if (fetchError || !current) throw new ApiError(404, 'Order not found');

  const allowed = ORDER_STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot transition order from '${current.status}' to '${status}'`);
  }

  const { data, error } = await supabaseAdmin
    .from('pharmacy_orders')
    .update({
      status,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('pharmacy_id', pharmacyId)
    .select('*')
    .single();

  if (error) throw error;

  // Notify patient
  if (data?.patient_id) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('user_id')
      .eq('id', data.patient_id)
      .single();

    if (patient) {
      eventEmitter.emitOrderStatusUpdated({
        ...data,
        patient_id: patient.user_id,
        pharmacy_owner_id: userId,
      });
    }
  }

  return data;
};

// Analytics
const getAnalytics = async (pharmacyId, userId, period = '30d') => {
  const days = parseInt(period) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const [
    { count: totalOrders },
    { count: pendingOrders },
    { data: inventory },
  ] = await Promise.all([
    supabaseAdmin.from('pharmacy_orders').select('*', { count: 'exact', head: true }).eq('pharmacy_id', pharmacyId).gte('created_at', sinceStr),
    supabaseAdmin.from('pharmacy_orders').select('*', { count: 'exact', head: true }).eq('pharmacy_id', pharmacyId).eq('status', 'pending'),
    supabaseAdmin.from('pharmacy_inventory').select('quantity, price, reorder_level').eq('pharmacy_id', pharmacyId),
  ]);

  const totalInventoryValue = (inventory || []).reduce((sum, i) => sum + (i.quantity * (i.price || 0)), 0);
  const lowStockCount = (inventory || []).filter(i => i.quantity < (i.reorder_level || 10)).length;

  return {
    data: {
      period,
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      totalInventoryItems: (inventory || []).length,
      lowStockItems: lowStockCount,
      totalInventoryValue,
    },
  };
};

// Create order (from patient via medicine routes)
const createOrder = async (patientUserId, orderData) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', patientUserId)
    .single();

  if (!patient) {
    throw new ApiError(404, 'Patient profile not found');
  }

  // Batch-fetch all inventory items in one query
  const itemIds = (orderData.items || []).map(i => i.inventoryItemId || i.medicineId).filter(Boolean);
  let inventoryMap = {};
  if (itemIds.length > 0) {
    const { data: invItems } = await supabaseAdmin
      .from('pharmacy_inventory')
      .select('id, price, name, medicine_name, medicine_id')
      .eq('pharmacy_id', orderData.pharmacyId)
      .or(`id.in.(${itemIds.join(',')}),medicine_id.in.(${itemIds.join(',')})`);
      
    inventoryMap = (invItems || []).reduce((m, item) => { 
      m[item.id] = item; 
      if (item.medicine_id) m[item.medicine_id] = item;
      return m; 
    }, {});
  }

  let totalAmount = 0;
  const enrichedItems = [];
  for (const item of (orderData.items || [])) {
    const reqItemId = item.inventoryItemId || item.medicineId;
    const invItem = inventoryMap[reqItemId];
    
    if (!invItem) {
      throw new ApiError(400, `Item ${reqItemId} not available at this pharmacy`);
    }

    const itemPrice = invItem.price || 0;
    totalAmount += itemPrice * (item.quantity || 1);
    
    enrichedItems.push({
      inventory_id: invItem.id, // always save the actual inventory ID
      medicine_id: invItem.medicine_id,
      quantity: item.quantity || 1,
      price: itemPrice,
      name: invItem.name || invItem.medicine_name
    });
  }

  const insertPayload = {
    patient_id: patient.id,
    pharmacy_id: orderData.pharmacyId,
    items: enrichedItems,
    total_amount: totalAmount,
    delivery_address: orderData.deliveryAddress,
    status: 'pending',
    payment_status: 'pending',
  };

  // Link prescription if provided (enables pharmacy prescription view)
  if (orderData.prescriptionId) {
    insertPayload.prescription_id = orderData.prescriptionId;
  }

  const { data: order, error } = await supabaseAdmin
    .from('pharmacy_orders')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;

  // Notify pharmacy owner of new order
  const { data: pharmacy } = await supabaseAdmin
    .from('pharmacies')
    .select('owner_id, name')
    .eq('id', orderData.pharmacyId)
    .single();

  if (pharmacy) {
    eventEmitter.emitNewOrder({
      ...order,
      pharmacy_owner_id: pharmacy.owner_id,
      pharmacy_name: pharmacy.name,
      total: totalAmount,
    });
  }

  return { ...order, total: totalAmount };
};

module.exports = {
  searchPharmacies,
  findNearbyWithMedicine,
  registerPharmacy,
  getPharmacyByOwner,
  updatePharmacy,
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getOrders,
  updateOrderStatus,
  getAnalytics,
  createOrder,
};
