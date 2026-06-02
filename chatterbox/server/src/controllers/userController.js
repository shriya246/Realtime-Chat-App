/**
 * Purpose: Implements authenticated user search and profile lookup endpoints.
 */

const mongoose = require('mongoose');

const Attachment = require('../models/Attachment');
const User = require('../models/User');
const { notFoundError, validationError } = require('../utils/errors');

const DEFAULT_USER_SEARCH_LIMIT = 20;

/**
 * Formats a public profile with avatar URL when present.
 *
 * @param {object} user - User document.
 * @returns {object} Safe profile payload.
 */
const formatUserProfile = (user) => {
  const payload = user.toJSON();
  const avatarId = user.avatarAttachmentId?._id || user.avatarAttachmentId;

  payload.displayName = payload.displayName || '';
  payload.about = payload.about || '';
  payload.avatarUrl = avatarId ? `/api/attachments/${avatarId.toString()}/content` : null;
  return payload;
};

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
        users: users.map((user) => formatUserProfile(user))
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
        user: formatUserProfile(user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Updates the authenticated user's public profile.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const updateCurrentUser = async (req, res, next) => {
  try {
    if (req.body.avatarAttachmentId) {
      const avatar = await Attachment.findById(req.body.avatarAttachmentId);

      if (!avatar || avatar.purpose !== 'avatar' || avatar.ownerId.toString() !== req.user.id) {
        return next(validationError('Invalid avatar attachment.', [
          { field: 'avatarAttachmentId', message: 'Avatar must be an uploaded image owned by you.' }
        ]));
      }
    }

    const updates = {};

    if (req.body.displayName !== undefined) {
      updates.displayName = req.body.displayName.trim();
    }

    if (req.body.about !== undefined) {
      updates.about = req.body.about.trim();
    }

    if (req.body.avatarAttachmentId !== undefined) {
      updates.avatarAttachmentId = req.body.avatarAttachmentId || null;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });

    return res.status(200).json({
      success: true,
      data: {
        user: formatUserProfile(user)
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  formatUserProfile,
  getUserById,
  searchUsers,
  updateCurrentUser
};
