/**
 * Purpose: Implements direct-conversation discovery, creation, history, and read receipts.
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const {
  createOrGetDirectConversation,
  formatConversation,
  formatDirectMessage,
  getAccessibleConversation,
  getOnlineUserIds,
  markConversationRead,
  updateConversationSettings
} = require('../services/conversationService');
const {
  LOCK_UNLOCK_DURATION_MS,
  hashLockedChatPin,
  isConversationUnlocked,
  isExpiredFilter,
  normalizeDisappearingMode
} = require('../services/privacyService');
const { forbiddenError, validationError } = require('../utils/errors');

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
      hiddenFor: { $ne: req.user._id },
      ...isExpiredFilter()
    };

    if (!isConversationUnlocked(conversation, req.user.id)) {
      return next(forbiddenError('Unlock this chat before opening it.'));
    }

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
    if (req.user.privacySettings?.readReceipts === false) {
      return res.status(200).json({
        success: true,
        data: {
          conversationId: req.params.id,
          messageIds: [],
          readAt: null,
          readerId: req.user.id,
          readReceiptsDisabled: true
        }
      });
    }

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
      ...isExpiredFilter(),
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
 * Updates pinned, archived, muted, and locked settings for the current user.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const updateSettings = async (req, res, next) => {
  try {
    const updates = {};

    ['pinned', 'archived', 'muted', 'locked'].forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return next(validationError('At least one setting must be supplied.', [
        { field: 'settings', message: 'Provide pinned, archived, muted, or locked.' }
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

const setLockedChatPin = async (req, res, next) => {
  try {
    const pinHash = await hashLockedChatPin(req.body.pin);
    const user = await User.findByIdAndUpdate(req.user.id, { lockedChatPinHash: pinHash }, { new: true });

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

const unlockConversation = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(req.params.id, req.user.id);
    const user = await User.findById(req.user.id).select('+passwordHash +lockedChatPinHash');
    const passwordMatches = req.body.password ? await user.comparePassword(req.body.password) : false;
    const pinMatches = req.body.pin ? await user.compareLockedChatPin(req.body.pin) : false;

    if (!passwordMatches && !pinMatches) {
      return next(forbiddenError('Password or locked-chat PIN is required to unlock this chat.'));
    }

    const unlockedUntil = new Date(Date.now() + LOCK_UNLOCK_DURATION_MS);
    const updatedConversation = await updateConversationSettings(conversation, req.user.id, {
      unlockedUntil
    });
    const onlineUserIds = await getOnlineUserIds();

    return res.status(200).json({
      success: true,
      data: {
        conversation: await formatConversation(updatedConversation, req.user.id, onlineUserIds),
        unlockedUntil: unlockedUntil.toISOString()
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateDisappearingMode = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(req.params.id, req.user.id);
    conversation.disappearingMode = normalizeDisappearingMode(req.body.disappearingMode);
    await conversation.save();
    await conversation.populate('participants', 'username email displayName about avatarAttachmentId lastSeen');
    await conversation.populate('lastMessageId');

    return res.status(200).json({
      success: true,
      data: {
        conversation: await formatConversation(conversation, req.user.id, await getOnlineUserIds())
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateEncryptionMode = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(req.params.id, req.user.id);
    conversation.encryptedModeEnabled = Boolean(req.body.enabled);
    await conversation.save();
    await conversation.populate('participants', 'username email displayName about avatarAttachmentId lastSeen');
    await conversation.populate('lastMessageId');

    return res.status(200).json({
      success: true,
      data: {
        conversation: await formatConversation(conversation, req.user.id, await getOnlineUserIds())
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
  setLockedChatPin,
  unlockConversation,
  updateDisappearingMode,
  updateEncryptionMode,
  updateSettings
};
