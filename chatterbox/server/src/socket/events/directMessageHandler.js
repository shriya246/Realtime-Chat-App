/**
 * Purpose: Handles real-time direct messages, read receipts, reactions, edits, and deletes.
 */

const Message = require('../../models/Message');
const Attachment = require('../../models/Attachment');
const User = require('../../models/User');
const eventPublisher = require('../../services/azureServiceBusService');
const {
  SUPPORTED_REACTIONS,
  formatConversation,
  formatDirectMessage,
  getAccessibleConversation,
  getAccessibleDirectMessage,
  getConversationRoomName,
  getOnlineUserIds,
  markConversationRead,
  toId,
  updateConversationSettings,
  updateConversationLastMessage
} = require('../../services/conversationService');
const { forbiddenError, notFoundError, validationError } = require('../../utils/errors');
const { emitSocketError } = require('../socketUtils');
const { validateMessageContent } = require('./messageHandler');
const mongoose = require('mongoose');

const MEDIA_MESSAGE_TYPES = ['image', 'video', 'file', 'audio'];

/**
 * Emits a payload to every participant's private user room.
 *
 * @param {object} io - Socket.io server.
 * @param {object} conversation - Conversation document.
 * @param {string} eventName - Event name.
 * @param {Function} buildPayload - Payload factory receiving participant id.
 * @returns {void}
 */
const emitToConversationUsers = (io, conversation, eventName, buildPayload) => {
  conversation.participants.forEach((participant) => {
    const participantId = toId(participant);
    io.to(`user:${participantId}`).emit(eventName, buildPayload(participantId));
  });
};

/**
 * Emits updated conversation-list rows to every participant.
 *
 * @param {object} io - Socket.io server.
 * @param {object} conversation - Conversation document.
 * @returns {Promise<void>} Resolves after summaries are emitted.
 */
const emitConversationUpdated = async (io, conversation) => {
  const onlineUserIds = await getOnlineUserIds();

  for (const participant of conversation.participants) {
    const participantId = toId(participant);
    io.to(`user:${participantId}`).emit('conversation:updated', {
      conversation: await formatConversation(conversation, participantId, onlineUserIds)
    });
  }
};

/**
 * Loads a message to use as a valid reply target.
 *
 * @param {string|null} replyToMessageId - Reply target id.
 * @param {string} conversationId - Conversation id.
 * @returns {Promise<object|null>} Reply message or null.
 */
const loadReplyTarget = async (replyToMessageId, conversationId) => {
  if (!replyToMessageId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
    throw validationError('Invalid reply target.', [
      { field: 'replyToMessageId', message: 'Reply target must be a valid message ID.' }
    ]);
  }

  const replyTarget = await Message.findOne({ _id: replyToMessageId, conversationId });

  if (!replyTarget) {
    throw notFoundError('Reply target message not found.');
  }

  return replyTarget;
};

/**
 * Populates a direct message for formatting.
 *
 * @param {object} message - Message document.
 * @returns {Promise<object>} Populated message.
 */
const populateDirectMessage = async (message) => {
  await message.populate('senderId', 'username');
  await message.populate('attachments');
  await message.populate({
    path: 'replyToMessageId',
    populate: {
      path: 'senderId',
      select: 'username'
    }
  });
  return message;
};

/**
 * Validates a media attachment supplied with a direct-message send.
 *
 * @param {string|null} attachmentId - Attachment id.
 * @param {object} conversation - Authorized conversation.
 * @param {string} userId - Sender user id.
 * @returns {Promise<object|null>} Attachment or null.
 */
const loadMessageAttachment = async (attachmentId, conversation, userId) => {
  if (!attachmentId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
    throw validationError('Invalid attachment identifier.', [
      { field: 'attachmentId', message: 'Attachment ID must be a valid ObjectId.' }
    ]);
  }

  const attachment = await Attachment.findById(attachmentId);

  if (!attachment || attachment.purpose !== 'message') {
    throw validationError('Attachment is not available for messaging.', [
      { field: 'attachmentId', message: 'Upload the attachment before sending it.' }
    ]);
  }

  if (attachment.ownerId.toString() !== userId || attachment.conversationId?.toString() !== conversation.id) {
    throw forbiddenError('You do not have access to send this attachment.');
  }

  return attachment;
};

/**
 * Registers direct-message events for a connected socket.
 *
 * @param {object} io - Socket.io server.
 * @param {object} socket - Authenticated Socket.io socket.
 * @returns {void}
 */
const registerDirectMessageHandlers = (io, socket) => {
  socket.on('conversation:join', async (payload = {}, acknowledgement) => {
    try {
      const conversation = await getAccessibleConversation(payload.conversationId, socket.user.id);
      await socket.join(getConversationRoomName(conversation.id));

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            conversationId: conversation.id
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('conversation:leave', async (payload = {}, acknowledgement) => {
    try {
      const conversation = await getAccessibleConversation(payload.conversationId, socket.user.id);
      await socket.leave(getConversationRoomName(conversation.id));

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            conversationId: conversation.id
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('direct_message:send', async (payload = {}, acknowledgement) => {
    try {
      const conversation = await getAccessibleConversation(payload.conversationId, socket.user.id);
      const attachment = await loadMessageAttachment(payload.attachmentId, conversation, socket.user.id);
      const messageType = attachment ? attachment.kind : 'text';

      if (attachment && !MEDIA_MESSAGE_TYPES.includes(messageType)) {
        throw validationError('Unsupported attachment message type.', [
          { field: 'attachmentId', message: 'Attachment cannot be sent as a message.' }
        ]);
      }

      const content = attachment
        ? (typeof payload.content === 'string' && payload.content.trim()
            ? payload.content.trim()
            : attachment.originalFilename)
        : validateMessageContent(payload.content);
      const replyTarget = await loadReplyTarget(payload.replyToMessageId, conversation.id);
      const now = new Date();
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: socket.user._id,
        content,
        type: messageType,
        status: 'delivered',
        attachments: attachment ? [attachment._id] : [],
        replyToMessageId: replyTarget?._id || null,
        deliveredTo: conversation.participants.map((participant) => ({
          userId: toId(participant),
          at: now
        })),
        readBy: [
          {
            userId: socket.user._id,
            at: now
          }
        ]
      });

      await populateDirectMessage(message);
      const updatedConversation = await updateConversationLastMessage(conversation.id, message);

      emitToConversationUsers(io, updatedConversation, 'direct_message:new', (participantId) =>
        formatDirectMessage(
          message,
          participantId,
          participantId === socket.user.id ? payload.clientMessageId : null
        )
      );
      if (attachment) {
        emitToConversationUsers(io, updatedConversation, 'media_message:new', (participantId) =>
          formatDirectMessage(
            message,
            participantId,
            participantId === socket.user.id ? payload.clientMessageId : null
          )
        );
      }
      await emitConversationUpdated(io, updatedConversation);

      const publishResult = await eventPublisher.sendMessage(formatDirectMessage(message, socket.user.id));

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            message: formatDirectMessage(message, socket.user.id, payload.clientMessageId),
            queued: publishResult.published
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('message:delivered', async (payload = {}, acknowledgement) => {
    try {
      const { message } = await getAccessibleDirectMessage(payload.messageId, socket.user.id);

      if (!message.deliveredTo.some((receipt) => toId(receipt.userId) === socket.user.id)) {
        message.deliveredTo.push({
          userId: socket.user._id,
          at: new Date()
        });
        await message.save();
      }

      emitToConversationUsers(io, await getAccessibleConversation(message.conversationId.toString(), socket.user.id), 'message:delivered', () => ({
        conversationId: message.conversationId.toString(),
        messageId: message.id,
        userId: socket.user.id
      }));

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            messageId: message.id
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('message:read', async (payload = {}, acknowledgement) => {
    try {
      const conversation = await getAccessibleConversation(payload.conversationId, socket.user.id);
      const receipt = await markConversationRead(conversation.id, socket.user.id);

      emitToConversationUsers(io, conversation, 'message:read', () => receipt);
      await emitConversationUpdated(io, conversation);

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: receipt
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('message:reaction:update', async (payload = {}, acknowledgement) => {
    try {
      if (payload.emoji && !SUPPORTED_REACTIONS.includes(payload.emoji)) {
        throw validationError('Unsupported reaction emoji.', [
          { field: 'emoji', message: `Emoji must be one of: ${SUPPORTED_REACTIONS.join(' ')}` }
        ]);
      }

      const { conversation, message } = await getAccessibleDirectMessage(payload.messageId, socket.user.id);
      message.reactions = message.reactions.filter((reaction) => toId(reaction.userId) !== socket.user.id);

      if (payload.emoji) {
        message.reactions.push({
          userId: socket.user._id,
          emoji: payload.emoji,
          reactedAt: new Date()
        });
      }

      await message.save();
      await populateDirectMessage(message);

      emitToConversationUsers(io, conversation, 'message:reaction:update', (participantId) => ({
        conversationId: conversation.id,
        messageId: message.id,
        reactions: formatDirectMessage(message, participantId).reactions
      }));

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            message: formatDirectMessage(message, socket.user.id)
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('message:edit', async (payload = {}, acknowledgement) => {
    try {
      const { conversation, message } = await getAccessibleDirectMessage(payload.messageId, socket.user.id);

      if (toId(message.senderId) !== socket.user.id) {
        throw forbiddenError('Only the sender can edit this message.');
      }

      if (message.isDeleted) {
        throw validationError('Deleted messages cannot be edited.');
      }

      if (message.type !== 'text') {
        throw validationError('Only text messages can be edited.');
      }

      message.content = validateMessageContent(payload.content);
      message.editedAt = new Date();
      await message.save();
      await populateDirectMessage(message);

      let updatedConversation = conversation;
      if (toId(conversation.lastMessageId) === message.id) {
        updatedConversation = await updateConversationLastMessage(conversation.id, message);
      }

      emitToConversationUsers(io, updatedConversation, 'message:edit', (participantId) => ({
        message: formatDirectMessage(message, participantId)
      }));
      await emitConversationUpdated(io, updatedConversation);

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            message: formatDirectMessage(message, socket.user.id)
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('message:delete', async (payload = {}, acknowledgement) => {
    try {
      const { conversation, message } = await getAccessibleDirectMessage(payload.messageId, socket.user.id);

      if (toId(message.senderId) !== socket.user.id) {
        throw forbiddenError('Only the sender can delete this message.');
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.content = 'This message was deleted';
      await message.save();
      await populateDirectMessage(message);

      let updatedConversation = conversation;
      if (toId(conversation.lastMessageId) === message.id) {
        updatedConversation = await updateConversationLastMessage(conversation.id, message);
      }

      emitToConversationUsers(io, updatedConversation, 'message:delete', (participantId) => ({
        message: formatDirectMessage(message, participantId)
      }));
      await emitConversationUpdated(io, updatedConversation);

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            message: formatDirectMessage(message, socket.user.id)
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('conversation:settings:update', async (payload = {}, acknowledgement) => {
    try {
      const conversation = await getAccessibleConversation(payload.conversationId, socket.user.id);
      const updates = {};

      ['pinned', 'archived', 'muted'].forEach((field) => {
        if (payload[field] !== undefined) {
          updates[field] = Boolean(payload[field]);
        }
      });

      if (Object.keys(updates).length === 0) {
        throw validationError('At least one setting must be supplied.', [
          { field: 'settings', message: 'Provide pinned, archived, or muted.' }
        ]);
      }

      const updatedConversation = await updateConversationSettings(conversation, socket.user.id, updates);
      const onlineUserIds = await getOnlineUserIds();
      const summary = await formatConversation(updatedConversation, socket.user.id, onlineUserIds);

      socket.emit('conversation:settings:update', { conversation: summary });
      socket.emit('conversation:updated', { conversation: summary });

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            conversation: summary
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });

  socket.on('profile:update', async (payload = {}, acknowledgement) => {
    try {
      const updates = {};

      if (payload.displayName !== undefined) {
        updates.displayName = String(payload.displayName).trim().slice(0, 60);
      }

      if (payload.about !== undefined) {
        updates.about = String(payload.about).trim().slice(0, 160);
      }

      if (payload.avatarAttachmentId !== undefined) {
        if (payload.avatarAttachmentId) {
          const avatar = await Attachment.findById(payload.avatarAttachmentId);

          if (!avatar || avatar.purpose !== 'avatar' || avatar.ownerId.toString() !== socket.user.id) {
            throw validationError('Invalid avatar attachment.', [
              { field: 'avatarAttachmentId', message: 'Avatar must be an uploaded image owned by you.' }
            ]);
          }
        }

        updates.avatarAttachmentId = payload.avatarAttachmentId || null;
      }

      const user = await User.findByIdAndUpdate(socket.user.id, updates, { new: true });
      const profile = {
        about: user.about || '',
        avatarUrl: user.avatarAttachmentId ? `/api/attachments/${user.avatarAttachmentId.toString()}/content` : null,
        displayName: user.displayName || '',
        id: user.id,
        username: user.username
      };

      socket.user = user;
      socket.emit('profile:update', { user: profile });

      if (typeof acknowledgement === 'function') {
        acknowledgement({
          success: true,
          data: {
            user: profile
          }
        });
      }
    } catch (error) {
      emitSocketError(socket, error, acknowledgement);
    }
  });
};

module.exports = {
  registerDirectMessageHandlers
};
