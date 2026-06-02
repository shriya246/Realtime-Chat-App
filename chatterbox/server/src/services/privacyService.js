/**
 * Purpose: Shares v3 privacy, disappearing-message, group-role, and lock helpers.
 */

const bcrypt = require('bcrypt');

const User = require('../models/User');
const { getConfig } = require('../config');
const { forbiddenError, validationError } = require('../utils/errors');

const DISAPPEARING_DURATION_MS = Object.freeze({
  off: null,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000
});

const LOCK_UNLOCK_DURATION_MS = 15 * 60 * 1000;

const isExpiredFilter = () => ({
  $or: [
    { expiresAt: null },
    { expiresAt: { $exists: false } },
    { expiresAt: { $gt: new Date() } }
  ]
});

const calculateExpiresAt = (mode) => {
  const duration = DISAPPEARING_DURATION_MS[mode || 'off'];
  return duration ? new Date(Date.now() + duration) : null;
};

const normalizeDisappearingMode = (mode) => {
  if (!Object.prototype.hasOwnProperty.call(DISAPPEARING_DURATION_MS, mode || 'off')) {
    throw validationError('Invalid disappearing message mode.', [
      { field: 'disappearingMode', message: 'Use off, 24h, 7d, or 90d.' }
    ]);
  }

  return mode || 'off';
};

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || String(value);

const isRoomOwner = (room, userId) => toId(room.ownerId || room.createdBy) === userId.toString();

const isRoomAdmin = (room, userId) =>
  isRoomOwner(room, userId) || (room.admins || []).some((adminId) => toId(adminId) === userId.toString());

const assertRoomAdmin = (room, userId) => {
  if (!isRoomAdmin(room, userId)) {
    throw forbiddenError('Only group admins can perform this action.');
  }
};

const assertRoomOwner = (room, userId) => {
  if (!isRoomOwner(room, userId)) {
    throw forbiddenError('Only the group owner can perform this action.');
  }
};

const canRoomMemberSend = (room, userId) =>
  room.settings?.whoCanSendMessages !== 'admins' || isRoomAdmin(room, userId);

const canEditRoomInfo = (room, userId) =>
  room.settings?.whoCanEditInfo === 'everyone' || isRoomAdmin(room, userId);

const getBlockedRelationship = async (senderId, recipientIds = []) => {
  const recipients = await User.find({ _id: { $in: recipientIds } }).select('blockedUsers username');
  const blockingRecipient = recipients.find((recipient) =>
    (recipient.blockedUsers || []).some((blockedUserId) => blockedUserId.toString() === senderId.toString())
  );

  return blockingRecipient || null;
};

const assertDirectMessageNotBlocked = async (senderId, participantIds) => {
  const otherParticipantIds = participantIds.filter((participantId) => participantId.toString() !== senderId.toString());
  const blockingRecipient = await getBlockedRelationship(senderId, otherParticipantIds);

  if (blockingRecipient) {
    throw forbiddenError('This user is not accepting direct messages from you.');
  }
};

const hashLockedChatPin = async (pin) => {
  if (typeof pin !== 'string' || !/^\d{4,12}$/.test(pin)) {
    throw validationError('PIN must be 4 to 12 digits.', [
      { field: 'pin', message: 'Use a numeric PIN between 4 and 12 digits.' }
    ]);
  }

  return bcrypt.hash(pin, getConfig().security.bcryptSaltRounds);
};

const isConversationUnlocked = (conversation, userId) => {
  const setting = (conversation.settings || []).find((entry) => toId(entry.userId) === userId.toString());

  if (!setting?.locked) {
    return true;
  }

  return setting.unlockedUntil instanceof Date && setting.unlockedUntil > new Date();
};

module.exports = {
  LOCK_UNLOCK_DURATION_MS,
  assertDirectMessageNotBlocked,
  assertRoomAdmin,
  assertRoomOwner,
  calculateExpiresAt,
  canEditRoomInfo,
  canRoomMemberSend,
  hashLockedChatPin,
  isConversationUnlocked,
  isExpiredFilter,
  isRoomAdmin,
  isRoomOwner,
  normalizeDisappearingMode
};
