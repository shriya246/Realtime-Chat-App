/**
 * Purpose: Implements protected REST operations for chat room discovery and membership management.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

const Room = require('../models/Room');
const User = require('../models/User');
const redisService = require('../services/redisService');
const {
  assertRoomAdmin,
  assertRoomOwner,
  canEditRoomInfo,
  isRoomAdmin,
  isRoomOwner,
  normalizeDisappearingMode
} = require('../services/privacyService');
const { conflictError, forbiddenError, notFoundError, validationError } = require('../utils/errors');

const ROOM_TYPES = ['public', 'private'];

/**
 * Determines whether a user may view or join a room.
 *
 * @param {object} room - Mongoose room document.
 * @param {string} userId - Current user's identifier.
 * @returns {boolean} True if access is permitted.
 */
const extractId = (value) => value?.id || value?._id?.toString?.() || value?.toString?.() || value;

const canAccessRoom = (room, userId) =>
  room.type === 'public' || room.members.some((memberId) => extractId(memberId) === userId.toString());

const normalizeRoom = (room) => {
  const json = room.toJSON();
  const ownerId = extractId(json.ownerId || json.createdBy);
  const adminIds = new Set((json.admins || []).map((adminId) => extractId(adminId)));

  json.ownerId = ownerId;
  json.avatarUrl = json.avatarAttachmentId ? `/api/attachments/${json.avatarAttachmentId}/content` : null;
  json.myRole = null;
  json.members = (json.members || []).map((member) => {
    const memberId = extractId(member);
    return {
      ...(typeof member === 'object' && member.username ? member : {}),
      id: memberId,
      role: memberId === ownerId ? 'owner' : adminIds.has(memberId) ? 'admin' : 'member'
    };
  });
  return json;
};

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
      description: req.body.description || '',
      type,
      members,
      admins: [req.user._id],
      ownerId: req.user._id,
      createdBy: req.user._id
    });

    return res.status(201).json({
      success: true,
      data: {
        room: normalizeRoom(room)
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
        rooms: rooms.map((room) => normalizeRoom(room))
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
    const room = await Room.findById(req.params.id)
      .populate('members', 'username email displayName avatarAttachmentId')
      .populate('admins', 'username')
      .populate('ownerId', 'username');

    if (!room) {
      return next(notFoundError('Room not found.'));
    }

    if (!canAccessRoom(room, req.user.id)) {
      return next(forbiddenError('You do not have access to this room.'));
    }

    return res.status(200).json({
      success: true,
      data: {
        room: {
          ...normalizeRoom(room),
          myRole: isRoomOwner(room, req.user.id) ? 'owner' : isRoomAdmin(room, req.user.id) ? 'admin' : 'member'
        }
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

    assertRoomAdmin(room, req.user.id);

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
        room: normalizeRoom(room)
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

    if (isRoomOwner(room, req.user.id)) {
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
        room: normalizeRoom(room)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateRoom = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);

    if (!canEditRoomInfo(room, req.user.id)) {
      return next(forbiddenError('You cannot edit this group info.'));
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 80) {
        return next(validationError('Group name must be between 1 and 80 characters.'));
      }
      room.name = name;
    }

    if (req.body.description !== undefined) {
      room.description = String(req.body.description).trim().slice(0, 240);
    }

    if (req.body.avatarAttachmentId !== undefined) {
      room.avatarAttachmentId = req.body.avatarAttachmentId || null;
    }

    if (req.body.settings) {
      const settings = req.body.settings;
      if (settings.whoCanSendMessages) {
        room.settings.whoCanSendMessages = settings.whoCanSendMessages;
      }
      if (settings.whoCanEditInfo) {
        room.settings.whoCanEditInfo = settings.whoCanEditInfo;
      }
      if (settings.newMembersCanSeeRecentHistory !== undefined) {
        room.settings.newMembersCanSeeRecentHistory = Boolean(settings.newMembersCanSeeRecentHistory);
      }
      if (settings.joinApprovalRequired !== undefined) {
        room.settings.joinApprovalRequired = Boolean(settings.joinApprovalRequired);
      }
      if (settings.disappearingMode !== undefined) {
        room.settings.disappearingMode = normalizeDisappearingMode(settings.disappearingMode);
      }
    }

    await room.save();

    return res.status(200).json({
      success: true,
      data: { room: normalizeRoom(room) }
    });
  } catch (error) {
    return next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);
    const { userId } = req.params;

    assertRoomAdmin(room, req.user.id);

    if (isRoomOwner(room, userId)) {
      return next(forbiddenError('The group owner cannot be removed.'));
    }

    room.members = room.members.filter((memberId) => memberId.toString() !== userId);
    room.admins = room.admins.filter((adminId) => adminId.toString() !== userId);
    await room.save();
    await redisService.invalidateRoomCache(room.id);

    return res.status(200).json({ success: true, data: { room: normalizeRoom(room) } });
  } catch (error) {
    return next(error);
  }
};

const updateAdmin = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);
    const { userId } = req.params;
    const promote = req.body.admin !== false;

    assertRoomOwner(room, req.user.id);

    if (!room.members.some((memberId) => memberId.toString() === userId)) {
      return next(notFoundError('User is not a group member.'));
    }

    if (promote && !room.admins.some((adminId) => adminId.toString() === userId)) {
      room.admins.push(userId);
    }

    if (!promote && !isRoomOwner(room, userId)) {
      room.admins = room.admins.filter((adminId) => adminId.toString() !== userId);
    }

    await room.save();
    return res.status(200).json({ success: true, data: { room: normalizeRoom(room) } });
  } catch (error) {
    return next(error);
  }
};

const deleteRoom = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);
    assertRoomOwner(room, req.user.id);
    await Room.deleteOne({ _id: room._id });
    await redisService.invalidateRoomCache(room.id);
    return res.status(200).json({ success: true, data: { deleted: true, roomId: room.id } });
  } catch (error) {
    return next(error);
  }
};

const generateInvite = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);
    assertRoomAdmin(room, req.user.id);
    room.inviteToken = crypto.randomBytes(24).toString('hex');
    room.inviteRevokedAt = null;
    await room.save();
    return res.status(200).json({
      success: true,
      data: {
        inviteToken: room.inviteToken,
        inviteLink: `/join/${room.inviteToken}`,
        room: normalizeRoom(room)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const joinByInvite = async (req, res, next) => {
  try {
    const room = await Room.findOne({ inviteToken: req.params.token });

    if (!room || room.inviteRevokedAt) {
      return next(notFoundError('Invite link is not valid.'));
    }

    if (room.members.some((memberId) => memberId.toString() === req.user.id)) {
      return res.status(200).json({ success: true, data: { room: normalizeRoom(room), joined: true } });
    }

    if (room.settings?.joinApprovalRequired) {
      const existingRequest = room.joinRequests.find((request) => request.userId.toString() === req.user.id && request.status === 'pending');
      if (!existingRequest) {
        room.joinRequests.push({ userId: req.user._id });
        await room.save();
      }
      return res.status(202).json({ success: true, data: { pendingApproval: true, room: normalizeRoom(room) } });
    }

    room.members.push(req.user._id);
    await room.save();
    await redisService.invalidateRoomCache(room.id);
    return res.status(200).json({ success: true, data: { room: normalizeRoom(room), joined: true } });
  } catch (error) {
    return next(error);
  }
};

const resolveJoinRequest = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);
    assertRoomAdmin(room, req.user.id);

    const request = room.joinRequests.find((entry) => entry.userId.toString() === req.params.userId && entry.status === 'pending');
    if (!request) {
      return next(notFoundError('Pending join request not found.'));
    }

    request.status = req.body.approved ? 'approved' : 'rejected';
    request.resolvedAt = new Date();
    request.resolvedBy = req.user._id;

    if (req.body.approved && !room.members.some((memberId) => memberId.toString() === req.params.userId)) {
      room.members.push(req.params.userId);
    }

    await room.save();
    await redisService.invalidateRoomCache(room.id);
    return res.status(200).json({ success: true, data: { room: normalizeRoom(room), request } });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addMember,
  canAccessRoom,
  createRoom,
  deleteRoom,
  findRoom,
  generateInvite,
  getRoomById,
  getRooms,
  joinByInvite,
  leaveRoom,
  normalizeRoom,
  removeMember,
  resolveJoinRequest,
  updateAdmin,
  updateRoom
};
