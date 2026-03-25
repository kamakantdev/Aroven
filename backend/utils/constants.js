/**
 * Application Constants
 * Fix #50: Centralize magic numbers and strings used across the codebase.
 */

// Appointment status transitions (state machine)
const APPOINTMENT_STATUS_TRANSITIONS = {
  scheduled:    ['confirmed', 'cancelled', 'no_show'],
  confirmed:    ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress:  ['completed', 'cancelled'],
  completed:    [],
  cancelled:    [],
  no_show:      ['scheduled'],
};

// Emergency request status transitions
const EMERGENCY_STATUS_TRANSITIONS = {
  pending:           ['broadcasting', 'assigned', 'cancelled', 'no_ambulance'],
  broadcasting:      ['accepted', 'timeout', 'cancelled'],
  assigned:          ['accepted', 'cancelled', 'timeout'],
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

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// File upload limits
const UPLOAD = {
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
};

// Chat message limits
const CHAT = {
  MAX_MESSAGE_LENGTH: 2000,
  MAX_MEMORY_MESSAGES: 6,
  MAX_MESSAGES_PER_SESSION: 20,
  MAX_MESSAGES_PER_DAY: 100,
};

// Auth constants
const AUTH = {
  ACCESS_TOKEN_EXPIRY: '1h',
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  PASSWORD_MIN_LENGTH: 8,
  BCRYPT_SALT_ROUNDS: 12,
  AUTH_CACHE_TTL_SECONDS: 300,
};

// Rate limiting
const RATE_LIMITS = {
  REGISTER: { max: 5, windowSeconds: 3600, windowLabel: 'per hour' },
  LOGIN: { max: 10, windowSeconds: 900, windowLabel: 'per 15 minutes' },
  FORGOT_PASSWORD: { max: 3, windowSeconds: 3600, windowLabel: 'per hour' },
  RESET_PASSWORD: { max: 5, windowSeconds: 3600, windowLabel: 'per hour' },
};

// Valid enums
const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Dispatch configuration
const DISPATCH = {
  ACCEPT_TIMEOUT_MS: 30_000,
  MAX_BROADCAST_ROUNDS: 3,
  BROADCAST_RADIUS_KM: [10, 25, 50],
};

// Health card
const HEALTH_CARD = {
  TOKEN_EXPIRY_SECONDS: 86400, // 24 hours
  TOKEN_PREFIX: 'health_card:',
  REVERSE_PREFIX: 'health_card_user:',
};

module.exports = {
  APPOINTMENT_STATUS_TRANSITIONS,
  EMERGENCY_STATUS_TRANSITIONS,
  PAGINATION,
  UPLOAD,
  CHAT,
  AUTH,
  RATE_LIMITS,
  VALID_GENDERS,
  VALID_BLOOD_GROUPS,
  DISPATCH,
  HEALTH_CARD,
};
