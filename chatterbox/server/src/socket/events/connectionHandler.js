/**
 * Purpose: Tracks online presence and registers real-time events for authenticated sockets.
 */

const User = require('../../models/User');
const redisService = require('../../services/redisService');
const { registerDirectMessageHandlers } = require('./directMessageHandler');
const { registerMessageHandlers } = require('./messageHandler');
const { registerRoomHandlers } = require('./roomHandler');

/**
 * Initializes an authenticated socket connection and its disconnect cleanup.
 *
 * @param {object} io - Socket.io server.
 * @param {object} socket - Authenticated Socket.io socket.
 * @returns {Promise<void>} Resolves when connection setup completes.
 */
const handleConnection = async (io, socket) => {
  try {
    const userRoom = `user:${socket.user.id}`;
    await socket.join(userRoom);

    registerRoomHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerDirectMessageHandlers(io, socket);

    const presence = await redisService.setUserOnline(socket.user);
    const onlineUsers = await redisService.getOnlineUsers();

    io.emit('user_online', presence);
    socket.emit('online_users', onlineUsers);

    socket.on('disconnect', async () => {
      try {
        const remainingSockets = await io.in(userRoom).fetchSockets();

        if (remainingSockets.length === 0) {
          const lastSeen = new Date();
          await redisService.setUserOffline(socket.user.id);
          await User.findByIdAndUpdate(socket.user.id, { lastSeen });
          io.emit('user_offline', {
            userId: socket.user.id,
            username: socket.user.username,
            lastSeen: lastSeen.toISOString()
          });
        }
      } catch (error) {
        if (!/client was closed/i.test(error.message)) {
          console.error('Socket disconnect cleanup failed:', error.message);
        }
      }
    });
  } catch (error) {
    console.error('Socket connection setup failed:', error.message);
    socket.emit('socket_error', {
      code: 'CONNECTION_SETUP_FAILED',
      message: 'Unable to initialize real-time connection.',
      details: null
    });
    socket.disconnect(true);
  }
};

module.exports = {
  handleConnection
};
