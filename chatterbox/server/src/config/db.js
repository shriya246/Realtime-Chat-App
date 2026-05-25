/**
 * Purpose: Manages MongoDB connection lifecycle with Mongoose and retry handling.
 */

const mongoose = require('mongoose');

const { getConfig } = require('./index');

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 2000;

/**
 * Waits for a specified duration.
 *
 * @param {number} milliseconds - Delay duration.
 * @returns {Promise<void>} Promise resolved after the delay.
 */
const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * Resolves the MongoDB URI for the active environment.
 *
 * @returns {string} MongoDB connection string.
 */
const resolveMongoUri = () => {
  const config = getConfig();

  return config.environment === 'test' ? config.mongo.testUri || config.mongo.uri : config.mongo.uri;
};

/**
 * Connects to MongoDB with bounded retry logic.
 *
 * @param {object} options - Optional connection settings.
 * @param {number} options.maxRetries - Maximum retry attempts.
 * @param {number} options.retryDelayMs - Delay between attempts.
 * @param {string} options.mongoUri - Explicit MongoDB URI.
 * @returns {Promise<typeof mongoose>} Mongoose instance.
 */
const connectDB = async ({ maxRetries = DEFAULT_MAX_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS, mongoUri } = {}) => {
  const config = getConfig();
  const uri = mongoUri || resolveMongoUri();
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await mongoose.connect(uri, {
        maxPoolSize: config.mongo.maxPoolSize,
        serverSelectionTimeoutMS: 5000
      });

      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected.');
      });

      return mongoose;
    } catch (error) {
      attempt += 1;

      if (attempt >= maxRetries) {
        console.error('MongoDB connection failed after retries:', error.message);
        throw error;
      }

      console.warn(`MongoDB connection attempt ${attempt} failed. Retrying in ${retryDelayMs}ms.`);
      await delay(retryDelayMs);
    }
  }

  return mongoose;
};

/**
 * Disconnects Mongoose from MongoDB.
 *
 * @returns {Promise<void>} Resolves when disconnected.
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('MongoDB disconnect failed:', error.message);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  resolveMongoUri
};
