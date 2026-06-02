/**
 * Purpose: Shares direct-conversation authorization, formatting, receipts, and summary helpers.
 */

const mongoose = require('mongoose');

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const redisService = require('./redisService');
const { forbiddenError, notFoundError, validationError } = require('../utils/errors');

const DIRECT_MESSAGE_PLACEHOLDER = 'This message was deleted';
const SUPPORTED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const DEFAULT_CONVERSATION_SETTINGS = Object.freeze({
  archived: false,
  muted: false,
  pinned: false
});

/**
 * Converts an ObjectId or populated document to a public id string.
 *
 * @param {object|string|null} value - Value to normalize.
 * @returns {string|null} Public id.
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
 * Returns the private Socket.io room name for a direct conversation.
 *
 * @param {string} conversationId - Conversation id.
 * @returns {string} Socket room name.
 */
const getConversationRoomName = (conversationId) => `conversation:${conversationId}`;

/**
 * Returns a short preview for conversation-list rows.
 *
 * @param {object|null} message - Message document or payload.
 * @returns {string} Preview text.
 */
const getMessagePreview = (message) => {
  if (!message) {
    return '';
  }

  if (message.isDeleted) {
    return DIRECT_MESSAGE_PLACEHOLDER;
  }

  if (message.type && message.type !== 'text') {
    return `${message.type[0].toUpperCase()}${message.type.slice(1)} attachment`;
  }

  return String(message.content || '').trim().slice(0, 160);
};

/**
 * Formats safe user information with optional presence.
 *
 * @param {object} user - User document.
 * @param {Set<string>} onlineUserIds - Online user ids.
 * @returns {object} Public user payload.
 */
const formatParticipant = (user, onlineUserIds = new Set()) => ({
  about: user.about || '',
  avatarUrl: user.avatarAttachmentId ? `/api/attachments/${toId(user.avatarAttachmentId)}/content` : null,
  displayName: user.displayName || '',
  id: toId(user),
  username: user.username,
  email: user.email,
  lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null,
  isOnline: onlineUserIds.has(toId(user))
});

/**
 * Formats attachment metadata for clients.
 *
 * @param {object} attachment - Attachment document.
 * @returns {object|null} Attachment payload.
 */
const formatAttachment = (attachment) => {
  if (!attachment) {
    return null;
  }

  const payload = attachment.toJSON ? attachment.toJSON() : { ...attachment };
  payload.url = payload.url || `/api/attachments/${toId(attachment)}/content`;
  return payload;
};

/**
 * Aggregates message reactions for UI display.
 *
 * @param {Array<object>} reactions - Raw message reactions.
 * @param {string|null} currentUserId - Active user id.
 * @returns {Array<object>} Aggregated reaction payloads.
 */
const formatReactions = (reactions = [], currentUserId = null) => {
  const aggregated = new Map();

  reactions.forEach((reaction) => {
    const emoji = reaction.emoji;
    const userId = toId(reaction.userId);

    if (!aggregated.has(emoji)) {
      aggregated.set(emoji, {
        emoji,
        count: 0,
        userIds: [],
        reactedByMe: false
      });
    }

    const entry = aggregated.get(emoji);
    entry.count += 1;
    entry.userIds.push(userId);
    entry.reactedByMe = entry.reactedByMe || userId === currentUserId;
  });

  return Array.from(aggregated.values());
};

/**
 * Calculates the status a message should show to the current viewer.
 *
 * @param {object} message - Message document.
 * @param {string|null} currentUserId - Active user id.
 * @returns {string} Delivery/read status.
 */
const resolveMessageStatus = (message, currentUserId = null) => {
  if (!currentUserId || toId(message.senderId) !== currentUserId) {
    return message.status;
  }

  if ((message.readBy || []).some((receipt) => toId(receipt.userId) !== currentUserId)) {
    return 'read';
  }

  if ((message.deliveredTo || []).some((receipt) => toId(receipt.userId) !== currentUserId)) {
    return 'delivered';
  }

  return message.status;
};

/**
 * Formats a direct message for REST or Socket.io clients.
 *
 * @param {object} message - Message document with populated sender and optional reply.
 * @param {string|null} currentUserId - Active user id.
 * @param {string|null} clientMessageId - Optimistic client id.
 * @returns {object} Public direct-message payload.
 */
const formatDirectMessage = (message, currentUserId = null, clientMessageId = null) => {
  const sender = message.senderId || message.sender;
  const reply = message.replyToMessageId && message.replyToMessageId.content !== undefined
    ? message.replyToMessageId
    : null;
  const payload = {
    id: toId(message),
    conversationId: toId(message.conversationId),
    sender: {
      id: toId(sender),
      username: sender.username || 'Unknown user'
    },
    content: message.isDeleted ? DIRECT_MESSAGE_PLACEHOLDER : message.content,
    isDeleted: Boolean(message.isDeleted),
    type: message.type,
    timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
    status: resolveMessageStatus(message, currentUserId),
    editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
    attachments: message.attachments?.length > 0
      ? message.attachments.map((attachment) => formatAttachment(attachment)).filter(Boolean)
      : [],
    reactions: formatReactions(message.reactions, currentUserId)
  };

  if (reply) {
    const replySender = reply.senderId || reply.sender;
    payload.replyTo = {
      id: toId(reply),
      content: reply.isDeleted ? DIRECT_MESSAGE_PLACEHOLDER : reply.content,
      isDeleted: Boolean(reply.isDeleted),
      sender: {
        id: toId(replySender),
        username: replySender?.username || 'Unknown user'
      }
    };
  }

  if (clientMessageId) {
    payload.clientMessageId = clientMessageId;
  }

  return payload;
};

/**
 * Loads online user ids from Redis.
 *
 * @returns {Promise<Set<string>>} Online user ids.
 */
const getOnlineUserIds = async () => {
  const onlineUsers = await redisService.getOnlineUsers();
  return new Set(onlineUsers.map((onlineUser) => onlineUser.userId));
};

/**
 * Returns per-user settings for a conversation.
 *
 * @param {object} conversation - Conversation document.
 * @param {string} userId - User id.
 * @returns {object} Settings payload.
 */
const getConversationSettingsForUser = (conversation, userId) => {
  const setting = (conversation.settings || []).find((entry) => toId(entry.userId) === userId.toString());

  return {
    ...DEFAULT_CONVERSATION_SETTINGS,
    ...(setting
      ? {
          archived: Boolean(setting.archived),
          muted: Boolean(setting.muted),
          pinned: Boolean(setting.pinned),
          updatedAt: setting.updatedAt instanceof Date ? setting.updatedAt.toISOString() : setting.updatedAt
        }
      : {})
  };
};

/**
 * Counts unread direct messages for one conversation and user.
 *
 * @param {string|object} conversationId - Conversation id.
 * @param {string|object} userId - Active user id.
 * @returns {Promise<number>} Unread message count.
 */
const countUnreadMessages = async (conversationId, userId) =>
  Message.countDocuments({
    conversationId,
    senderId: { $ne: userId },
    isDeleted: { $ne: true },
    readBy: { $not: { $elemMatch: { userId } } }
  });

/**
 * Formats a conversation summary for the current user.
 *
 * @param {object} conversation - Conversation document.
 * @param {string} currentUserId - Active user id.
 * @param {Set<string>} onlineUserIds - Online user ids.
 * @returns {Promise<object>} Public conversation summary.
 */
const formatConversation = async (conversation, currentUserId, onlineUserIds = new Set()) => {
  const participants = conversation.participants || [];
  const otherParticipant = participants.find((participant) => toId(participant) !== currentUserId) || participants[0];
  const lastMessage = conversation.lastMessageId && conversation.lastMessageId.content !== undefined
    ? conversation.lastMessageId
    : null;

  return {
    id: toId(conversation),
    type: 'direct',
    participants: participants.map((participant) => formatParticipant(participant, onlineUserIds)),
    participant: formatParticipant(otherParticipant, onlineUserIds),
    lastMessage: lastMessage
      ? {
          id: toId(lastMessage),
          senderId: toId(lastMessage.senderId),
          content: getMessagePreview(lastMessage),
          timestamp: lastMessage.timestamp instanceof Date ? lastMessage.timestamp.toISOString() : lastMessage.timestamp,
          status: resolveMessageStatus(lastMessage, currentUserId),
          isDeleted: Boolean(lastMessage.isDeleted)
        }
      : null,
    lastMessagePreview: conversation.lastMessagePreview || getMessagePreview(lastMessage),
    lastMessageTimestamp: conversation.lastMessageAt ? conversation.lastMessageAt.toISOString() : null,
    settings: getConversationSettingsForUser(conversation, currentUserId),
    unreadCount: await countUnreadMessages(conversation._id, currentUserId),
    updatedAt: conversation.updatedAt ? conversation.updatedAt.toISOString() : null
  };
};

/**
 * Validates and loads a direct conversation for a participant.
 *
 * @param {string} conversationId - Conversation id.
 * @param {string} userId - Active user id.
 * @returns {Promise<object>} Authorized conversation.
 */
const getAccessibleConversation = async (conversationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw validationError('Invalid conversation identifier.', [
      { field: 'conversationId', message: 'Conversation ID must be a valid ObjectId.' }
    ]);
  }

  const conversation = await Conversation.findById(conversationId).populate('participants', 'username email displayName about avatarAttachmentId lastSeen');

  if (!conversation) {
    throw notFoundError('Conversation not found.');
  }

  if (!conversation.participants.some((participant) => toId(participant) === userId.toString())) {
    throw forbiddenError('You do not have access to this conversation.');
  }

  return conversation;
};

/**
 * Creates or returns the direct conversation for a user pair.
 *
 * @param {string} currentUserId - Active user id.
 * @param {string} targetUserId - Other participant id.
 * @returns {Promise<object>} Conversation and creation flag.
 */
const createOrGetDirectConversation = async (currentUserId, targetUserId) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw validationError('Invalid target user identifier.', [
      { field: 'targetUserId', message: 'Target user ID must be a valid ObjectId.' }
    ]);
  }

  if (currentUserId.toString() === targetUserId.toString()) {
    throw validationError('A direct conversation requires another user.', [
      { field: 'targetUserId', message: 'You cannot start a direct conversation with yourself.' }
    ]);
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw notFoundError('Target user not found.');
  }

  const participantKey = Conversation.buildParticipantKey([currentUserId, targetUserId]);
  let conversation = await Conversation.findOne({ participantKey });
  let created = false;

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        participants: [currentUserId, targetUserId],
        createdBy: currentUserId,
        participantKey
      });
      created = true;
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      conversation = await Conversation.findOne({ participantKey });
    }
  }

  await conversation.populate('participants', 'username email displayName about avatarAttachmentId lastSeen');
  await conversation.populate('lastMessageId');

  return {
    conversation,
    created
  };
};

/**
 * Updates the denormalized conversation preview after a message changes.
 *
 * @param {string|object} conversationId - Conversation id.
 * @param {object} message - Last message document.
 * @returns {Promise<object|null>} Updated conversation.
 */
const updateConversationLastMessage = async (conversationId, message) =>
  Conversation.findByIdAndUpdate(
    conversationId,
    {
      lastMessageId: message._id,
      lastMessagePreview: getMessagePreview(message),
      lastMessageAt: message.timestamp || new Date()
    },
    { new: true }
  ).populate('participants', 'username email displayName about avatarAttachmentId lastSeen').populate('lastMessageId');

/**
 * Updates per-user conversation settings.
 *
 * @param {object} conversation - Conversation document.
 * @param {string} userId - Active user id.
 * @param {object} updates - Setting updates.
 * @returns {Promise<object>} Saved conversation.
 */
const updateConversationSettings = async (conversation, userId, updates) => {
  const editableConversation = await Conversation.findById(toId(conversation));

  if (!editableConversation) {
    throw notFoundError('Conversation not found.');
  }

  const settingIndex = editableConversation.settings.findIndex((setting) => toId(setting.userId) === userId.toString());
  const currentSetting = settingIndex >= 0
    ? editableConversation.settings[settingIndex].toObject?.() || editableConversation.settings[settingIndex]
    : {};
  const nextSetting = {
    ...DEFAULT_CONVERSATION_SETTINGS,
    ...currentSetting,
    ...updates,
    updatedAt: new Date(),
    userId
  };

  if (settingIndex >= 0) {
    editableConversation.settings.set(settingIndex, nextSetting);
  } else {
    editableConversation.settings.push(nextSetting);
  }

  await editableConversation.save();
  await editableConversation.populate('participants', 'username email displayName about avatarAttachmentId lastSeen');
  await editableConversation.populate('lastMessageId');
  return editableConversation;
};

/**
 * Marks unread messages in a conversation as read by a participant.
 *
 * @param {string} conversationId - Conversation id.
 * @param {string} userId - Active user id.
 * @returns {Promise<object>} Read receipt payload.
 */
const markConversationRead = async (conversationId, userId) => {
  const readAt = new Date();
  const unreadMessages = await Message.find({
    conversationId,
    senderId: { $ne: userId },
    isDeleted: { $ne: true },
    readBy: { $not: { $elemMatch: { userId } } }
  }).select('_id');
  const messageIds = unreadMessages.map((message) => message._id);

  if (messageIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $push: {
          readBy: {
            userId,
            at: readAt
          }
        },
        $set: {
          status: 'read'
        }
      }
    );
  }

  return {
    conversationId,
    messageIds: messageIds.map((messageId) => messageId.toString()),
    readAt: readAt.toISOString(),
    readerId: userId.toString()
  };
};

/**
 * Loads and authorizes a direct message by id.
 *
 * @param {string} messageId - Message id.
 * @param {string} userId - Active user id.
 * @returns {Promise<object>} Message and conversation.
 */
const getAccessibleDirectMessage = async (messageId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw validationError('Invalid message identifier.', [
      { field: 'messageId', message: 'Message ID must be a valid ObjectId.' }
    ]);
  }

  const message = await Message.findById(messageId)
    .populate('senderId', 'username')
    .populate('attachments')
    .populate({
      path: 'replyToMessageId',
      populate: { path: 'senderId', select: 'username' }
    });

  if (!message || !message.conversationId) {
    throw notFoundError('Direct message not found.');
  }

  const conversation = await getAccessibleConversation(message.conversationId.toString(), userId);
  return {
    conversation,
    message
  };
};

module.exports = {
  DIRECT_MESSAGE_PLACEHOLDER,
  SUPPORTED_REACTIONS,
  countUnreadMessages,
  createOrGetDirectConversation,
  formatConversation,
  formatDirectMessage,
  getAccessibleConversation,
  getAccessibleDirectMessage,
  getConversationSettingsForUser,
  getConversationRoomName,
  getMessagePreview,
  getOnlineUserIds,
  markConversationRead,
  toId,
  updateConversationSettings,
  updateConversationLastMessage
};
