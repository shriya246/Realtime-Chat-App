/**
 * Purpose: Retrieves authorized message history through efficient cursor-based pagination.
 */

const Message = require('../models/Message');
const { canAccessRoom, findRoom } = require('./roomController');
const { forbiddenError } = require('../utils/errors');

const DEFAULT_MESSAGE_LIMIT = 50;

/**
 * Formats a message document for REST consumers.
 *
 * @param {object} message - Populated message document.
 * @returns {object} Public message payload.
 */
const formatHistoryMessage = (message) => ({
  id: message.id,
  roomId: message.roomId.toString(),
  sender: {
    id: message.senderId.id,
    username: message.senderId.username
  },
  content: message.content,
  type: message.type,
  timestamp: message.timestamp.toISOString(),
  status: message.status
});

/**
 * Returns chronological message history with a cursor for older records.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const getMessages = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.id);

    if (!canAccessRoom(room, req.user.id)) {
      return next(forbiddenError('You do not have access to this room.'));
    }

    const limit = req.query.limit || DEFAULT_MESSAGE_LIMIT;
    const query = { roomId: room._id };

    if (req.query.before) {
      query._id = { $lt: req.query.before };
    }

    const records = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('senderId', 'username');
    const hasMore = records.length > limit;
    const selectedRecords = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? selectedRecords[selectedRecords.length - 1].id : null;

    return res.status(200).json({
      success: true,
      data: {
        messages: selectedRecords.reverse().map((message) => formatHistoryMessage(message)),
        pagination: {
          hasMore,
          limit,
          nextCursor
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMessages
};
