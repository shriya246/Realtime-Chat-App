/**
 * Purpose: Provides application-level Redis operations for auth token blacklist state.
 */

const redis = require('../config/redis');

/**
 * Builds the Redis key used to blacklist a JWT.
 *
 * @param {string} token - JWT value.
 * @returns {string} Redis blacklist key.
 */
const buildBlacklistKey = (token) => `blacklist:${token}`;

/**
 * Adds a token to the Redis blacklist for its remaining lifetime.
 *
 * @param {string} token - JWT to blacklist.
 * @param {number} ttlSeconds - Token time-to-live in seconds.
 * @returns {Promise<void>} Resolves after the token is blacklisted.
 */
const blacklistToken = async (token, ttlSeconds) => {
  try {
    await redis.set(buildBlacklistKey(token), '1', ttlSeconds);
  } catch (error) {
    throw error;
  }
};

/**
 * Checks whether a token is blacklisted.
 *
 * @param {string} token - JWT to check.
 * @returns {Promise<boolean>} True when the token is blacklisted.
 */
const isTokenBlacklisted = async (token) => {
  try {
    const value = await redis.get(buildBlacklistKey(token));
    return value === '1';
  } catch (error) {
    throw error;
  }
};

module.exports = {
  blacklistToken,
  isTokenBlacklisted
};
