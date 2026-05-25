/**
 * Purpose: Configures Redis with ioredis and exposes safe helper operations.
 */

const Redis = require('ioredis');

const { getConfig } = require('./index');

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
 * Tests whether a key matches a simple Redis glob pattern.
 *
 * @param {string} key - Candidate key.
 * @param {string} pattern - Redis-style glob pattern.
 * @returns {boolean} True when the key matches.
 */
const matchesPattern = (key, pattern) => {
  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(`^${escapedPattern}$`).test(key);
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
  async lpush(key, ...values) {
    try {
      clearExpiredMemoryKey(key);
      const list = Array.isArray(memoryStore.get(key)) ? memoryStore.get(key) : [];
      list.unshift(...values);
      memoryStore.set(key, list);
      return list.length;
    } catch (error) {
      throw error;
    }
  },
  async ltrim(key, start, end) {
    try {
      clearExpiredMemoryKey(key);
      const list = Array.isArray(memoryStore.get(key)) ? memoryStore.get(key) : [];
      memoryStore.set(key, list.slice(start, end + 1));
      return 'OK';
    } catch (error) {
      throw error;
    }
  },
  async lrange(key, start, end) {
    try {
      clearExpiredMemoryKey(key);
      const list = Array.isArray(memoryStore.get(key)) ? memoryStore.get(key) : [];
      return list.slice(start, end + 1);
    } catch (error) {
      throw error;
    }
  },
  async scan(_cursor, ...argumentsList) {
    try {
      const matchIndex = argumentsList.indexOf('MATCH');
      const pattern = matchIndex >= 0 ? argumentsList[matchIndex + 1] : '*';
      const keys = [];

      memoryStore.forEach((_value, key) => {
        clearExpiredMemoryKey(key);

        if (memoryStore.has(key) && matchesPattern(key, pattern)) {
          keys.push(key);
        }
      });

      return ['0', keys];
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
const getRedisOptions = () => {
  const { redis } = getConfig();

  return {
    host: redis.host,
    port: redis.port,
    password: redis.password,
    db: redis.db,
    lazyConnect: true,
    tls: redis.tls ? {} : undefined,
    retryStrategy: (times) => Math.min(times * DEFAULT_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS)
  };
};

/**
 * Parses optional comma-separated Redis Cluster node endpoints.
 *
 * @returns {Array<{ host: string, port: number }>} Cluster startup nodes.
 */
const getRedisClusterNodes = () => {
  const { redis } = getConfig();

  if (!redis.clusterNodes) {
    return [];
  }

  return redis.clusterNodes.split(',')
    .map((node) => node.trim())
    .filter(Boolean)
    .map((node) => {
      const [host, port = redis.port] = node.split(':');
      return { host, port: Number(port) };
    });
};

/**
 * Builds ioredis Cluster settings for managed production Redis deployments.
 *
 * @returns {object} Cluster configuration.
 */
const getRedisClusterOptions = () => {
  const { redis } = getConfig();

  return {
    clusterRetryStrategy: (times) => Math.min(times * DEFAULT_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS),
    lazyConnect: true,
    redisOptions: {
      db: redis.db,
      password: redis.password,
      tls: redis.tls ? {} : undefined
    }
  };
};

/**
 * Returns the Redis client singleton.
 *
 * @returns {object} Redis client or in-memory adapter.
 */
const getRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  if (getConfig().environment === 'test') {
    redisClient = createMemoryRedisClient();
    return redisClient;
  }

  const clusterNodes = getRedisClusterNodes();
  redisClient = clusterNodes.length > 0
    ? new Redis.Cluster(clusterNodes, getRedisClusterOptions())
    : new Redis(getRedisOptions());

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
 * Prepends serialized values to a Redis list.
 *
 * @param {string} key - Redis list key.
 * @param {...string} values - Values to prepend.
 * @returns {Promise<number>} Length of the list after insertion.
 */
const lpush = async (key, ...values) => {
  try {
    return await getRedisClient().lpush(key, ...values);
  } catch (error) {
    console.error('Redis LPUSH failed:', error.message);
    throw error;
  }
};

/**
 * Retains a bounded range of Redis list items.
 *
 * @param {string} key - Redis list key.
 * @param {number} start - Inclusive start index.
 * @param {number} end - Inclusive end index.
 * @returns {Promise<string>} Redis response.
 */
const ltrim = async (key, start, end) => {
  try {
    return await getRedisClient().ltrim(key, start, end);
  } catch (error) {
    console.error('Redis LTRIM failed:', error.message);
    throw error;
  }
};

/**
 * Reads a range of serialized items from a Redis list.
 *
 * @param {string} key - Redis list key.
 * @param {number} start - Inclusive start index.
 * @param {number} end - Inclusive end index.
 * @returns {Promise<Array<string>>} List values.
 */
const lrange = async (key, start, end) => {
  try {
    return await getRedisClient().lrange(key, start, end);
  } catch (error) {
    console.error('Redis LRANGE failed:', error.message);
    throw error;
  }
};

/**
 * Scans Redis keys without blocking the server with a full key enumeration.
 *
 * @param {string} cursor - Redis scan cursor.
 * @param {string} pattern - Glob pattern to match.
 * @returns {Promise<Array<string|Array<string>>>} Next cursor and matching keys.
 */
const scan = async (cursor, pattern) => {
  try {
    return await getRedisClient().scan(cursor, 'MATCH', pattern, 'COUNT', 100);
  } catch (error) {
    console.error('Redis SCAN failed:', error.message);
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
  getRedisClusterNodes,
  getRedisClient,
  lpush,
  lrange,
  ltrim,
  scan,
  set
};
