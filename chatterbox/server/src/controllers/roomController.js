/**
 * Purpose: Implements protected REST operations for chat room discovery and membership management.
 */

const mongoose = require('mongoose');

const Room = require('../models/Room');
const User = require('../models/User');
const redisService = require('../services/redisService');
const { conflictError, forbiddenError, notFoundError, validationError } = require('../utils/errors');

const ROOM_TYPES = ['public', 'private'];

/**
 * Determines whether a user may view or join a room.
 *
 * @param {object} room - Mongoose room document.
 * @param {string} userId - Current user's identifier.
 * @returns {boolean} True if access is permitted.
 */
const canAccessRoom = (room, userId) =>
  room.type === 'public' || room.members.some((memberId) => memberId.toString() === userId.toString());

/**
 * Returns validation details for a new room payload.
 *
 * @param {object} payload - Request body.
 * @returns {Array<object>} Validation problems.
 */
const validateRoomPayload = (payload) => {
  const errors = [];
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const type = payload.type || 'public';

  if (!name || name.length > 80) {
    errors.push({ field: 'name', message: 'Room name must be between 1 and 80 characters.' });
  }

  if (!ROOM_TYPES.includes(type)) {
    errors.push({ field: 'type', message: 'Room type must be public or private.' });
  }

  if (payload.members && !Array.isArray(payload.members)) {
    errors.push({ field: 'members', message: 'Members must be an array of user identifiers.' });
  }

  return errors;
};

/**
 * Loads a room or hands a controlled error to middleware.
 *
 * @param {string} roomId - Room identifier.
 * @returns {Promise<object>} Existing room.
 */
const findRoom = async (roomId) => {
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw validationError('Invalid room identifier.', [{ field: 'id', message: 'Room ID must be a valid ObjectId.' }]);
  }

  const room = await Room.findById(roomId);

  if (!room) {
    throw notFoundError('Room not found.');
  }

  return room;
};

/**
 * Creates a chat room with its creator as a member.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const createRoom = async (req, res, next) => {
  try {
    const errors = validateRoomPayload(req.body);

    if (errors.length > 0) {
      return next(validationError('Room validation failed.', errors));
    }

    const type = req.body.type || 'public';
    const suppliedMembers = type === 'private' && Array.isArray(req.body.members) ? req.body.members : [];
    const members = [...new Set([req.user.id, ...suppliedMembers])];

    if (members.some((memberId) => !mongoose.Types.ObjectId.isValid(memberId))) {
      return next(validationError('Room validation failed.', [{ field: 'members', message: 'Every member must be a valid user identifier.' }]));
    }

    const memberCount = await User.countDocuments({ _id: { $in: members } });

    if (memberCount !== members.length) {
      return next(validationError('Room validation failed.', [{ field: 'members', message: 'Every member must identify an existing user.' }]));
    }

    const room = await Room.create({
      name: req.body.name.trim(),
      type,
      members,
      createdBy: req.user._id
    });

    return res.status(201).json({
      success: true,
      data: {
        room: room.toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Lists public rooms and private rooms available to the user.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const getRooms = async (req, res, next) => {
  try {
    const filters = [
      {
        $or: [{ type: 'public' }, { members: req.user._id }]
      }
    ];

    if (req.query.type) {
      if (!ROOM_TYPES.includes(req.query.type)) {
        return next(validationError('Invalid room type filter.', [{ field: 'type', message: 'Room type must be public or private.' }]));
      }

      filters.push({ type: req.query.type });
    }

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const escapedSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.push({ name: new RegExp(escapedSearch, 'i') });
    }

    const rooms = await Room.find({ $and: filters }).sort({ updatedAt: -1, name: 1 });

    return res.status(200).json({
      success: true,
      data: {
        rooms: rooms.map((room) => room.toJSON())
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns room details if visible to the current user.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const getRoomById = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);

    if (!canAccessRoom(room, req.user.id)) {
      return next(forbiddenError('You do not have access to this room.'));
    }

    return res.status(200).json({
      success: true,
      data: {
        room: room.toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Adds a user to a private room managed by its creator.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const addMember = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);
    const { userId } = req.body;

    if (room.createdBy.toString() !== req.user.id) {
      return next(forbiddenError('Only the room creator can add members.'));
    }

    if (room.type !== 'private') {
      return next(validationError('Public rooms do not require managed membership.'));
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(validationError('Invalid member identifier.', [{ field: 'userId', message: 'User ID must be a valid ObjectId.' }]));
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(notFoundError('User not found.'));
    }

    if (room.members.some((memberId) => memberId.toString() === userId)) {
      return next(conflictError('User is already a room member.'));
    }

    room.members.push(user._id);
    await room.save();
    await redisService.invalidateRoomCache(room.id);

    return res.status(200).json({
      success: true,
      data: {
        room: room.toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Removes the current member from a room.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const leaveRoom = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);

    if (room.createdBy.toString() === req.user.id) {
      return next(forbiddenError('The room creator cannot leave without transferring ownership.'));
    }

    if (!room.members.some((memberId) => memberId.toString() === req.user.id)) {
      return next(notFoundError('You are not a member of this room.'));
    }

    room.members = room.members.filter((memberId) => memberId.toString() !== req.user.id);
    await room.save();
    await redisService.invalidateRoomCache(room.id);

    return res.status(200).json({
      success: true,
      data: {
        room: room.toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addMember,
  canAccessRoom,
  createRoom,
  findRoom,
  getRoomById,
  getRooms,
  leaveRoom
};
