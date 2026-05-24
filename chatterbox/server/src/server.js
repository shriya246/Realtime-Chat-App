/**
 * Purpose: Starts the HTTP server, initializes MongoDB and Redis, and handles graceful shutdown.
 */

const http = require('http');

const dotenv = require('dotenv');

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { closeRedis, connectRedis } = require('./config/redis');

dotenv.config();

const DEFAULT_PORT = 5000;
const SHUTDOWN_TIMEOUT_MS = 10000;

const port = Number(process.env.PORT || process.env.SERVER_PORT || DEFAULT_PORT);
const server = http.createServer(app);

/**
 * Starts database/cache connections and begins listening for HTTP requests.
 *
 * @returns {Promise<void>} Resolves when the server is listening.
 */
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

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
  try {
    console.info(`${signal} received. Shutting down gracefully.`);

    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    server.close(async () => {
      try {
        await disconnectDB();
        await closeRedis();
        clearTimeout(forceExitTimer);
        console.info('Shutdown complete.');
        process.exit(0);
      } catch (error) {
        clearTimeout(forceExitTimer);
        console.error('Shutdown failed:', error.message);
        process.exit(1);
      }
    });
  } catch (error) {
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
  server,
  startServer,
  shutdown
};
