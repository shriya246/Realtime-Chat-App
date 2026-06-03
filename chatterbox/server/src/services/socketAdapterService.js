/**
 * Purpose: Configures optional Redis Socket.io adapter for horizontal scaling.
 */

const { getConfig } = require('../config');
const redis = require('../config/redis');

const configureSocketAdapter = (io) => {
  const enabled = process.env.SOCKET_IO_REDIS_ADAPTER === 'true';

  if (!enabled) {
    io.adapterStatus = { enabled: false, reason: 'SOCKET_IO_REDIS_ADAPTER not enabled' };
    return io.adapterStatus;
  }

  try {
    // Optional dependency: install @socket.io/redis-adapter to enable multi-instance fan-out.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pubClient = redis.getRedisClient();
    const subClient = pubClient.duplicate ? pubClient.duplicate() : null;

    if (!subClient) {
      io.adapterStatus = { enabled: false, reason: 'Redis client does not support duplicate().' };
      return io.adapterStatus;
    }

    io.adapter(createAdapter(pubClient, subClient));
    io.adapterStatus = {
      enabled: true,
      redisHost: getConfig().redis.host
    };
    return io.adapterStatus;
  } catch (error) {
    io.adapterStatus = {
      enabled: false,
      reason: error.message
    };
    return io.adapterStatus;
  }
};

module.exports = {
  configureSocketAdapter
};
