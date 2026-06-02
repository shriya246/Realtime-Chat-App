/**
 * Purpose: Runs a local cleanup loop for disappearing messages.
 */

const Message = require('../models/Message');

let cleanupTimer = null;

const cleanupExpiredMessages = async (io = null) => {
  const now = new Date();
  const expiredMessages = await Message.find({
    expiresAt: { $lte: now },
    isDeleted: { $ne: true }
  }).select('_id roomId conversationId');

  if (expiredMessages.length === 0) {
    return [];
  }

  const ids = expiredMessages.map((message) => message._id);
  await Message.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        content: 'This message expired',
        deletedAt: now,
        isDeleted: true
      }
    }
  );

  if (io) {
    expiredMessages.forEach((message) => {
      io.emit('message:expired', {
        conversationId: message.conversationId?.toString() || null,
        messageId: message._id.toString(),
        roomId: message.roomId?.toString() || null
      });
    });
  }

  return ids.map((id) => id.toString());
};

const startDisappearingMessageCleanup = (io, intervalMs = 60 * 1000) => {
  if (cleanupTimer) {
    return cleanupTimer;
  }

  cleanupTimer = setInterval(() => {
    cleanupExpiredMessages(io).catch((error) => {
      console.error('Disappearing message cleanup failed:', error.message);
    });
  }, intervalMs);
  cleanupTimer.unref?.();
  return cleanupTimer;
};

const stopDisappearingMessageCleanup = () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
};

module.exports = {
  cleanupExpiredMessages,
  startDisappearingMessageCleanup,
  stopDisappearingMessageCleanup
};
