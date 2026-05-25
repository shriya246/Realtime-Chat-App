/**
 * Purpose: Provides Redis operations for auth, recent-message cache, and online presence.
 */

const redis = require('../config/redis');

const { getConfig } = require('../config');

/**
 * Builds the Redis key used to blacklist a JWT.
 *
 * @param {string} token - JWT value.
 * @returns {string} Redis blacklist key.
 */
const buildBlacklistKey = (token) => `blacklist:${token}`;

/**
 * Builds the Redis key used for recent room messages.
 *
 * @param {string} roomId - Room identifier.
 * @returns {string} Room-message key.
 */
const buildMessageKey = (roomId) => `messages:${roomId}`;

/**
 * Builds the Redis key used for user presence.
 *
 * @param {string} userId - User identifier.
 * @returns {string} Presence key.
 */
const buildOnlineKey = (userId) => `online:${userId}`;

/**
 * Adds a token to the Redis blacklist for its remaining lifetime.
 *
 * @param {string} token - JWT to blacklist.
 * @param {number} ttlSeconds - Token time-to-live in seconds.
 * @returns {Promise<void>} Resolves after the token is blacklisted.
 */
const blacklistToken = async (token, ttlSeconds) => {
  try {
    await redis.set(buildBlacklistKey(token), '1', ttlSeconds);
  } catch (error) {
    throw error;
  }
};

/**
 * Checks whether a token is blacklisted.
 *
 * @param {string} token - JWT to check.
 * @returns {Promise<boolean>} True when the token is blacklisted.
 */
const isTokenBlacklisted = async (token) => {
  try {
    const value = await redis.get(buildBlacklistKey(token));
    return value === '1';
  } catch (error) {
    throw error;
  }
};

/**
 * Stores an ordered room message history as a bounded recent-message list.
 *
 * @param {string} roomId - Room identifier.
 * @param {Array<object>} messages - Messages ordered oldest to newest.
 * @returns {Promise<void>} Resolves after caching.
 */
const cacheMessages = async (roomId, messages) => {
  try {
    const key = buildMessageKey(roomId);
    const { messageHistoryLimit: limit, messageTtlSeconds: ttlSeconds } = getConfig().cache;

    await redis.del(key);

    for (const message of messages) {
      await redis.lpush(key, JSON.stringify(message));
    }

    if (messages.length > 0) {
      await redis.ltrim(key, 0, limit - 1);
      await redis.expire(key, ttlSeconds);
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Adds one new message to a room's bounded message cache.
 *
 * @param {string} roomId - Room identifier.
 * @param {object} message - Message payload to cache.
 * @returns {Promise<void>} Resolves after caching.
 */
const cacheMessage = async (roomId, message) => {
  try {
    const key = buildMessageKey(roomId);
    const { messageHistoryLimit: limit, messageTtlSeconds: ttlSeconds } = getConfig().cache;

    await redis.lpush(key, JSON.stringify(message));
    await redis.ltrim(key, 0, limit - 1);
    await redis.expire(key, ttlSeconds);
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves cached room messages in chronological display order.
 *
 * @param {string} roomId - Room identifier.
 * @returns {Promise<Array<object>|null>} Cached messages or null on a cache miss.
 */
const getCachedMessages = async (roomId) => {
  try {
    const { messageHistoryLimit: limit } = getConfig().cache;
    const serializedMessages = await redis.lrange(buildMessageKey(roomId), 0, limit - 1);

    if (serializedMessages.length === 0) {
      return null;
    }

    return serializedMessages.map((message) => JSON.parse(message)).reverse();
  } catch (error) {
    throw error;
  }
};

/**
 * Deletes cached room history after access-affecting room membership changes.
 *
 * @param {string} roomId - Room identifier.
 * @returns {Promise<void>} Resolves after invalidation.
 */
const invalidateRoomCache = async (roomId) => {
  try {
    await redis.del(buildMessageKey(roomId));
  } catch (error) {
    throw error;
  }
};

/**
 * Records a user's online presence with expiration.
 *
 * @param {object} user - User presence payload.
 * @returns {Promise<object>} Stored presence payload.
 */
const setUserOnline = async (user) => {
  try {
    const presence = {
      userId: user.id || user._id.toString(),
      username: user.username,
      onlineAt: new Date().toISOString()
    };
    const { onlineUserTtlSeconds: ttlSeconds } = getConfig().cache;

    await redis.set(buildOnlineKey(presence.userId), JSON.stringify(presence), ttlSeconds);
    return presence;
  } catch (error) {
    throw error;
  }
};

/**
 * Clears a user's online presence.
 *
 * @param {string} userId - User identifier.
 * @returns {Promise<void>} Resolves after removal.
 */
const setUserOffline = async (userId) => {
  try {
    await redis.del(buildOnlineKey(userId));
  } catch (error) {
    throw error;
  }
};

/**
 * Returns all currently cached user presence payloads.
 *
 * @returns {Promise<Array<object>>} Online users.
 */
const getOnlineUsers = async () => {
  try {
    let cursor = '0';
    const keys = [];

    do {
      const [nextCursor, pageKeys] = await redis.scan(cursor, 'online:*');
      cursor = nextCursor;
      keys.push(...pageKeys);
    } while (cursor !== '0');

    const onlineUsers = [];

    for (const key of keys) {
      const value = await redis.get(key);

      if (value) {
        onlineUsers.push(JSON.parse(value));
      }
    }

    return onlineUsers;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  blacklistToken,
  cacheMessage,
  cacheMessages,
  getCachedMessages,
  getOnlineUsers,
  invalidateRoomCache,
  isTokenBlacklisted,
  setUserOffline,
  setUserOnline
};
