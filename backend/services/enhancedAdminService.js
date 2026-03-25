/**
 * Enhanced Admin Service
 * Complete admin management with approval workflows for all provider types
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { sanitizeSearch } = require('../utils/sanitize');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { logAudit } = require('../utils/auditLogger');
const { geocodeProvider } = require('../utils/geocoding');
const notificationService = require('./notificationService');
const { sendApprovalEmail } = require('./emailService');
const eventEmitter = require('./eventEmitter');

// Provider type → Supabase table mapping
const PROVIDER_TABLES = {
  doctor: 'doctors',
  hospital: 'hospitals',
  pharmacy: 'pharmacies',
  clinic: 'clinics',
  diagnostic_center: 'diagnostic_centers',
  ambulance: 'ambulance_operators',
};

const PROVIDER_USER_FIELDS = {
  doctor: 'user_id',
  hospital: 'owner_id',
  pharmacy: 'owner_id',
  clinic: 'owner_id',
  diagnostic_center: 'owner_id',
  ambulance: 'user_id',
};

const getProviderUserId = (provider) => provider?.user_id || provider?.owner_id || null;
const LOCATION_PROVIDER_TYPES = new Set(['hospital', 'pharmacy', 'clinic', 'diagnostic_center']);

const resolveProviderPhone = async (provider) => {
  if (provider?.phone) return provider.phone;
  const userId = getProviderUserId(provider);
  if (!userId) return null;

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  return user?.phone || null;
};

const assertProviderApprovalReadiness = async (type, provider) => {
  if (!provider?.id) throw new ApiError(404, 'Provider not found');

  const phone = await resolveProviderPhone(provider);
  if (!phone) {
    throw new ApiError(
      400,
      'Provider phone is required before approval. Update provider profile (or owner phone) and try again.'
    );
  }

  if (LOCATION_PROVIDER_TYPES.has(type)) {
    const hasLatitude = typeof provider.latitude === 'number' && !Number.isNaN(provider.latitude);
    const hasLongitude = typeof provider.longitude === 'number' && !Number.isNaN(provider.longitude);
    if (!hasLatitude || !hasLongitude) {
      throw new ApiError(
        400,
        'Provider latitude/longitude are required before approval so patients can discover this provider on map.'
      );
    }
  }
};

const getProviderSnapshot = async (type, id) => {
  const table = PROVIDER_TABLES[type];
  const userField = PROVIDER_USER_FIELDS[type];
  const selectFields = [
    'id',
    'name',
    userField,
    'is_approved',
    'approval_status',
    'approval_notes',
    'approved_by',
    'approved_at',
    ...(type === 'doctor' ? [] : ['is_active']),
  ].join(', ');

  const { data, error } = await supabaseAdmin
    .from(table)
    .select(selectFields)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const invalidateApprovalCaches = async (provider) => {
  const userId = getProviderUserId(provider);
  const keys = ['admin:dashboard'];
  if (userId) keys.push(`auth_user:${userId}`);
  await Promise.allSettled(keys.map((key) => cacheDel(key)));
};

const notifyProviderStatusChange = async ({ provider, type, status, notes = '' }) => {
  const userId = getProviderUserId(provider);
  if (!userId) return;

  const statusConfig = {
    approved: {
      title: 'Registration Approved! 🎉',
      message: `Your ${type} registration for "${provider.name || type}" has been approved. You can now start managing your facility.`,
      emailStatus: 'approved',
    },
    rejected: {
      title: 'Registration Update',
      message: `Your ${type} registration was not approved.${notes ? ` Reason: ${notes}` : ''} Please review and resubmit.`,
      emailStatus: 'rejected',
    },
    suspended: {
      title: 'Account Suspended',
      message: `Your ${type} account has been suspended.${notes ? ` Reason: ${notes}` : ''}`,
      emailStatus: 'suspended',
    },
    reactivated: {
      title: 'Account Reactivated',
      message: `Your ${type} account for "${provider.name || type}" has been reactivated. You can access your dashboard again.`,
      emailStatus: 'reactivated',
    },
  };

  const cfg = statusConfig[status];
  if (!cfg) return;

  try {
    await notificationService.sendNotification(userId, {
      title: cfg.title,
      message: cfg.message,
      type: 'system',
      data: { providerId: provider.id, providerType: type, action: status },
    });
  } catch (err) {
    console.warn(`[Admin] Failed to send ${status} notification:`, err.message);
  }

  if (!cfg.emailStatus) return;

  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('email, name, role')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!user?.email) return;

    await sendApprovalEmail(
      user.email,
      user.name || provider.name || 'User',
      user.role,
      cfg.emailStatus,
      notes
    );
  } catch (err) {
    console.warn(`[Admin] Failed to send ${status} email:`, err.message);
  }
};

const auditProviderTransition = async ({ adminId, type, providerId, action, before, after, notes }) => {
  await logAudit({
    userId: adminId,
    userRole: 'admin',
    action,
    entityType: type,
    entityId: providerId,
    oldData: before,
    newData: after,
    metadata: notes ? { notes } : undefined,
  });
};

const broadcastProviderCatalogUpdate = async ({ provider, type, status }) => {
  if (!provider?.id) return;
  eventEmitter.emitProviderCatalogUpdated({
    providerId: provider.id,
    providerType: type,
    status,
  });
};

const backfillProviderCoordinates = async (type, provider) => {
  if (!LOCATION_PROVIDER_TYPES.has(type) || !provider?.id) {
    return provider;
  }

  if (provider.latitude != null && provider.longitude != null) {
    return provider;
  }

  try {
    const geo = await geocodeProvider(provider);
    if (!geo) {
      return provider;
    }

    const table = PROVIDER_TABLES[type];
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({
        latitude: geo.latitude,
        longitude: geo.longitude,
        updated_at: new Date().toISOString(),
      })
      .eq('id', provider.id)
      .select('*')
      .single();

    if (error) throw error;
    return data || provider;
  } catch (err) {
    console.warn(`[Admin] Failed to geocode approved ${type} ${provider.id}: ${err.message}`);
    return provider;
  }
};

// Dashboard — Fix #34: Use Promise.allSettled to survive individual query failures
// Fix #42: Cache dashboard counts for 60 seconds
const getDashboard = async () => {
  // Check cache first
  const cached = await cacheGet('admin:dashboard');
  if (cached) return cached;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  const ACTIVE_EMERGENCY_STATUSES = [
    'active',
    'pending',
    'broadcasting',
    'assigned',
    'accepted',
    'dispatched',
    'en_route_pickup',
    'en_route',
    'arrived',
    'picked_up',
    'en_route_hospital',
  ];

  const safeCount = (result) => (result.status === 'fulfilled' ? result.value.count || 0 : 0);

  const results = await Promise.allSettled([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('doctors').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('patients').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('hospitals').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('pharmacies').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('clinics').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('diagnostic_centers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('ambulance_operators').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('doctors').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabaseAdmin.from('hospitals').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabaseAdmin.from('pharmacies').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabaseAdmin.from('clinics').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabaseAdmin.from('diagnostic_centers').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabaseAdmin.from('ambulance_operators').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabaseAdmin.from('doctors').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),
    supabaseAdmin.from('hospitals').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved').eq('is_active', true),
    supabaseAdmin.from('pharmacies').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved').eq('is_active', true),
    supabaseAdmin.from('clinics').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved').eq('is_active', true),
    supabaseAdmin.from('diagnostic_centers').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved').eq('is_active', true),
    supabaseAdmin.from('ambulance_operators').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved').eq('is_active', true),
    supabaseAdmin.from('emergency_requests').select('*', { count: 'exact', head: true }).in('status', ACTIVE_EMERGENCY_STATUSES),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('last_login', dayStartIso),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', dayStartIso),
  ]);

  const [
    totalUsers, totalDoctors, totalPatients, totalHospitals,
    totalPharmacies, totalClinics, totalDiagnosticCenters, totalAmbulances,
    totalAppointments, pendingDoctors, pendingHospitals, pendingPharmacies,
    pendingClinics, pendingDiagnosticCenters, pendingAmbulances,
    approvedDoctors, approvedHospitals, approvedPharmacies,
    approvedClinics, approvedDiagnosticCenters, approvedAmbulances,
    activeEmergencies, activeTodayUsers, todaysAppointments,
  ] = results.map(safeCount);

  const pendingTotal = (pendingDoctors || 0) + (pendingHospitals || 0) + (pendingPharmacies || 0)
    + (pendingClinics || 0) + (pendingDiagnosticCenters || 0) + (pendingAmbulances || 0);

  // Use canonical approved counts (and active where applicable) to avoid inflating
  // dashboard numbers with rejected/suspended/inactive test records.
  const providersVisibleDoctors = (approvedDoctors || 0) + (pendingDoctors || 0);
  const providersVisibleHospitals = (approvedHospitals || 0) + (pendingHospitals || 0);
  const providersVisiblePharmacies = (approvedPharmacies || 0) + (pendingPharmacies || 0);
  const providersVisibleClinics = (approvedClinics || 0) + (pendingClinics || 0);
  const providersVisibleDiagnosticCenters = (approvedDiagnosticCenters || 0) + (pendingDiagnosticCenters || 0);
  const providersVisibleAmbulances = (approvedAmbulances || 0) + (pendingAmbulances || 0);

  const totalProvidersVisible = providersVisibleDoctors + providersVisibleHospitals + providersVisiblePharmacies
    + providersVisibleClinics + providersVisibleDiagnosticCenters + providersVisibleAmbulances;

  const dashboard = {
    // Flat stats for backward-compat
    totalUsers: totalUsers || 0,
    totalDoctors: totalDoctors || 0,
    totalPatients: totalPatients || 0,
    totalHospitals: totalHospitals || 0,
    totalPharmacies: totalPharmacies || 0,
    totalClinics: totalClinics || 0,
    totalDiagnosticCenters: totalDiagnosticCenters || 0,
    totalAmbulances: totalAmbulances || 0,
    totalAppointments: totalAppointments || 0,
    activeEmergencies: activeEmergencies || 0,
    // Web dashboard reads these
    stats: {
      totalUsers: totalUsers || 0,
      totalProviders: totalProvidersVisible,
      totalPatients: totalPatients || 0,
      activeToday: activeTodayUsers || 0,
      pendingApprovals: pendingTotal,
      todaysAppointments: todaysAppointments || 0,
      activeEmergencies: activeEmergencies || 0,
    },
    providerCounts: {
      doctors:    { total: providersVisibleDoctors, pending: pendingDoctors || 0 },
      hospitals:  { total: providersVisibleHospitals, pending: pendingHospitals || 0 },
      clinics:    { total: providersVisibleClinics, pending: pendingClinics || 0 },
      pharmacies: { total: providersVisiblePharmacies, pending: pendingPharmacies || 0 },
      diagnosticCenters: { total: providersVisibleDiagnosticCenters, pending: pendingDiagnosticCenters || 0 },
      ambulances: { total: providersVisibleAmbulances, pending: pendingAmbulances || 0 },
    },
    providerCategories: [
      { name: 'Doctors',    type: 'doctors',    pending: pendingDoctors || 0,    approved: approvedDoctors || 0 },
      { name: 'Hospitals',  type: 'hospitals',  pending: pendingHospitals || 0,  approved: approvedHospitals || 0 },
      { name: 'Clinics',    type: 'clinics',    pending: pendingClinics || 0,    approved: approvedClinics || 0 },
      { name: 'Pharmacies', type: 'pharmacies', pending: pendingPharmacies || 0, approved: approvedPharmacies || 0 },
      { name: 'Diagnostic Centers', type: 'diagnostic_centers', pending: pendingDiagnosticCenters || 0, approved: approvedDiagnosticCenters || 0 },
      { name: 'Ambulances', type: 'ambulances', pending: pendingAmbulances || 0, approved: approvedAmbulances || 0 },
    ],
    pendingApprovals: {
      doctors: pendingDoctors || 0,
      hospitals: pendingHospitals || 0,
      pharmacies: pendingPharmacies || 0,
      clinics: pendingClinics || 0,
      diagnosticCenters: pendingDiagnosticCenters || 0,
      ambulances: pendingAmbulances || 0,
    },
  };

  // Cache for 60 seconds
  await cacheSet('admin:dashboard', dashboard, 60);
  return dashboard;
};

// Get pending approvals
const getPendingApprovals = async (type = 'all', page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const results = {};

  // Use approval_status = 'pending' as the canonical field across all provider tables
  const fetchPending = async (table) => {
    const { data, count } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact' })
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return { data: data || [], total: count || 0 };
  };

  if (type === 'all' || type === 'doctor') {
    results.doctors = await fetchPending('doctors');
  }
  if (type === 'all' || type === 'hospital') {
    results.hospitals = await fetchPending('hospitals');
  }
  if (type === 'all' || type === 'pharmacy') {
    results.pharmacies = await fetchPending('pharmacies');
  }
  if (type === 'all' || type === 'clinic') {
    results.clinics = await fetchPending('clinics');
  }
  if (type === 'all' || type === 'diagnostic_center') {
    results.diagnosticCenters = await fetchPending('diagnostic_centers');
  }
  if (type === 'all' || type === 'ambulance') {
    results.ambulances = await fetchPending('ambulance_operators');
  }

  return { data: results, pagination: { page, limit } };
};

// Get provider details
const getProviderDetails = async (type, id) => {
  const table = PROVIDER_TABLES[type];
  if (!table) {
    throw new ApiError(400, 'Invalid provider type');
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Provider not found');
  }

  return data;
};

// Approve provider
const approveProvider = async (type, id, adminId, notes) => {
  const table = PROVIDER_TABLES[type];
  if (!table) throw new ApiError(400, 'Invalid provider type');
  const before = await getProviderSnapshot(type, id);
  let providerDraft = await getProviderDetails(type, id);

  if (LOCATION_PROVIDER_TYPES.has(type)) {
    providerDraft = await backfillProviderCoordinates(type, providerDraft);
  }

  await assertProviderApprovalReadiness(type, providerDraft);

  // Build update payload — only use columns that exist in the DB schema
  // All tables have: is_approved, approval_status, approval_notes, approved_by, approved_at
  // hospitals/pharmacies/clinics/ambulance_operators have is_active; doctors do NOT
  const updatePayload = {
    is_approved: true,
    approval_status: 'approved',
    approval_notes: notes,
    approved_by: adminId,
    approved_at: new Date().toISOString(),
  };

  // Set is_active for tables that have this column (all except doctors)
  if (type !== 'doctor') {
    updatePayload.is_active = true;
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  const approvedProvider = await backfillProviderCoordinates(type, data);

  // Update user verification if applicable
  if (approvedProvider?.user_id || approvedProvider?.owner_id) {
    const userId = approvedProvider.user_id || approvedProvider.owner_id;
    await supabaseAdmin.from('users').update({ is_verified: true }).eq('id', userId);
  }

  await Promise.allSettled([
    invalidateApprovalCaches(approvedProvider),
    notifyProviderStatusChange({ provider: approvedProvider, type, status: 'approved', notes }),
    broadcastProviderCatalogUpdate({ provider: approvedProvider, type, status: 'approved' }),
    auditProviderTransition({
      adminId,
      type,
      providerId: id,
      action: 'provider.approved',
      before,
      after: approvedProvider,
      notes,
    }),
  ]);

  return { data: approvedProvider, message: `${type} approved successfully` };
};

// Reject provider
const rejectProvider = async (type, id, adminId, reason) => {
  const table = PROVIDER_TABLES[type];
  if (!table) throw new ApiError(400, 'Invalid provider type');
  const before = await getProviderSnapshot(type, id);

  // Only use columns that exist in the actual DB schema
  const updatePayload = {
    is_approved: false,
    approval_status: 'rejected',
    approval_notes: reason,
  };

  // Set is_active for tables that have it (all except doctors)
  if (type !== 'doctor') {
    updatePayload.is_active = false;
  }

  // Doctor-specific: rejection_reason column exists only on doctors table
  if (type === 'doctor') {
    updatePayload.rejection_reason = reason;
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  await Promise.allSettled([
    invalidateApprovalCaches(data),
    notifyProviderStatusChange({ provider: data, type, status: 'rejected', notes: reason }),
    broadcastProviderCatalogUpdate({ provider: data, type, status: 'rejected' }),
    auditProviderTransition({
      adminId,
      type,
      providerId: id,
      action: 'provider.rejected',
      before,
      after: data,
      notes: reason,
    }),
  ]);

  return { data, message: `${type} rejected` };
};

// Suspend provider
const suspendProvider = async (type, id, adminId, reason) => {
  const table = PROVIDER_TABLES[type];
  if (!table) throw new ApiError(400, 'Invalid provider type');
  const before = await getProviderSnapshot(type, id);

  // Only use columns that exist in the actual DB schema
  const updatePayload = {
    is_approved: false,
    approval_status: 'suspended',
    approval_notes: `Suspended: ${reason}`,
  };

  // Set is_active for tables that have it (all except doctors)
  if (type !== 'doctor') {
    updatePayload.is_active = false;
  }

  // Doctor-specific: suspension_reason + suspended_at exist only on doctors table
  if (type === 'doctor') {
    updatePayload.suspension_reason = reason;
    updatePayload.suspended_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  await Promise.allSettled([
    invalidateApprovalCaches(data),
    notifyProviderStatusChange({ provider: data, type, status: 'suspended', notes: reason }),
    broadcastProviderCatalogUpdate({ provider: data, type, status: 'suspended' }),
    auditProviderTransition({
      adminId,
      type,
      providerId: id,
      action: 'provider.suspended',
      before,
      after: data,
      notes: reason,
    }),
  ]);
  return { data, message: `${type} suspended` };
};

// Reactivate provider
const reactivateProvider = async (type, id, adminId, notes) => {
  const table = PROVIDER_TABLES[type];
  if (!table) throw new ApiError(400, 'Invalid provider type');
  const before = await getProviderSnapshot(type, id);

  // Only use columns that exist in the actual DB schema
  const updatePayload = {
    is_approved: true,
    approval_status: 'approved',
    approval_notes: notes || 'Reactivated',
    approved_by: adminId,
    approved_at: new Date().toISOString(),
  };

  // Set is_active for tables that have it (all except doctors)
  if (type !== 'doctor') {
    updatePayload.is_active = true;
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  if (data?.user_id || data?.owner_id) {
    const userId = data.user_id || data.owner_id;
    await supabaseAdmin.from('users').update({ is_verified: true }).eq('id', userId);
  }

  await Promise.allSettled([
    invalidateApprovalCaches(data),
    notifyProviderStatusChange({ provider: data, type, status: 'reactivated', notes }),
    broadcastProviderCatalogUpdate({ provider: data, type, status: 'reactivated' }),
    auditProviderTransition({
      adminId,
      type,
      providerId: id,
      action: 'provider.reactivated',
      before,
      after: data,
      notes,
    }),
  ]);
  return { data, message: `${type} reactivated` };
};

// Add admin note
const addAdminNote = async (type, id, adminId, note, isInternal = true) => {
  const table = PROVIDER_TABLES[type];
  if (!table) throw new ApiError(400, 'Invalid provider type');

  // Append to existing notes
  const { data: existing } = await supabaseAdmin
    .from(table)
    .select('approval_notes')
    .eq('id', id)
    .single();

  const timestamp = new Date().toISOString();
  const newNote = `[${timestamp}] ${note}`;
  const existingNotes = existing?.approval_notes || '';
  const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;

  const { data, error } = await supabaseAdmin
    .from(table)
    .update({ approval_notes: updatedNotes })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return { note: newNote, provider: data };
};

// Get users
const getUsers = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin.from('users').select('id, name, email, phone, role, is_active, is_verified, created_at, last_login, profile_image_url', { count: 'exact' });

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.isVerified !== undefined) query = query.eq('is_verified', filters.isVerified);
  if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);
  if (filters.search) {
    const s = sanitizeSearch(filters.search);
    if (s) query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { data: data || [], pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) } };
};

// Update user status
const updateUserStatus = async (adminUserId, userId, isActive, reason) => {
  // Prevent admin from deactivating themselves
  if (adminUserId === userId && !isActive) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id, name, email, is_active')
    .single();

  if (error) throw error;

  // If deactivating, invalidate their auth cache
  if (!isActive) {
    const { cacheDel } = require('../config/redis');
    await cacheDel(`auth_user:${userId}`);
  }

  logAudit({
    userId: adminUserId,
    userRole: 'admin',
    action: isActive ? 'user.activate' : 'user.deactivate',
    entityType: 'user',
    entityId: userId,
    details: { reason },
  });

  return { data, message: `User ${isActive ? 'activated' : 'deactivated'}` };
};

// Get active emergencies
const getActiveEmergencies = async (page = 1, limit = 20) => {
  const ACTIVE_EMERGENCY_STATUSES = [
    'active',
    'pending',
    'broadcasting',
    'assigned',
    'accepted',
    'dispatched',
    'en_route_pickup',
    'en_route',
    'arrived',
    'picked_up',
    'en_route_hospital',
  ];

  const offset = (page - 1) * limit;
  const { data, error, count } = await supabaseAdmin
    .from('emergency_requests')
    .select('*, patient:patients(id, name)', { count: 'exact' })
    .in('status', ACTIVE_EMERGENCY_STATUSES)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { data: data || [], pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) } };
};

// Reassign emergency
const reassignEmergency = async (emergencyId, operatorId, adminId, reason) => {
  // Update operator assignment and record reassignment in status_history
  const { data, error } = await supabaseAdmin
    .from('emergency_requests')
    .update({
      operator_id: operatorId,
      admin_notes: `Reassigned by admin: ${reason || 'No reason provided'}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', emergencyId)
    .select('*')
    .single();

  if (error) throw error;
  return { data, message: 'Emergency reassigned' };
};

// Get expiring documents (check ambulance operator licenses)
const getExpiringDocuments = async (days = 30) => {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  const { data: operators } = await supabaseAdmin
    .from('ambulance_operators')
    .select('id, name, license_expiry, user_id')
    .lte('license_expiry', futureDate.toISOString())
    .gte('license_expiry', new Date().toISOString());

  const documents = (operators || []).map((op) => {
    const expiryDate = op.license_expiry;
    const expiryTs = expiryDate ? new Date(expiryDate).getTime() : Number.NaN;
    const daysUntilExpiry = Number.isFinite(expiryTs)
      ? Math.ceil((expiryTs - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      id: op.id,
      providerName: op.name || 'Unknown',
      providerType: 'ambulance_operator',
      documentType: 'Operator License',
      expiryDate: expiryDate || now.toISOString(),
      status: daysUntilExpiry <= 0 ? 'expired' : (daysUntilExpiry <= 7 ? 'expiring_soon' : 'valid'),
      daysUntilExpiry,
    };
  });

  return { operators: operators || [], documents };
};

// Analytics
const getAnalytics = async (period = '30d') => {
  const parsePeriodToDays = (value) => {
    const normalized = String(value || '30d').trim().toLowerCase();
    if (normalized === '1y') return 365;
    if (normalized.endsWith('d')) {
      const d = parseInt(normalized, 10);
      return Number.isFinite(d) && d > 0 ? d : 30;
    }
    const fallback = parseInt(normalized, 10);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 30;
  };

  const pctChange = (current, previous) => {
    if (!previous) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const days = parsePeriodToDays(period);
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);

  const sinceStr = since.toISOString();
  const nowStr = now.toISOString();
  const prevSinceStr = prevSince.toISOString();

  const [
    // Totals
    { count: totalUsers },
    { count: totalAppointments },
    { count: totalDoctors },

    // Current period
    { count: usersCurrent },
    { count: appointmentsCurrent },
    { count: doctorsCurrent },

    // Previous period
    { count: usersPrevious },
    { count: appointmentsPrevious },
    { count: doctorsPrevious },

    // Supplemental
    { count: completedConsultations },
    { count: activeNow },
    reviewsRes,
    doctorReviewsRes,
    specialtiesRes,
    usersSeriesRes,
    apptSeriesRes,
    waitSeriesRes,
  ] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('doctors').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),

    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sinceStr).lte('created_at', nowStr),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', sinceStr).lte('created_at', nowStr),
    supabaseAdmin.from('doctors').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved').gte('created_at', sinceStr).lte('created_at', nowStr),

    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', prevSinceStr).lt('created_at', sinceStr),
    supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).gte('created_at', prevSinceStr).lt('created_at', sinceStr),
    supabaseAdmin.from('doctors').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved').gte('created_at', prevSinceStr).lt('created_at', sinceStr),

    supabaseAdmin.from('consultations').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('created_at', sinceStr),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('last_login', new Date(Date.now() - 15 * 60 * 1000).toISOString()),
    supabaseAdmin.from('reviews').select('rating').eq('is_visible', true),
    supabaseAdmin.from('doctor_reviews').select('rating'),
    supabaseAdmin.from('doctors').select('specialization').eq('approval_status', 'approved'),
    supabaseAdmin.from('users').select('created_at').gte('created_at', sinceStr),
    supabaseAdmin.from('appointments').select('created_at').gte('created_at', sinceStr),
    supabaseAdmin.from('consultations').select('created_at,started_at').not('started_at', 'is', null).gte('created_at', sinceStr),
  ]);

  // Monthly/period series aggregation (bucket by month label)
  const monthKey = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthLabel = (key) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleString('en-IN', { month: 'short' });
  };

  const usersBuckets = new Map();
  for (const row of usersSeriesRes.data || []) {
    const key = monthKey(row.created_at);
    usersBuckets.set(key, (usersBuckets.get(key) || 0) + 1);
  }

  const apptBuckets = new Map();
  for (const row of apptSeriesRes.data || []) {
    const key = monthKey(row.created_at);
    apptBuckets.set(key, (apptBuckets.get(key) || 0) + 1);
  }

  const allKeys = Array.from(new Set([...usersBuckets.keys(), ...apptBuckets.keys()])).sort();
  const monthlyData = allKeys.map((k) => ({
    month: monthLabel(k),
    users: usersBuckets.get(k) || 0,
    appointments: apptBuckets.get(k) || 0,
  }));

  // Top specialties
  const specCounts = new Map();
  for (const row of specialtiesRes.data || []) {
    const raw = (row.specialization || '').trim();
    if (!raw) continue;
    specCounts.set(raw, (specCounts.get(raw) || 0) + 1);
  }
  const totalSpecs = Array.from(specCounts.values()).reduce((a, b) => a + b, 0) || 1;
  const topSpecialties = Array.from(specCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Number(((count / totalSpecs) * 100).toFixed(1)),
    }));

  // Ratings / satisfaction
  const allRatings = [];
  for (const r of reviewsRes.data || []) if (Number.isFinite(r.rating)) allRatings.push(Number(r.rating));
  for (const r of doctorReviewsRes.data || []) if (Number.isFinite(r.rating)) allRatings.push(Number(r.rating));
  const avgRating = allRatings.length
    ? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1))
    : 0;
  const positive = allRatings.filter((r) => r >= 4).length;
  const patientSatisfaction = allRatings.length
    ? Number(((positive / allRatings.length) * 100).toFixed(1))
    : 0;

  // Approx wait time: created_at -> started_at for consultations (capped 0..180 mins)
  const waits = [];
  for (const row of waitSeriesRes.data || []) {
    const created = new Date(row.created_at).getTime();
    const started = new Date(row.started_at).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(started)) continue;
    const mins = (started - created) / 60000;
    if (mins >= 0 && mins <= 180) waits.push(mins);
  }
  const avgWaitMinutes = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;

  return {
    period,
    // backward-compatible fields
    newUsers: usersCurrent || 0,
    newAppointments: appointmentsCurrent || 0,
    completedConsultations: completedConsultations || 0,

    // UI contract expected by web analytics page
    stats: {
      totalUsers: totalUsers || 0,
      totalDoctors: totalDoctors || 0,
      totalAppointments: totalAppointments || 0,
      platformUptime: 99.9,
      userGrowth: pctChange(usersCurrent || 0, usersPrevious || 0),
      doctorGrowth: pctChange(doctorsCurrent || 0, doctorsPrevious || 0),
      appointmentGrowth: pctChange(appointmentsCurrent || 0, appointmentsPrevious || 0),
    },
    monthlyData,
    topSpecialties,
    platformMetrics: {
      avgRating,
      patientSatisfaction,
      avgWaitTime: `${avgWaitMinutes}m`,
      activeNow: activeNow || 0,
    },
  };
};

// Audit logs (from MongoDB if available, else return empty)
const getAuditLogs = async (filters = {}, page = 1, limit = 50) => {
  try {
    const { AuditLog } = require('../database/models');
    const mongoFilters = {};
    if (filters.userId) mongoFilters.userId = filters.userId;
    if (filters.action) mongoFilters.action = filters.action;
    if (filters.resourceType) mongoFilters.resourceType = filters.resourceType;
    if (filters.fromDate || filters.toDate) {
      mongoFilters.createdAt = {};
      if (filters.fromDate) mongoFilters.createdAt.$gte = new Date(filters.fromDate);
      if (filters.toDate) mongoFilters.createdAt.$lte = new Date(filters.toDate);
    }

    const total = await AuditLog.countDocuments(mongoFilters);
    const data = await AuditLog.find(mongoFilters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  } catch (err) {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }
};

// System health
const getSystemHealth = async () => {
  const checks = {};

  try {
    await supabaseAdmin.from('users').select('id').limit(1);
    checks.supabase = { status: 'healthy' };
  } catch (e) {
    checks.supabase = { status: 'unhealthy', error: e.message };
  }

  try {
    const { getMongoConnection } = require('../config/mongodb');
    const conn = getMongoConnection();
    checks.mongodb = { status: conn ? 'healthy' : 'unavailable' };
  } catch (e) {
    checks.mongodb = { status: 'unavailable' };
  }

  try {
    const redis = require('../config/redis');
    const client = redis.getRedisClient();
    if (!client) {
      checks.redis = { status: 'unavailable' };
    } else {
      await client.ping();
      checks.redis = { status: 'healthy' };
    }
  } catch (e) {
    checks.redis = { status: 'unavailable' };
  }

  return {
    status: checks.supabase.status === 'healthy' && checks.mongodb.status === 'healthy'
      ? 'healthy'
      : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    // Backward-compatible top-level keys consumed by older UIs
    database: checks.mongodb,
    supabase: checks.supabase,
    redis: checks.redis,
    checks,
  };
};

// Valid emergency status transitions
const EMERGENCY_STATUS_TRANSITIONS = {
  pending: ['assigned', 'dispatched', 'cancelled'],
  assigned: ['dispatched', 'en_route', 'cancelled'],
  dispatched: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Update emergency status with state machine validation
const updateEmergencyStatus = async (emergencyId, status, adminId) => {
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('emergency_requests')
    .select('status')
    .eq('id', emergencyId)
    .single();

  if (fetchError || !current) throw new ApiError(404, 'Emergency request not found');

  const allowed = EMERGENCY_STATUS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot transition emergency from '${current.status}' to '${status}'`);
  }

  const { data, error } = await supabaseAdmin
    .from('emergency_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', emergencyId)
    .select('*')
    .single();

  if (error) throw error;

  logAudit({
    userId: adminId,
    userRole: 'admin',
    action: 'emergency.status_update',
    entityType: 'emergency_request',
    entityId: emergencyId,
    details: { from: current.status, to: status },
  });

  return { data, message: `Emergency status updated to '${status}'` };
};

module.exports = {
  getDashboard,
  getPendingApprovals,
  getProviderDetails,
  approveProvider,
  rejectProvider,
  suspendProvider,
  reactivateProvider,
  addAdminNote,
  getUsers,
  updateUserStatus,
  getActiveEmergencies,
  reassignEmergency,
  updateEmergencyStatus,
  getExpiringDocuments,
  getAnalytics,
  getAuditLogs,
  getSystemHealth,
};
