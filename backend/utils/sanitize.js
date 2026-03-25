/**
 * Input Sanitization Utilities
 * Fixes C4: PostgREST filter injection across all search endpoints
 */

/**
 * Sanitize a search string for safe use in Supabase PostgREST .or() / .ilike() filters.
 * Escapes characters that have special meaning in PostgREST filter DSL:
 *   , . ( ) % _ \
 *
 * @param {string} input — raw user search input
 * @returns {string} — sanitized string safe for interpolation into .or() filters
 */
const sanitizeSearch = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/\\/g, '\\\\')   // backslash must be first
    .replace(/%/g, '\\%')     // wildcard
    .replace(/_/g, '\\_')     // single-char wildcard
    .replace(/,/g, '')        // PostgREST OR separator
    .replace(/\./g, '')       // PostgREST column separator
    .replace(/\(/g, '')       // PostgREST grouping
    .replace(/\)/g, '')       // PostgREST grouping
    .trim()
    .slice(0, 200);           // prevent extremely long search strings
};

/**
 * Validate latitude value
 * @param {number} lat
 * @returns {boolean}
 */
const isValidLatitude = (lat) => {
  const num = Number(lat);
  return !isNaN(num) && num >= -90 && num <= 90;
};

/**
 * Validate longitude value
 * @param {number} lng
 * @returns {boolean}
 */
const isValidLongitude = (lng) => {
  const num = Number(lng);
  return !isNaN(num) && num >= -180 && num <= 180;
};

/**
 * Validate and clamp a radius value
 * @param {number} radius
 * @param {number} max — maximum allowed radius in km
 * @returns {number}
 */
const clampRadius = (radius, max = 100) => {
  const num = Number(radius);
  if (isNaN(num) || num <= 0) return 10; // default
  return Math.min(num, max);
};

/**
 * Whitelist-filter an object: only keep keys that appear in allowedKeys.
 * Prevents mass-assignment attacks (M1, pharmacy/clinic/diagnostic updates).
 * @param {object} obj
 * @param {string[]} allowedKeys
 * @returns {object}
 */
const filterAllowedFields = (obj, allowedKeys) => {
  if (!obj || typeof obj !== 'object') return {};
  const filtered = {};
  for (const key of allowedKeys) {
    if (obj[key] !== undefined) {
      filtered[key] = obj[key];
    }
  }
  return filtered;
};

module.exports = {
  sanitizeSearch,
  isValidLatitude,
  isValidLongitude,
  clampRadius,
  filterAllowedFields,
};
