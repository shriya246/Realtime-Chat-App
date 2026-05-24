/**
 * Purpose: Defines reusable HTTP error classes and helpers for consistent API failures.
 */

const DEFAULT_STATUS_CODE = 500;

/**
 * Application error with an HTTP status and stable machine-readable code.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {number} statusCode - HTTP status code.
   * @param {string} code - Stable error code for clients.
   * @param {Array<object>|object|null} details - Optional structured details.
   */
  constructor(message, statusCode = DEFAULT_STATUS_CODE, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Creates a validation error.
 *
 * @param {string} message - Error message.
 * @param {Array<object>|object|null} details - Validation details.
 * @returns {AppError} Configured validation error.
 */
const validationError = (message = 'Request validation failed.', details = null) =>
  new AppError(message, 400, 'VALIDATION_ERROR', details);

/**
 * Creates an authentication error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured authentication error.
 */
const authError = (message = 'Authentication required.') =>
  new AppError(message, 401, 'AUTHENTICATION_ERROR');

/**
 * Creates an authorization error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured authorization error.
 */
const forbiddenError = (message = 'You are not authorized to perform this action.') =>
  new AppError(message, 403, 'AUTHORIZATION_ERROR');

/**
 * Creates a not-found error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured not-found error.
 */
const notFoundError = (message = 'Resource not found.') =>
  new AppError(message, 404, 'NOT_FOUND');

/**
 * Creates a conflict error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured conflict error.
 */
const conflictError = (message = 'Resource already exists.') =>
  new AppError(message, 409, 'CONFLICT');

module.exports = {
  AppError,
  authError,
  conflictError,
  forbiddenError,
  notFoundError,
  validationError
};
