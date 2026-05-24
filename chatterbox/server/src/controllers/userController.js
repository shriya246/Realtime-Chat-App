/**
 * Purpose: Implements authenticated user search and profile lookup endpoints.
 */

const mongoose = require('mongoose');

const User = require('../models/User');
const { notFoundError, validationError } = require('../utils/errors');

const DEFAULT_USER_SEARCH_LIMIT = 20;

/**
 * Searches users by username or email.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const searchUsers = async (req, res, next) => {
  try {
    const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const escapedSearch = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');
    const query = rawSearch
      ? {
          $or: [{ username: searchRegex }, { email: searchRegex }]
        }
      : {};

    const users = await User.find(query)
      .select('-passwordHash')
      .limit(DEFAULT_USER_SEARCH_LIMIT)
      .sort({ username: 1 });

    return res.status(200).json({
      success: true,
      data: {
        users: users.map((user) => user.toJSON())
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Gets a public user profile by ID.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(validationError('Invalid user identifier.', [{ field: 'id', message: 'User ID must be a valid ObjectId.' }]));
    }

    const user = await User.findById(id).select('-passwordHash');

    if (!user) {
      return next(notFoundError('User not found.'));
    }

    return res.status(200).json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getUserById,
  searchUsers
};
