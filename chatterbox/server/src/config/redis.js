/**
 * Purpose: Configures Redis with ioredis and exposes safe helper operations.
 */

const Redis = require('ioredis');

const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_DB = 0;
const DEFAULT_RETRY_DELAY_MS = 200;
const MAX_RETRY_DELAY_MS = 2000;

let redisClient = null;
const memoryStore = new Map();
const memoryExpirations = new Map();

/**
 * Removes expired in-memory keys used during tests.
 *
 * @param {string} key - Key to inspect.
 * @returns {void}
 */
const clearExpiredMemoryKey = (key) => {
  const expiresAt = memoryExpirations.get(key);

  if (expiresAt && expiresAt <= Date.now()) {
    memoryStore.delete(key);
    memoryExpirations.delete(key);
  }
};

/**
 * Creates a test-safe in-memory Redis-like adapter.
 *
 * @returns {object} Minimal Redis helper adapter.
 */
const createMemoryRedisClient = () => ({
  status: 'ready',
  async get(key) {
    try {
      clearExpiredMemoryKey(key);
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    } catch (error) {
      throw error;
    }
  },
  async set(key, value, mode, ttlSeconds) {
    try {
      memoryStore.set(key, value);

      if (mode === 'EX' && ttlSeconds) {
        memoryExpirations.set(key, Date.now() + Number(ttlSeconds) * 1000);
      }

      return 'OK';
    } catch (error) {
      throw error;
    }
  },
  async del(key) {
    try {
      const deleted = memoryStore.delete(key) ? 1 : 0;
      memoryExpirations.delete(key);
      return deleted;
    } catch (error) {
      throw error;
    }
  },
  async expire(key, ttlSeconds) {
    try {
      if (!memoryStore.has(key)) {
        return 0;
      }

      memoryExpirations.set(key, Date.now() + Number(ttlSeconds) * 1000);
      return 1;
    } catch (error) {
      throw error;
    }
  },
  async quit() {
    try {
      memoryStore.clear();
      memoryExpirations.clear();
      return 'OK';
    } catch (error) {
      throw error;
    }
  }
});

/**
 * Builds Redis connection options from environment variables.
 *
 * @returns {object} ioredis connection options.
 */
const getRedisOptions = () => ({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || DEFAULT_REDIS_PORT),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || DEFAULT_REDIS_DB),
  lazyConnect: true,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  retryStrategy: (times) => Math.min(times * DEFAULT_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS)
});

/**
 * Returns the Redis client singleton.
 *
 * @returns {object} Redis client or in-memory adapter.
 */
const getRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  if (process.env.NODE_ENV === 'test') {
    redisClient = createMemoryRedisClient();
    return redisClient;
  }

  redisClient = new Redis(getRedisOptions());

  redisClient.on('connect', () => {
    console.info('Redis connection established.');
  });

  redisClient.on('error', (error) => {
    console.error('Redis connection error:', error.message);
  });

  redisClient.on('close', () => {
    console.warn('Redis connection closed.');
  });

  return redisClient;
};

/**
 * Opens a Redis connection when using the real ioredis client.
 *
 * @returns {Promise<object>} Connected Redis client.
 */
const connectRedis = async () => {
  try {
    const client = getRedisClient();

    if (client.connect && client.status !== 'ready') {
      await client.connect();
    }

    return client;
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    throw error;
  }
};

/**
 * Reads a Redis value by key.
 *
 * @param {string} key - Redis key.
 * @returns {Promise<string|null>} Stored value or null.
 */
const get = async (key) => {
  try {
    return await getRedisClient().get(key);
  } catch (error) {
    console.error('Redis GET failed:', error.message);
    throw error;
  }
};

/**
 * Writes a Redis value with an optional TTL.
 *
 * @param {string} key - Redis key.
 * @param {string} value - Redis value.
 * @param {number|null} ttlSeconds - Optional expiration in seconds.
 * @returns {Promise<string>} Redis response.
 */
const set = async (key, value, ttlSeconds = null) => {
  try {
    if (ttlSeconds) {
      return await getRedisClient().set(key, value, 'EX', ttlSeconds);
    }

    return await getRedisClient().set(key, value);
  } catch (error) {
    console.error('Redis SET failed:', error.message);
    throw error;
  }
};

/**
 * Deletes a Redis key.
 *
 * @param {string} key - Redis key.
 * @returns {Promise<number>} Number of keys deleted.
 */
const del = async (key) => {
  try {
    return await getRedisClient().del(key);
  } catch (error) {
    console.error('Redis DEL failed:', error.message);
    throw error;
  }
};

/**
 * Sets an expiration on a Redis key.
 *
 * @param {string} key - Redis key.
 * @param {number} ttlSeconds - Expiration in seconds.
 * @returns {Promise<number>} Redis response.
 */
const expire = async (key, ttlSeconds) => {
  try {
    return await getRedisClient().expire(key, ttlSeconds);
  } catch (error) {
    console.error('Redis EXPIRE failed:', error.message);
    throw error;
  }
};

/**
 * Closes the Redis client.
 *
 * @returns {Promise<void>} Resolves when the connection is closed.
 */
const closeRedis = async () => {
  try {
    if (!redisClient) {
      return;
    }

    if (redisClient.quit) {
      await redisClient.quit();
    }

    redisClient = null;
  } catch (error) {
    console.error('Redis close failed:', error.message);
    throw error;
  }
};

module.exports = {
  closeRedis,
  connectRedis,
  del,
  expire,
  get,
  getRedisClient,
  set
};
