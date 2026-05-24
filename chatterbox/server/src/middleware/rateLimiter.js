/**
 * Purpose: Defines rate limiters for sensitive authentication endpoints.
 */

const rateLimit = require('express-rate-limit');

const DEFAULT_AUTH_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_AUTH_MAX_REQUESTS = 20;

/**
 * Creates the auth route rate limiter.
 *
 * @returns {Function} Express rate-limit middleware.
 */
const createAuthRateLimiter = () =>
  rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || DEFAULT_AUTH_WINDOW_MS),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || DEFAULT_AUTH_MAX_REQUESTS),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        details: null
      }
    }
  });

module.exports = {
  createAuthRateLimiter
};
