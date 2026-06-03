/**
 * Purpose: Starts the HTTP server, initializes MongoDB and Redis, and handles graceful shutdown.
 */

const http = require('http');

const app = require('./app');
const { getConfig, validateConfig } = require('./config');
const { connectDB, disconnectDB } = require('./config/db');
const { closeRedis, connectRedis } = require('./config/redis');
const { closeServiceBus } = require('./services/azureServiceBusService');
const {
  startBackgroundWorkers,
  stopBackgroundWorkers
} = require('./services/backgroundWorkerService');
const { closeSocketServer, initializeSocketServer } = require('./socket/socketManager');

const config = validateConfig(getConfig());
const port = config.server.port;
const server = http.createServer(app);
const io = initializeSocketServer(server);

/**
 * Starts database/cache connections and begins listening for HTTP requests.
 *
 * @returns {Promise<void>} Resolves when the server is listening.
 */
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    startBackgroundWorkers(io);

    server.listen(port, () => {
      console.info(`ChatterBox server listening on port ${port}.`);
    });
  } catch (error) {
    console.error('Failed to start ChatterBox server:', error.message);
    process.exit(1);
  }
};

/**
 * Closes HTTP, MongoDB, and Redis resources.
 *
 * @param {string} signal - Shutdown signal name.
 * @returns {Promise<void>} Resolves after shutdown completes.
 */
const shutdown = async (signal) => {
  let forceExitTimer;

  try {
    console.info(`${signal} received. Shutting down gracefully.`);

    forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out.');
      process.exit(1);
    }, config.server.shutdownTimeoutMs);

    await closeSocketServer(io);
    stopBackgroundWorkers();
    await closeServiceBus();
    await disconnectDB();
    await closeRedis();
    clearTimeout(forceExitTimer);
    console.info('Shutdown complete.');
    process.exit(0);
  } catch (error) {
    if (forceExitTimer) {
      clearTimeout(forceExitTimer);
    }
    console.error('Unexpected shutdown failure:', error.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  shutdown('unhandledRejection');
});

startServer();

module.exports = {
  io,
  server,
  startServer,
  shutdown
};
