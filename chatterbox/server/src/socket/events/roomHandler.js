/**
 * Purpose: Handles room joins/leaves and serves recent message history through Socket.io.
 */

const Message = require('../../models/Message');
const { getConfig } = require('../../config');
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
    const records = await Message.find({ roomId })
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
 * @param {object} socket - Authenticated Socket.io socket.
 * @returns {void}
 */
const registerRoomHandlers = (socket) => {
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
};

module.exports = {
  loadMessageHistory,
  registerRoomHandlers
};
