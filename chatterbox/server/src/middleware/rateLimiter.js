/**
 * Purpose: Defines rate limiters for sensitive authentication endpoints.
 */

const rateLimit = require('express-rate-limit');

const { getConfig } = require('../config');

/**
 * Creates the auth route rate limiter.
 *
 * @returns {Function} Express rate-limit middleware.
 */
const createAuthRateLimiter = () => {
  const config = getConfig();

  return rateLimit({
    windowMs: config.security.authWindowMs,
    max: config.security.authMaxRequests,
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
};

module.exports = {
  createAuthRateLimiter
};
