/**
 * Purpose: Cleans up expired status/story records with a local interval.
 */

const Status = require('../models/Status');

let statusCleanupTimer = null;

const cleanupExpiredStatuses = async () => {
  const result = await Status.deleteMany({ expiresAt: { $lte: new Date() } });
  return result.deletedCount || 0;
};

const startStatusCleanup = (intervalMs = 60 * 60 * 1000) => {
  if (statusCleanupTimer) {
    return statusCleanupTimer;
  }

  statusCleanupTimer = setInterval(() => {
    cleanupExpiredStatuses().catch((error) => {
      console.error('Expired status cleanup failed:', error.message);
    });
  }, intervalMs);
  statusCleanupTimer.unref?.();
  return statusCleanupTimer;
};

const stopStatusCleanup = () => {
  if (statusCleanupTimer) {
    clearInterval(statusCleanupTimer);
    statusCleanupTimer = null;
  }
};

module.exports = {
  cleanupExpiredStatuses,
  startStatusCleanup,
  stopStatusCleanup
};
