/**
 * Utility Helpers
 */

// Fix #49: Re-export asyncHandler from errorHandler to eliminate duplicate definition
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Pagination helper — validates & clamps page/limit to safe positive integers
 */
const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (p - 1) * l;
  return { page: p, limit: l, offset };
};

/**
 * Sanitize a string: trim, collapse whitespace, enforce max length
 */
const sanitizeString = (str, maxLength = 500) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').slice(0, maxLength);
};

/**
 * Build pagination response
 */
const paginatedResponse = (data, total, page, limit) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

/**
 * Format date to ISO string (date only)
 */
const formatDate = (date) => {
  if (!date) return null;
  // Fix #33: Guard against Invalid Date crash
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @deprecated Use utils/geo.js calculateDistance() instead — it uses geolib for accuracy.
 * Kept for backward compatibility but delegates to geo.js.
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const { calculateDistance: geoCalc } = require('./geo');
  return geoCalc({ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 });
};

/**
 * Sanitize user object (remove sensitive fields)
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
};

module.exports = {
  asyncHandler,
  paginate,
  paginatedResponse,
  formatDate,
  calculateDistance,
  sanitizeUser,
  sanitizeString,
};
