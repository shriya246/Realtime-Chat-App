/**
 * Purpose: Implements direct-conversation discovery, creation, history, and read receipts.
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const {
  createOrGetDirectConversation,
  formatConversation,
  formatDirectMessage,
  getAccessibleConversation,
  getOnlineUserIds,
  markConversationRead,
  updateConversationSettings
} = require('../services/conversationService');
const { validationError } = require('../utils/errors');

const DEFAULT_MESSAGE_LIMIT = 50;

/**
 * Creates or returns a direct conversation with a target user.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const createDirectConversation = async (req, res, next) => {
  try {
    const { conversation, created } = await createOrGetDirectConversation(req.user.id, req.body.targetUserId);
    const onlineUserIds = await getOnlineUserIds();

    return res.status(created ? 201 : 200).json({
      success: true,
      data: {
        conversation: await formatConversation(conversation, req.user.id, onlineUserIds)
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Lists direct conversations for the authenticated user.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const listConversations = async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'username email displayName about avatarAttachmentId lastSeen')
      .populate('lastMessageId');
    const onlineUserIds = await getOnlineUserIds();
    const summaries = [];

    for (const conversation of conversations) {
      const summary = await formatConversation(conversation, req.user.id, onlineUserIds);
      const searchable = [
        summary.participant.username,
        summary.participant.email,
        summary.lastMessagePreview
      ].join(' ').toLowerCase();

      if (!search || searchable.includes(search)) {
        summaries.push(summary);
      }
    }

    summaries.sort((first, second) => {
      if (first.settings.pinned !== second.settings.pinned) {
        return first.settings.pinned ? -1 : 1;
      }

      return new Date(second.lastMessageTimestamp || second.updatedAt || 0) -
        new Date(first.lastMessageTimestamp || first.updatedAt || 0);
    });

    return res.status(200).json({
      success: true,
      data: {
        conversations: summaries
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns cursor-paginated direct-message history.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const getConversationMessages = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(req.params.id, req.user.id);
    const limit = req.query.limit || DEFAULT_MESSAGE_LIMIT;
    const query = {
      conversationId: conversation._id,
      hiddenFor: { $ne: req.user._id }
    };

    if (req.query.before) {
      query._id = { $lt: req.query.before };
    }

    const records = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('senderId', 'username')
      .populate('attachments')
      .populate({
        path: 'replyToMessageId',
        populate: {
          path: 'senderId',
          select: 'username'
        }
      });
    const hasMore = records.length > limit;
    const selectedRecords = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? selectedRecords[selectedRecords.length - 1].id : null;

    return res.status(200).json({
      success: true,
      data: {
        messages: selectedRecords.reverse().map((message) => formatDirectMessage(message, req.user.id)),
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

/**
 * Marks unread messages in a direct conversation as read.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const markConversationAsRead = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(req.params.id, req.user.id);
    const receipt = await markConversationRead(conversation.id, req.user.id);

    return res.status(200).json({
      success: true,
      data: receipt
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Searches text messages in an authorized conversation.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const searchConversationMessages = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(req.params.id, req.user.id);
    const escapedSearch = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const records = await Message.find({
      conversationId: conversation._id,
      content: new RegExp(escapedSearch, 'i'),
      hiddenFor: { $ne: req.user._id },
      isDeleted: { $ne: true },
      type: 'text'
    })
      .sort({ _id: -1 })
      .limit(req.query.limit || 20)
      .populate('senderId', 'username')
      .populate('attachments')
      .populate({
        path: 'replyToMessageId',
        populate: {
          path: 'senderId',
          select: 'username'
        }
      });

    return res.status(200).json({
      success: true,
      data: {
        results: records.map((message) => formatDirectMessage(message, req.user.id))
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Updates pinned, archived, and muted settings for the current user.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const updateSettings = async (req, res, next) => {
  try {
    const updates = {};

    ['pinned', 'archived', 'muted'].forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return next(validationError('At least one setting must be supplied.', [
        { field: 'settings', message: 'Provide pinned, archived, or muted.' }
      ]));
    }

    const conversation = await getAccessibleConversation(req.params.id, req.user.id);
    const updatedConversation = await updateConversationSettings(conversation, req.user.id, updates);
    const onlineUserIds = await getOnlineUserIds();

    return res.status(200).json({
      success: true,
      data: {
        conversation: await formatConversation(updatedConversation, req.user.id, onlineUserIds)
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createDirectConversation,
  getConversationMessages,
  listConversations,
  markConversationAsRead,
  searchConversationMessages,
  updateSettings
};
