/**
 * Purpose: Converts thrown errors into consistent JSON API responses.
 */

const mongoose = require('mongoose');

const { AppError } = require('../utils/errors');

/**
 * Maps known library errors to application error responses.
 *
 * @param {Error} error - Error to normalize.
 * @returns {AppError} Normalized application error.
 */
const normalizeError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((fieldError) => ({
      field: fieldError.path,
      message: fieldError.message
    }));

    return new AppError('Request validation failed.', 400, 'VALIDATION_ERROR', details);
  }

  if (error instanceof mongoose.Error.CastError) {
    return new AppError('Invalid resource identifier.', 400, 'INVALID_ID');
  }

  if (error.code === 11000) {
    const fields = Object.keys(error.keyPattern || {});
    return new AppError('A resource with that value already exists.', 409, 'CONFLICT', { fields });
  }

  return new AppError('An unexpected server error occurred.', 500, 'INTERNAL_SERVER_ERROR');
};

/**
 * Express not-found middleware for unknown routes.
 *
 * @param {object} req - Express request.
 * @param {object} _res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {void} Passes a not-found error to the error handler.
 */
const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
};

/**
 * Express global error handler.
 *
 * @param {Error} error - Error thrown in the middleware chain.
 * @param {object} _req - Express request.
 * @param {object} res - Express response.
 * @param {Function} _next - Express next callback.
 * @returns {object} JSON error response.
 */
const errorHandler = (error, _req, res, _next) => {
  const normalizedError = normalizeError(error);

  if (process.env.NODE_ENV !== 'test' && normalizedError.statusCode >= 500) {
    console.error(normalizedError.stack || normalizedError.message);
  }

  return res.status(normalizedError.statusCode).json({
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      details: normalizedError.details
    }
  });
};

module.exports = {
  errorHandler,
  normalizeError,
  notFoundHandler
};
