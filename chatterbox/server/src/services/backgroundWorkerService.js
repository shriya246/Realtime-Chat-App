/**
 * Purpose: Starts and stops local background workers for v4.
 */

const {
  startDisappearingMessageCleanup,
  stopDisappearingMessageCleanup
} = require('./disappearingMessageService');
const {
  startStatusCleanup,
  stopStatusCleanup
} = require('./statusCleanupService');

const startBackgroundWorkers = (io) => {
  const disappearingTimer = startDisappearingMessageCleanup(io);
  const statusTimer = startStatusCleanup();

  return {
    disappearingTimer,
    statusTimer
  };
};

const stopBackgroundWorkers = () => {
  stopDisappearingMessageCleanup();
  stopStatusCleanup();
};

module.exports = {
  startBackgroundWorkers,
  stopBackgroundWorkers
};
