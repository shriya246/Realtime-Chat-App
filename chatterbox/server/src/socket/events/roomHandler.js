/**
 * Purpose: Handles room joins/leaves and serves recent message history through Socket.io.
 */

const Message = require('../../models/Message');
const Room = require('../../models/Room');
const { getConfig } = require('../../config');
const { normalizeRoom } = require('../../controllers/roomController');
const {
  assertRoomAdmin,
  assertRoomOwner,
  isExpiredFilter,
  normalizeDisappearingMode
} = require('../../services/privacyService');
const redisService = require('../../services/redisService');
const { emitSocketError, formatMessage, getAccessibleRoom } = require('../socketUtils');

/**
 * Loads recent history from cache or MongoDB and warms Redis after misses.
 *
 * @param {string} roomId - Room identifier.
 * @returns {Promise<object>} History messages and cache source.
 */
const loadMessageHistory = async (roomId) => {
  try {
    const cachedMessages = await redisService.getCachedMessages(roomId);

    if (cachedMessages) {
      return {
        messages: cachedMessages,
        source: 'cache'
      };
    }

    const { messageHistoryLimit: limit } = getConfig().cache;
    const records = await Message.find({ roomId, ...isExpiredFilter() })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('senderId', 'username');
    const messages = records.reverse().map((message) => formatMessage(message));

    await redisService.cacheMessages(roomId, messages);

    return {
      messages,
      source: 'database'
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Registers room events for a connected socket.
 *
 * @param {object} io - Socket.io server.
 * @param {object} socket - Authenticated Socket.io socket.
 * @returns {void}
 */
const registerRoomHandlers = (io, socket) => {
  socket.on('join_room', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      const roomId = room.id;

      await socket.join(roomId);

      const history = await loadMessageHistory(roomId);
      const responsePayload = {
        roomId,
        messages: history.messages,
        source: history.source
      };

      socket.emit('message_history', responsePayload);

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: responsePayload
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('leave_room', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      await socket.leave(room.id);

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            roomId: room.id
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('group:update', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      assertRoomAdmin(room, socket.user.id);

      if (payload.name !== undefined) {
        room.name = String(payload.name).trim().slice(0, 80);
      }
      if (payload.description !== undefined) {
        room.description = String(payload.description).trim().slice(0, 240);
      }
      if (payload.settings) {
        Object.assign(room.settings, payload.settings);
        if (payload.settings.disappearingMode !== undefined) {
          room.settings.disappearingMode = normalizeDisappearingMode(payload.settings.disappearingMode);
        }
      }

      await room.save();
      const groupPayload = { room: normalizeRoom(room) };
      io.to(room.id).emit('group:update', groupPayload);
      acknowledgement?.({ success: true, data: groupPayload });
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('group:member:add', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      assertRoomAdmin(room, socket.user.id);
      if (!room.members.some((memberId) => memberId.toString() === payload.userId)) {
        room.members.push(payload.userId);
      }
      await room.save();
      await redisService.invalidateRoomCache(room.id);
      const groupPayload = { room: normalizeRoom(room) };
      io.to(room.id).emit('group:member:add', groupPayload);
      acknowledgement?.({ success: true, data: groupPayload });
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('group:member:remove', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      assertRoomAdmin(room, socket.user.id);
      room.members = room.members.filter((memberId) => memberId.toString() !== payload.userId);
      room.admins = room.admins.filter((adminId) => adminId.toString() !== payload.userId);
      await room.save();
      await redisService.invalidateRoomCache(room.id);
      const groupPayload = { room: normalizeRoom(room), removedUserId: payload.userId };
      io.to(room.id).emit('group:member:remove', groupPayload);
      acknowledgement?.({ success: true, data: groupPayload });
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('group:admin:update', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      assertRoomOwner(room, socket.user.id);
      if (payload.admin !== false && !room.admins.some((adminId) => adminId.toString() === payload.userId)) {
        room.admins.push(payload.userId);
      }
      if (payload.admin === false && room.ownerId?.toString() !== payload.userId) {
        room.admins = room.admins.filter((adminId) => adminId.toString() !== payload.userId);
      }
      await room.save();
      const groupPayload = { room: normalizeRoom(room), userId: payload.userId, admin: payload.admin !== false };
      io.to(room.id).emit('group:admin:update', groupPayload);
      acknowledgement?.({ success: true, data: groupPayload });
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('group:join_request:resolved', async (payload = {}, acknowledgement) => {
    try {
      const room = await Room.findById(payload.roomId);
      assertRoomAdmin(room, socket.user.id);
      const request = room.joinRequests.find((entry) => entry.userId.toString() === payload.userId && entry.status === 'pending');
      if (request) {
        request.status = payload.approved ? 'approved' : 'rejected';
        request.resolvedAt = new Date();
        request.resolvedBy = socket.user._id;
        if (payload.approved && !room.members.some((memberId) => memberId.toString() === payload.userId)) {
          room.members.push(payload.userId);
        }
        await room.save();
      }
      const groupPayload = { room: normalizeRoom(room), userId: payload.userId, approved: Boolean(payload.approved) };
      io.to(room.id).emit('group:join_request:resolved', groupPayload);
      acknowledgement?.({ success: true, data: groupPayload });
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });
};

module.exports = {
  loadMessageHistory,
  registerRoomHandlers
};
