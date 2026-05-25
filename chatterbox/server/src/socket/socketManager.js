/**
 * Purpose: Initializes Socket.io, authenticates socket handshakes, and binds connection events.
 */

const { Server } = require('socket.io');

const { getConfig } = require('../config');
const User = require('../models/User');
const redisService = require('../services/redisService');
const { verifyToken } = require('../utils/jwt');
const { handleConnection } = require('./events/connectionHandler');

/**
 * Returns configured origins accepted by Socket.io.
 *
 * @returns {Array<string>} Browser origins.
 */
const getSocketOrigins = () => {
  return getConfig().cors.allowedOrigins;
};

/**
 * Authenticates a socket handshake and attaches the Mongoose user document.
 *
 * @param {object} socket - Socket.io socket.
 * @param {Function} next - Socket.io middleware callback.
 * @returns {Promise<void>} Resolves after authentication.
 */
const authenticateSocket = async (socket, next) => {
  try {
    const { token } = socket.handshake.auth || {};

    if (!token || typeof token !== 'string') {
      const error = new Error('Authentication token is required.');
      error.data = { code: 'AUTHENTICATION_ERROR' };
      return next(error);
    }

    let decodedToken;

    try {
      decodedToken = verifyToken(token);
    } catch (error) {
      const authError = new Error(
        error.name === 'TokenExpiredError' ? 'Authentication token has expired.' : 'Authentication token is invalid.'
      );
      authError.data = { code: 'AUTHENTICATION_ERROR' };
      return next(authError);
    }

    if (await redisService.isTokenBlacklisted(token)) {
      const error = new Error('Authentication token has been revoked.');
      error.data = { code: 'AUTHENTICATION_ERROR' };
      return next(error);
    }

    const user = await User.findById(decodedToken.sub);

    if (!user) {
      const error = new Error('Authenticated user no longer exists.');
      error.data = { code: 'AUTHENTICATION_ERROR' };
      return next(error);
    }

    socket.user = user;
    socket.token = token;
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Creates an authenticated Socket.io server attached to an HTTP server.
 *
 * @param {object} httpServer - Node HTTP server.
 * @returns {Server} Configured Socket.io server.
 */
const initializeSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: getSocketOrigins(),
      credentials: true
    }
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    handleConnection(io, socket);
  });

  return io;
};

/**
 * Closes Socket.io and all active client connections.
 *
 * @param {Server} io - Socket.io server.
 * @returns {Promise<void>} Resolves when the socket server is closed.
 */
const closeSocketServer = async (io) => {
  try {
    await new Promise((resolve) => {
      io.close(() => {
        resolve();
      });
    });
  } catch (error) {
    console.error('Socket.io shutdown failed:', error.message);
    throw error;
  }
};

module.exports = {
  authenticateSocket,
  closeSocketServer,
  initializeSocketServer
};
