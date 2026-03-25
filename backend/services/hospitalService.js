/**
 * Hospital Service
 * Public hospital/facility discovery, search, and reviews
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { calculateDistance, getBoundingBox, formatDistance } = require('../utils/geo');
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

// Facility types
const getFacilityTypes = async () => {
  return [
    { id: 'hospital', name: 'Hospital', icon: '🏥' },
    { id: 'clinic', name: 'Clinic', icon: '🩺' },
    { id: 'pharmacy', name: 'Pharmacy', icon: '💊' },
    { id: 'diagnostic_center', name: 'Diagnostic Center', icon: '🔬' },
    { id: 'nursing_home', name: 'Nursing Home', icon: '🏠' },
  ];
};

// Get hospitals with filters and pagination
const getHospitals = async (filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('hospitals')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .eq('is_approved', true);

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.city) query = query.ilike('city', `%${sanitizeSearch(filters.city)}%`);
  if (filters.isEmergencyAvailable) query = query.eq('is_emergency_available', true);
  if (filters.specialization) query = query.contains('specializations', [filters.specialization]);
  if (filters.search) {
    const s = sanitizeSearch(filters.search);
    if (s) query = query.or(`name.ilike.%${s}%,city.ilike.%${s}%`);
  }

  const { data, error, count } = await query
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    pagination: {
      page, limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
};

// Get nearby hospitals (using lat/lng distance calculation)
const getNearbyHospitals = async (latitude, longitude, radius = 10, filters = {}) => {
  const bounds = getBoundingBox({ latitude, longitude }, radius);

  let query = supabaseAdmin
    .from('hospitals')
    .select('*')
    .eq('is_active', true)
    .eq('is_approved', true)
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng);

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.isEmergencyAvailable) query = query.eq('is_emergency_available', true);
  if (filters.is24Hours) query = query.eq('is_24_hours', true);

  const { data, error } = await query;
  if (error) throw error;

  const recordsWithPhone = await enrichMissingPhonesFromOwners(data || []);

  const nearby = recordsWithPhone
    .map((h) => {
      const dist = calculateDistance({ latitude, longitude }, { latitude: h.latitude, longitude: h.longitude });
      return { ...h, distance: dist, distanceText: formatDistance(dist) };
    })
    .filter((h) => h.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  return nearby;
};

// Get emergency hospitals
const getEmergencyHospitals = async (latitude, longitude) => {
  const bounds = getBoundingBox({ latitude, longitude }, 50); // 50km for emergencies

  const { data, error } = await supabaseAdmin
    .from('hospitals')
    .select('*')
    .eq('is_active', true)
    .eq('is_approved', true)
    .eq('is_emergency_available', true)
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng);

  if (error) throw error;

  const recordsWithPhone = await enrichMissingPhonesFromOwners(data || []);

  return recordsWithPhone
    .map((h) => {
      const dist = calculateDistance({ latitude, longitude }, { latitude: h.latitude, longitude: h.longitude });
      return { ...h, distance: dist, distanceText: formatDistance(dist) };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);
};

// Get pharmacies near location
const getPharmacies = async (latitude, longitude, radius = 5) => {
  const bounds = getBoundingBox({ latitude, longitude }, radius);

  const { data, error } = await supabaseAdmin
    .from('pharmacies')
    .select('*')
    .eq('is_active', true)
    .eq('is_approved', true)
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng);

  if (error) throw error;

  const recordsWithPhone = await enrichMissingPhonesFromOwners(data || []);

  return recordsWithPhone
    .map((p) => {
      const dist = calculateDistance({ latitude, longitude }, { latitude: p.latitude, longitude: p.longitude });
      return { ...p, distance: dist, distanceText: formatDistance(dist) };
    })
    .filter((p) => p.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
};

// Get clinics near location
const getClinics = async (latitude, longitude, radius = 5) => {
  const bounds = getBoundingBox({ latitude, longitude }, radius);

  const { data, error } = await supabaseAdmin
    .from('clinics')
    .select('*')
    .eq('is_active', true)
    .eq('is_approved', true)
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng);

  if (error) throw error;

  const recordsWithPhone = await enrichMissingPhonesFromOwners(data || []);

  return recordsWithPhone
    .map((c) => {
      const dist = calculateDistance({ latitude, longitude }, { latitude: c.latitude, longitude: c.longitude });
      return { ...c, distance: dist, distanceText: formatDistance(dist) };
    })
    .filter((c) => c.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
};

// Get diagnostic centers near location
// Proxies to diagnosticCenterService.findNearby so both discovery paths
// (hospitals/diagnostic-centers AND diagnostic-centers/nearby) use the same table
const getDiagnosticCenters = async (latitude, longitude, radius = 10) => {
  const diagnosticCenterService = require('./diagnosticCenterService');
  return diagnosticCenterService.findNearby(latitude, longitude, radius);
};

// Search hospitals — C4 fix: sanitize search input
const searchHospitals = async (query, latitude, longitude) => {
  const q = sanitizeSearch(query);
  if (!q) return [];

  const { data, error } = await supabaseAdmin
    .from('hospitals')
    .select('*')
    .eq('is_active', true)
    .eq('is_approved', true)
    .or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
    .limit(50);

  if (error) throw error;

  let results = await enrichMissingPhonesFromOwners(data || []);

  // Add distance if coordinates provided
  if (latitude && longitude) {
    results = results
      .map((h) => ({
        ...h,
        distance: h.latitude && h.longitude
          ? calculateDistance({ latitude, longitude }, { latitude: h.latitude, longitude: h.longitude })
          : null,
      }))
      .sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }

  return results;
};

// Get hospital by ID (only approved & active facilities visible to patients)
const getHospitalById = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('hospitals')
    .select('*, departments:hospital_departments(*), doctors:hospital_doctors(*, doctor:doctors(id, name, specialization, profile_image_url, consultation_fee, is_approved))')
    .eq('id', id)
    .eq('is_approved', true)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Hospital not found');
  }

  if (Array.isArray(data.doctors)) {
    data.doctors = data.doctors
      .filter((entry) => entry?.doctor?.is_approved === true)
      .map((entry) => {
        if (!entry?.doctor) return entry;
        const { is_approved: _ignored, ...doctor } = entry.doctor;
        return { ...entry, doctor };
      });
  }

  return data;
};

// Add review
const addReview = async (userId, hospitalId, reviewData) => {
  // Resolve patient_id from user_id (reviews FK references patients, not users)
  const { data: patientRow } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  const patientId = patientRow?.id || userId; // fallback to userId if no patient profile

  // Prevent duplicate reviews from the same user for the same hospital
  const { data: existingReview } = await supabaseAdmin
    .from('reviews')
    .select('id')
    .eq('patient_id', patientId)
    .eq('reviewable_type', 'hospital')
    .eq('reviewable_id', hospitalId)
    .maybeSingle();

  if (existingReview) {
    throw new ApiError(409, 'You have already reviewed this hospital');
  }

  const { data: review, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      patient_id: patientId,
      reviewable_type: 'hospital',
      reviewable_id: hospitalId,
      rating: reviewData.rating,
      comment: reviewData.comment,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Atomic DB-level aggregate — avoids race condition with concurrent reviews.
  // Try RPC first (stored procedure), fall back to query-based aggregate.
  const { data: agg, error: aggErr } = await supabaseAdmin
    .rpc('calculate_hospital_rating', { p_hospital_id: hospitalId })
    .catch(() => ({ data: null, error: true }));

  if (!aggErr && agg && agg.length > 0) {
    await supabaseAdmin
      .from('hospitals')
      .update({
        rating: Math.round(agg[0].avg_rating * 10) / 10,
        total_reviews: agg[0].review_count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hospitalId);
  } else {
    // Fallback: SELECT aggregate then UPDATE (still re-reads ALL rows atomically)
    const { data: allReviews } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('reviewable_type', 'hospital')
      .eq('reviewable_id', hospitalId);

    if (allReviews && allReviews.length > 0) {
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await supabaseAdmin
        .from('hospitals')
        .update({
          rating: Math.round(avgRating * 10) / 10,
          total_reviews: allReviews.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', hospitalId);
    }
  }

  return review;
};

// Get reviews for a hospital (public)
const getReviews = async (hospitalId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const { data, error, count } = await supabaseAdmin
    .from('reviews')
    .select('*, patient:patients(name, profile_image_url)', { count: 'exact' })
    .eq('reviewable_type', 'hospital')
    .eq('reviewable_id', hospitalId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: (data || []).map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      patientName: r.patient?.name || 'Anonymous',
      patientImage: r.patient?.profile_image_url || null,
      createdAt: r.created_at,
    })),
    pagination: {
      page, limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
};

module.exports = {
  getFacilityTypes,
  getHospitals,
  getNearbyHospitals,
  getEmergencyHospitals,
  getPharmacies,
  getClinics,
  getDiagnosticCenters,
  searchHospitals,
  getHospitalById,
  addReview,
  getReviews,
};
