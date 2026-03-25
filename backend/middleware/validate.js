/**
 * Validation Middleware
 * Uses express-validator for request validation
 */
const { validationResult, param } = require('express-validator');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate request using express-validator chain
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Validate that a route :param is a valid UUID v4.
 * Usage: router.get('/:id', validateUUID('id'), validate, handler)
 */
const validateUUID = (paramName = 'id') =>
  param(paramName)
    .matches(UUID_REGEX)
    .withMessage(`${paramName} must be a valid UUID`);

module.exports = { validate, validateUUID, UUID_REGEX };
