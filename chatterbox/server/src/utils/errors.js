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
 * Request validation failure carrying field-level detail.
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Human-readable error message.
   * @param {Array<object>|object|null} details - Validation details.
   */
  constructor(message = 'Request validation failed.', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Invalid or missing authentication credential failure.
 */
class AuthError extends AppError {
  /**
   * @param {string} message - Human-readable error message.
   */
  constructor(message = 'Authentication required.') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthError';
  }
}

/**
 * Authenticated user authorization failure.
 */
class ForbiddenError extends AppError {
  /**
   * @param {string} message - Human-readable error message.
   */
  constructor(message = 'You are not authorized to perform this action.') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'ForbiddenError';
  }
}

/**
 * Missing resource failure.
 */
class NotFoundError extends AppError {
  /**
   * @param {string} message - Human-readable error message.
   */
  constructor(message = 'Resource not found.') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Resource uniqueness or state-conflict failure.
 */
class ConflictError extends AppError {
  /**
   * @param {string} message - Human-readable error message.
   */
  constructor(message = 'Resource already exists.') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
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
  new ValidationError(message, details);

/**
 * Creates an authentication error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured authentication error.
 */
const authError = (message = 'Authentication required.') =>
  new AuthError(message);

/**
 * Creates an authorization error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured authorization error.
 */
const forbiddenError = (message = 'You are not authorized to perform this action.') =>
  new ForbiddenError(message);

/**
 * Creates a not-found error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured not-found error.
 */
const notFoundError = (message = 'Resource not found.') =>
  new NotFoundError(message);

/**
 * Creates a conflict error.
 *
 * @param {string} message - Error message.
 * @returns {AppError} Configured conflict error.
 */
const conflictError = (message = 'Resource already exists.') =>
  new ConflictError(message);

module.exports = {
  AppError,
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  authError,
  conflictError,
  forbiddenError,
  notFoundError,
  validationError
};
