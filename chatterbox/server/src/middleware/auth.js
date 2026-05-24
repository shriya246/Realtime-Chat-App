/**
 * Purpose: Verifies JWTs, rejects blacklisted tokens, and attaches the current user to requests.
 */

const User = require('../models/User');
const redisService = require('../services/redisService');
const { authError } = require('../utils/errors');
const { verifyToken } = require('../utils/jwt');

/**
 * Extracts a bearer token from an Authorization header.
 *
 * @param {string|undefined} authorizationHeader - HTTP Authorization header.
 * @returns {string|null} JWT token or null.
 */
const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.slice('Bearer '.length).trim();
};

/**
 * Express middleware that authenticates the current request.
 *
 * @param {object} req - Express request.
 * @param {object} _res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<void>} Resolves after authentication.
 */
const authenticate = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return next(authError('Authentication token is required.'));
    }

    const blacklisted = await redisService.isTokenBlacklisted(token);

    if (blacklisted) {
      return next(authError('Authentication token has been revoked.'));
    }

    let decodedToken;

    try {
      decodedToken = verifyToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(authError('Authentication token has expired.'));
      }

      return next(authError('Authentication token is invalid.'));
    }

    const user = await User.findById(decodedToken.sub);

    if (!user) {
      return next(authError('Authenticated user no longer exists.'));
    }

    req.user = user;
    req.token = token;
    req.tokenPayload = decodedToken;

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  authenticate,
  extractBearerToken
};
