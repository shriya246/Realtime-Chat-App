/**
 * Purpose: Centralizes validated runtime configuration for all backend integrations and security controls.
 */

const dotenv = require('dotenv');

dotenv.config();

const DEFAULTS = Object.freeze({
  authMaxRequests: 20,
  authWindowMs: 15 * 60 * 1000,
  bcryptSaltRounds: 12,
  clientUrl: 'http://localhost:3000',
  compressionThresholdBytes: 1024,
  jsonBodyLimit: '1mb',
  jwtExpiresIn: '1h',
  messageCacheTtlSeconds: 24 * 60 * 60,
  messageHistoryLimit: 50,
  mongoMaxPoolSize: 10,
  mongoUri: 'mongodb://127.0.0.1:27017/chatterbox',
  mongoTestUri: 'mongodb://127.0.0.1:27017/chatterbox_test',
  onlineUserTtlSeconds: 60 * 60,
  port: 5000,
  redisDb: 0,
  redisHost: '127.0.0.1',
  redisPort: 6379,
  serviceBusQueueName: 'chatterbox-messages',
  shutdownTimeoutMs: 10000
});

/**
 * Reads an optional string and removes surrounding whitespace.
 *
 * @param {string} name - Environment variable name.
 * @param {string} [fallback] - Value used when no variable is supplied.
 * @returns {string} Configured string value.
 */
const readString = (name, fallback = '') => {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
};

/**
 * Reads an integer-valued setting with range validation.
 *
 * @param {string} name - Environment variable name.
 * @param {number} fallback - Value used when no variable is supplied.
 * @param {number} minimum - Lowest accepted integer value.
 * @returns {number} Configured integer value.
 */
const readInteger = (name, fallback, minimum = 0) => {
  const rawValue = readString(name);
  const value = rawValue === '' ? fallback : Number(rawValue);

  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }

  return value;
};

/**
 * Reads an explicit true/false setting.
 *
 * @param {string} name - Environment variable name.
 * @param {boolean} fallback - Value used when no variable is supplied.
 * @returns {boolean} Configured boolean value.
 */
const readBoolean = (name, fallback = false) => {
  const rawValue = readString(name);

  if (rawValue === '') {
    return fallback;
  }

  if (!['true', 'false'].includes(rawValue.toLowerCase())) {
    throw new Error(`${name} must be either true or false.`);
  }

  return rawValue.toLowerCase() === 'true';
};

/**
 * Parses a comma-delimited origin list for browser and Socket.io clients.
 *
 * @param {string} rawOrigins - Delimited origins.
 * @returns {Array<string>} Non-empty origin strings.
 */
const parseOrigins = (rawOrigins) =>
  rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);

/**
 * Constructs a runtime configuration snapshot from environment values.
 *
 * @returns {object} Backend configuration snapshot.
 */
const getConfig = () => {
  const environment = readString('NODE_ENV', 'development');
  const clientUrl = readString('CLIENT_URL', DEFAULTS.clientUrl);
  const configuredOrigins = readString('CORS_ALLOWED_ORIGINS', clientUrl);
  const productionMongoUri = environment === 'production' ? '' : DEFAULTS.mongoUri;

  return {
    environment,
    server: {
      jsonBodyLimit: readString('JSON_BODY_LIMIT', DEFAULTS.jsonBodyLimit),
      port: readInteger('PORT', readInteger('SERVER_PORT', DEFAULTS.port, 1), 1),
      shutdownTimeoutMs: readInteger('SHUTDOWN_TIMEOUT_MS', DEFAULTS.shutdownTimeoutMs, 1),
      trustProxy: readBoolean('TRUST_PROXY')
    },
    cors: {
      allowedOrigins: parseOrigins(configuredOrigins),
      explicitlyConfigured: Boolean(readString('CORS_ALLOWED_ORIGINS') || readString('CLIENT_URL'))
    },
    security: {
      authMaxRequests: readInteger('AUTH_RATE_LIMIT_MAX', DEFAULTS.authMaxRequests, 1),
      authWindowMs: readInteger('AUTH_RATE_LIMIT_WINDOW_MS', DEFAULTS.authWindowMs, 1),
      bcryptSaltRounds: readInteger('BCRYPT_SALT_ROUNDS', DEFAULTS.bcryptSaltRounds, 4),
      compressionThresholdBytes: readInteger(
        'COMPRESSION_THRESHOLD_BYTES',
        DEFAULTS.compressionThresholdBytes,
        0
      )
    },
    jwt: {
      expiresIn: readString('JWT_EXPIRES_IN', DEFAULTS.jwtExpiresIn),
      secret: readString(
        'JWT_SECRET',
        environment === 'test' ? 'test-only-chatterbox-jwt-secret' : ''
      )
    },
    mongo: {
      maxPoolSize: readInteger('MONGO_MAX_POOL_SIZE', DEFAULTS.mongoMaxPoolSize, 1),
      testUri: readString('MONGO_TEST_URI', readString('MONGO_URI', DEFAULTS.mongoTestUri)),
      uri: readString('MONGO_URI', productionMongoUri)
    },
    redis: {
      clusterNodes: readString('REDIS_CLUSTER_NODES'),
      db: readInteger('REDIS_DB', DEFAULTS.redisDb, 0),
      host: readString('REDIS_HOST', DEFAULTS.redisHost),
      password: readString('REDIS_PASSWORD') || undefined,
      port: readInteger('REDIS_PORT', DEFAULTS.redisPort, 1),
      tls: readBoolean('REDIS_TLS')
    },
    cache: {
      messageHistoryLimit: readInteger('MESSAGE_HISTORY_LIMIT', DEFAULTS.messageHistoryLimit, 1),
      messageTtlSeconds: readInteger('MESSAGE_CACHE_TTL_SECONDS', DEFAULTS.messageCacheTtlSeconds, 1),
      onlineUserTtlSeconds: readInteger('ONLINE_USER_TTL_SECONDS', DEFAULTS.onlineUserTtlSeconds, 1)
    },
    serviceBus: {
      connectionString: readString('AZURE_SERVICE_BUS_CONNECTION_STRING'),
      queueName: readString('AZURE_SERVICE_BUS_QUEUE_NAME', DEFAULTS.serviceBusQueueName)
    }
  };
};

/**
 * Rejects startup configurations that would create insecure or incomplete deployments.
 *
 * @param {object} config - Runtime configuration snapshot.
 * @returns {object} Validated configuration snapshot.
 */
const validateConfig = (config = getConfig()) => {
  const missingVariables = [];

  if (!config.jwt.secret) {
    missingVariables.push('JWT_SECRET');
  }

  if (config.environment === 'production') {
    if (!config.mongo.uri) {
      missingVariables.push('MONGO_URI');
    }

    if (!config.cors.explicitlyConfigured) {
      missingVariables.push('CORS_ALLOWED_ORIGINS');
    }

    if (!config.serviceBus.connectionString) {
      missingVariables.push('AZURE_SERVICE_BUS_CONNECTION_STRING');
    }
  }

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}.`);
  }

  return config;
};

module.exports = {
  getConfig,
  validateConfig
};
