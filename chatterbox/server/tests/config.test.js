/**
 * Purpose: Verifies MongoDB configuration retries, environment resolution, and shutdown behavior.
 */

jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: {
    on: jest.fn()
  },
  disconnect: jest.fn()
}));

const mongoose = require('mongoose');

const { connectDB, disconnectDB, resolveMongoUri } = require('../src/config/db');

describe('MongoDB configuration', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnvironment, NODE_ENV: 'development' };
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnvironment;
    jest.restoreAllMocks();
  });

  test('resolves development and test MongoDB connection strings', () => {
    process.env.MONGO_URI = 'mongodb://runtime/chatterbox';
    expect(resolveMongoUri()).toBe('mongodb://runtime/chatterbox');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_TEST_URI = 'mongodb://test/chatterbox';
    expect(resolveMongoUri()).toBe('mongodb://test/chatterbox');
  });

  test('connects using pooling and registers lifecycle listeners', async () => {
    mongoose.connect.mockResolvedValue(mongoose);
    process.env.MONGO_MAX_POOL_SIZE = '15';

    const result = await connectDB({ mongoUri: 'mongodb://runtime/chatterbox', maxRetries: 1 });

    expect(result).toBe(mongoose);
    expect(mongoose.connect).toHaveBeenCalledWith(
      'mongodb://runtime/chatterbox',
      expect.objectContaining({ maxPoolSize: 15 })
    );
    expect(mongoose.connection.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mongoose.connection.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
  });

  test('retries a transient connection error and disconnects cleanly', async () => {
    mongoose.connect.mockRejectedValueOnce(new Error('temporary outage')).mockResolvedValueOnce(mongoose);
    mongoose.disconnect.mockResolvedValue(undefined);

    await connectDB({ mongoUri: 'mongodb://runtime/chatterbox', maxRetries: 2, retryDelayMs: 0 });
    await disconnectDB();

    expect(mongoose.connect).toHaveBeenCalledTimes(2);
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
  });

  test('surfaces a final MongoDB connection failure', async () => {
    mongoose.connect.mockRejectedValue(new Error('unavailable'));

    await expect(connectDB({ mongoUri: 'mongodb://runtime/chatterbox', maxRetries: 1 })).rejects.toThrow('unavailable');
  });
});
