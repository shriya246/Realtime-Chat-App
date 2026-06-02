/**
 * Purpose: Shares Socket.io authorization, message serialization, and controlled event error helpers.
 */

const mongoose = require('mongoose');

const Room = require('../models/Room');
const { forbiddenError, notFoundError, validationError } = require('../utils/errors');

/**
 * Converts an ObjectId or populated document to its public identifier.
 *
 * @param {object|string} value - Identifier or document.
 * @returns {string|null} Identifier string or null.
 */
const toId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }

  if (value.id && typeof value.id !== 'object') {
    return value.id.toString();
  }

  return value.toString();
};

/**
 * Loads a room and validates the current user's room access.
 *
 * @param {string} roomId - Room identifier.
 * @param {string} userId - Authenticated user identifier.
 * @returns {Promise<object>} Authorized room document.
 */
const getAccessibleRoom = async (roomId, userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw validationError('Invalid room identifier.', [{ field: 'roomId', message: 'Room ID must be a valid ObjectId.' }]);
    }

    const room = await Room.findById(roomId);

    if (!room) {
      throw notFoundError('Room not found.');
    }

    const userIsMember = room.members.some((memberId) => memberId.toString() === userId.toString());

    if (room.type === 'private' && !userIsMember) {
      throw forbiddenError('You do not have access to this room.');
    }

    return room;
  } catch (error) {
    throw error;
  }
};

/**
 * Formats a Mongoose message document as a Socket.io/API message payload.
 *
 * @param {object} message - Message document with a populated sender where available.
 * @param {string|null} clientMessageId - Optional client optimistic-message identifier.
 * @returns {object} Public message payload.
 */
const formatMessage = (message, clientMessageId = null) => {
  const sender = message.senderId || message.sender;
  const payload = {
    id: toId(message),
    roomId: toId(message.roomId),
    sender: {
      id: toId(sender),
      username: sender.username || 'Unknown user'
    },
    content: message.content,
    type: message.type,
    timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
    status: message.status
  };

  if (clientMessageId) {
    payload.clientMessageId = clientMessageId;
  }

  return payload;
};

/**
 * Emits a normalized socket error and provides it to an optional acknowledgement.
 *
 * @param {object} socket - Socket.io socket.
 * @param {Error} error - Event-processing error.
 * @param {Function|undefined} acknowledgement - Optional acknowledgement callback.
 * @returns {void}
 */
const emitSocketError = (socket, error, acknowledgement) => {
  const errorPayload = {
    code: error.code || 'SOCKET_EVENT_ERROR',
    message: error.message || 'Unable to process socket event.',
    details: error.details || null
  };

  socket.emit('socket_error', errorPayload);

  if (typeof acknowledgement === 'function') {
    acknowledgement({
      success: false,
      error: errorPayload
    });
  }
};

module.exports = {
  emitSocketError,
  formatMessage,
  getAccessibleRoom
};
