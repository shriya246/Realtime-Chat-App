/**
 * Purpose: Implements authentication workflows for register, login, logout, and current-user lookup.
 */

const crypto = require('crypto');

const User = require('../models/User');
const redisService = require('../services/redisService');
const { createSessionRecord, revokeSession } = require('../services/sessionService');
const { formatUserProfile } = require('./userController');
const { conflictError, validationError, authError } = require('../utils/errors');
const { getTokenTtlSeconds, signToken, verifyToken } = require('../utils/jwt');

const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates registration input.
 *
 * @param {object} payload - Request body payload.
 * @returns {Array<object>} Validation error details.
 */
const validateRegistrationPayload = (payload) => {
  const errors = [];
  const { username, email, password } = payload;

  if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
    errors.push({ field: 'username', message: 'Username must be between 3 and 30 characters.' });
  } else if (!USERNAME_PATTERN.test(username.trim())) {
    errors.push({ field: 'username', message: 'Username may only contain letters, numbers, underscores, and hyphens.' });
  }

  if (!email || typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    errors.push({ field: 'email', message: 'A valid email address is required.' });
  }

  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    errors.push({ field: 'password', message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  return errors;
};

/**
 * Validates login input.
 *
 * @param {object} payload - Request body payload.
 * @returns {Array<object>} Validation error details.
 */
const validateLoginPayload = (payload) => {
  const errors = [];
  const { email, password } = payload;

  if (!email || typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    errors.push({ field: 'email', message: 'A valid email address is required.' });
  }

  if (!password || typeof password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required.' });
  }

  return errors;
};

/**
 * Builds the successful auth response body.
 *
 * @param {object} user - Mongoose user document.
 * @param {string} token - Signed JWT.
 * @returns {object} Auth response payload.
 */
const buildAuthResponse = (user, token, session = null) => ({
  success: true,
  data: {
    session: session?.toJSON ? session.toJSON() : session,
    token,
    user: formatUserProfile(user)
  }
});

/**
 * Registers a new user.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const register = async (req, res, next) => {
  try {
    const validationErrors = validateRegistrationPayload(req.body);

    if (validationErrors.length > 0) {
      return next(validationError('Registration validation failed.', validationErrors));
    }

    const username = req.body.username.trim();
    const email = req.body.email.trim().toLowerCase();
    const { password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser?.email === email) {
      return next(conflictError('An account with this email already exists.'));
    }

    if (existingUser?.username === username) {
      return next(conflictError('An account with this username already exists.'));
    }

    const user = await User.create({
      username,
      email,
      passwordHash: password
    });

    const sessionId = crypto.randomUUID();
    const token = signToken(user, sessionId);
    const decodedToken = verifyToken(token);
    const session = await createSessionRecord({ decodedToken, req, token, userId: user._id });

    return res.status(201).json(buildAuthResponse(user, token, session));
  } catch (error) {
    return next(error);
  }
};

/**
 * Authenticates a user with email and password.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const login = async (req, res, next) => {
  try {
    const validationErrors = validateLoginPayload(req.body);

    if (validationErrors.length > 0) {
      return next(validationError('Login validation failed.', validationErrors));
    }

    const email = req.body.email.trim().toLowerCase();
    const { password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(authError('Invalid email or password.'));
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return next(authError('Invalid email or password.'));
    }

    const sessionId = crypto.randomUUID();
    const token = signToken(user, sessionId);
    const decodedToken = verifyToken(token);
    const session = await createSessionRecord({ decodedToken, req, token, userId: user._id });

    return res.status(200).json(buildAuthResponse(user, token, session));
  } catch (error) {
    return next(error);
  }
};

/**
 * Logs out the current user by blacklisting their active JWT.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const logout = async (req, res, next) => {
  try {
    const ttlSeconds = getTokenTtlSeconds(req.tokenPayload);
    await redisService.blacklistToken(req.token, ttlSeconds);
    if (req.tokenPayload.sid) {
      await revokeSession(req.tokenPayload.sid, req.user._id);
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'Logged out successfully.'
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns the authenticated user profile.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: formatUserProfile(req.user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMe,
  login,
  logout,
  register,
  validateLoginPayload,
  validateRegistrationPayload
};
