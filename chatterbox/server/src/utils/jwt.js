/**
 * Purpose: Provides JWT signing and token-expiry helpers for authentication workflows.
 */

const jwt = require('jsonwebtoken');

const { getConfig } = require('../config');

const DEFAULT_BLACKLIST_TTL_SECONDS = 60 * 60;

/**
 * Returns the configured JWT secret or a safe test-only fallback.
 *
 * @returns {string} JWT secret.
 */
const getJwtSecret = () => {
  const { secret } = getConfig().jwt;

  if (secret) {
    return secret;
  }

  throw new Error('JWT_SECRET is required.');
};

/**
 * Signs a JWT for a user.
 *
 * @param {object} user - Mongoose user document or plain user object.
 * @param {string|null} sessionId - Optional session identifier.
 * @returns {string} Signed JWT.
 */
const signToken = (user, sessionId = null) => {
  const payload = {
    sub: user.id || user._id.toString(),
    username: user.username,
    email: user.email
  };

  if (sessionId) {
    payload.sid = sessionId;
  }

  return jwt.sign(payload, getJwtSecret(), { expiresIn: getConfig().jwt.expiresIn });
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
