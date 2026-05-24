/**
 * Purpose: Provides JWT signing and token-expiry helpers for authentication workflows.
 */

const jwt = require('jsonwebtoken');

const DEFAULT_JWT_EXPIRES_IN = '1h';
const DEFAULT_BLACKLIST_TTL_SECONDS = 60 * 60;

/**
 * Returns the configured JWT secret or a safe test-only fallback.
 *
 * @returns {string} JWT secret.
 */
const getJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-only-chatterbox-jwt-secret';
  }

  throw new Error('JWT_SECRET is required.');
};

/**
 * Signs a JWT for a user.
 *
 * @param {object} user - Mongoose user document or plain user object.
 * @returns {string} Signed JWT.
 */
const signToken = (user) => {
  const payload = {
    sub: user.id || user._id.toString(),
    username: user.username,
    email: user.email
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN
  });
};

/**
 * Verifies a JWT.
 *
 * @param {string} token - JWT to verify.
 * @returns {object} Decoded token payload.
 */
const verifyToken = (token) => jwt.verify(token, getJwtSecret());

/**
 * Calculates a Redis blacklist TTL from a decoded JWT.
 *
 * @param {object} decodedToken - Decoded JWT payload.
 * @returns {number} TTL in seconds.
 */
const getTokenTtlSeconds = (decodedToken) => {
  if (!decodedToken.exp) {
    return DEFAULT_BLACKLIST_TTL_SECONDS;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(decodedToken.exp - nowSeconds, 1);
};

module.exports = {
  getJwtSecret,
  getTokenTtlSeconds,
  signToken,
  verifyToken
};
