/**
 * Error Factory — Fix #53: Standardize error creation across the codebase.
 *
 * Provides factory functions for common error patterns so every service
 * throws consistently structured ApiError instances instead of mixing
 * `new Error()` with manual statusCode assignment.
 */
const { ApiError } = require('../middleware/errorHandler');

const errors = {
  notFound: (entity = 'Resource') =>
    new ApiError(404, `${entity} not found`),

  unauthorized: (message = 'Unauthorized') =>
    new ApiError(401, message),

  forbidden: (message = 'You do not have permission to perform this action') =>
    new ApiError(403, message),

  badRequest: (message = 'Bad request') =>
    new ApiError(400, message),

  conflict: (message = 'Resource already exists') =>
    new ApiError(409, message),

  tooManyRequests: (message = 'Too many requests. Please try again later.') =>
    new ApiError(429, message),

  internal: (message = 'Internal server error') =>
    new ApiError(500, message),

  validationFailed: (details) =>
    new ApiError(400, 'Validation failed', details),
};

module.exports = errors;
