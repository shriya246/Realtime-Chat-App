/**
 * Purpose: Handles real-time persisted chat messages and temporary typing indicators.
 */

const Message = require('../../models/Message');
const azureServiceBusService = require('../../services/azureServiceBusService');
const { calculateExpiresAt, canRoomMemberSend } = require('../../services/privacyService');
const redisService = require('../../services/redisService');
const { forbiddenError, validationError } = require('../../utils/errors');
const { emitSocketError, formatMessage, getAccessibleRoom } = require('../socketUtils');

const MAX_MESSAGE_LENGTH = 2000;
const TYPING_INDICATOR_DURATION_MS = 3000;

/**
 * Validates and trims a socket message body.
 *
 * @param {string} content - User-supplied message text.
 * @returns {string} Trimmed valid message text.
 */
const validateMessageContent = (content) => {
  if (typeof content !== 'string' || !content.trim()) {
    throw validationError('Message content is required.', [{ field: 'content', message: 'Message content cannot be empty.' }]);
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
    throw validationError('Message content is too long.', [{ field: 'content', message: `Message content cannot exceed ${MAX_MESSAGE_LENGTH} characters.` }]);
  }

  return trimmedContent;
};

/**
 * Ensures a socket joined a room before publishing room activity.
 *
 * @param {object} socket - Authenticated socket.
 * @param {string} roomId - Room identifier.
 * @returns {void}
 */
const ensureJoinedRoom = (socket, roomId) => {
  if (!socket.rooms.has(roomId)) {
    throw forbiddenError('Join the room before sending activity.');
  }
};

/**
 * Registers message and typing handlers for a connected socket.
 *
 * @param {object} io - Socket.io server.
 * @param {object} socket - Authenticated Socket.io socket.
 * @returns {void}
 */
const registerMessageHandlers = (io, socket) => {
  const typingTimers = new Map();

  socket.on('send_message', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      ensureJoinedRoom(socket, room.id);

      if (!canRoomMemberSend(room, socket.user.id)) {
        throw forbiddenError('Only group admins can send messages in this group.');
      }

      const content = validateMessageContent(payload.content);
      const message = await Message.create({
        roomId: room._id,
        senderId: socket.user._id,
        content,
        type: 'text',
        expiresAt: calculateExpiresAt(room.settings?.disappearingMode),
        status: 'delivered'
      });

      await message.populate('senderId', 'username');

      const messagePayload = formatMessage(message, payload.clientMessageId);

      await redisService.cacheMessage(room.id, messagePayload);
      io.to(room.id).emit('receive_message', messagePayload);

      const queueResult = await azureServiceBusService.sendMessage(messagePayload);

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            message: messagePayload,
            queued: queueResult.published
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('user_typing', async (payload = {}, acknowledgement) => {
    try {
      const room = await getAccessibleRoom(payload.roomId, socket.user.id);
      ensureJoinedRoom(socket, room.id);

      const timerKey = room.id;
      const typingPayload = {
        roomId: room.id,
        userId: socket.user.id,
        username: socket.user.username,
        isTyping: Boolean(payload.isTyping)
      };

      if (typingTimers.has(timerKey)) {
        clearTimeout(typingTimers.get(timerKey));
        typingTimers.delete(timerKey);
      }

      socket.to(room.id).emit('typing_indicator', typingPayload);

      if (typingPayload.isTyping) {
        typingTimers.set(
          timerKey,
          setTimeout(() => {
            socket.to(room.id).emit('typing_indicator', {
              ...typingPayload,
              isTyping: false
            });
            typingTimers.delete(timerKey);
          }, TYPING_INDICATOR_DURATION_MS)
        );
      }

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: typingPayload
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('disconnect', () => {
    typingTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    typingTimers.clear();
  });
};

module.exports = {
  registerMessageHandlers,
  validateMessageContent
};
