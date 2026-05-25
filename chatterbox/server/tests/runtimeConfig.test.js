/**
 * Purpose: Verifies centralized runtime parsing and production startup validation rules.
 */

const { getConfig, validateConfig } = require('../src/config');

describe('Runtime configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      NODE_ENV: 'test'
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  test('parses configured server, security, integration, and cache values', () => {
    Object.assign(process.env, {
      AUTH_RATE_LIMIT_MAX: '30',
      AUTH_RATE_LIMIT_WINDOW_MS: '60000',
      AZURE_SERVICE_BUS_CONNECTION_STRING: 'Endpoint=sb://configured/',
      AZURE_SERVICE_BUS_QUEUE_NAME: 'delivery',
      BCRYPT_SALT_ROUNDS: '11',
      CLIENT_URL: 'https://portfolio.example',
      COMPRESSION_THRESHOLD_BYTES: '2048',
      JWT_EXPIRES_IN: '2h',
      JWT_SECRET: 'configured-secret',
      MESSAGE_CACHE_TTL_SECONDS: '1800',
      MESSAGE_HISTORY_LIMIT: '75',
      MONGO_MAX_POOL_SIZE: '20',
      MONGO_URI: 'mongodb://database/chatterbox',
      ONLINE_USER_TTL_SECONDS: '900',
      PORT: '5100',
      REDIS_DB: '2',
      REDIS_HOST: 'cache',
      REDIS_PORT: '6380',
      REDIS_TLS: 'true',
      SHUTDOWN_TIMEOUT_MS: '12000',
      TRUST_PROXY: 'true'
    });

    const config = getConfig();

    expect(config.server).toMatchObject({ port: 5100, shutdownTimeoutMs: 12000, trustProxy: true });
    expect(config.security).toMatchObject({
      authMaxRequests: 30,
      bcryptSaltRounds: 11,
      compressionThresholdBytes: 2048
    });
    expect(config.redis).toMatchObject({ db: 2, host: 'cache', port: 6380, tls: true });
    expect(config.cache).toMatchObject({ messageHistoryLimit: 75, messageTtlSeconds: 1800 });
    expect(config.mongo.testUri).toBe('mongodb://database/chatterbox');
    expect(config.serviceBus.queueName).toBe('delivery');
    expect(validateConfig(config)).toBe(config);
  });

  test('rejects malformed integer and boolean settings', () => {
    process.env.PORT = 'not-a-port';
    expect(() => getConfig()).toThrow('PORT must be an integer');

    process.env.PORT = '5000';
    process.env.TRUST_PROXY = 'perhaps';
    expect(() => getConfig()).toThrow('TRUST_PROXY must be either true or false');
  });

  test('requires deployment-critical production secrets and endpoints', () => {
    process.env.NODE_ENV = 'production';

    expect(() => validateConfig(getConfig())).toThrow(
      'JWT_SECRET, MONGO_URI, CORS_ALLOWED_ORIGINS, AZURE_SERVICE_BUS_CONNECTION_STRING'
    );

    Object.assign(process.env, {
      AZURE_SERVICE_BUS_CONNECTION_STRING: 'Endpoint=sb://production/',
      CORS_ALLOWED_ORIGINS: 'https://chat.example',
      JWT_SECRET: 'production-secret',
      MONGO_URI: 'mongodb://production/chatterbox'
    });

    expect(validateConfig(getConfig()).cors.allowedOrigins).toEqual(['https://chat.example']);
  });
});
