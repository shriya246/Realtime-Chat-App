/**
 * Purpose: Verifies authentication endpoints and protected-route behavior with Supertest.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-chatterbox-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../src/app');
const { closeRedis } = require('../src/config/redis');
const User = require('../src/models/User');

let mongoServer;

/**
 * Registers a valid test user.
 *
 * @param {object} overrides - Optional user field overrides.
 * @returns {Promise<object>} Supertest response.
 */
const registerUser = async (overrides = {}) => {
  try {
    const payload = {
      username: 'shriya',
      email: 'shriya@example.com',
      password: 'StrongPassword123!',
      ...overrides
    };

    return await request(app).post('/api/auth/register').send(payload);
  } catch (error) {
    throw error;
  }
};

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  } catch (error) {
    throw error;
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();

    if (mongoServer) {
      await mongoServer.stop();
    }

    await closeRedis();
  } catch (error) {
    throw error;
  }
});

beforeEach(async () => {
  try {
    await User.deleteMany({});
    await closeRedis();
  } catch (error) {
    throw error;
  }
});

describe('Auth API', () => {
  test('registers a user with valid input', async () => {
    const response = await registerUser();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      username: 'shriya',
      email: 'shriya@example.com'
    });
    expect(response.body.data.user.passwordHash).toBeUndefined();

    const savedUser = await User.findOne({ email: 'shriya@example.com' });
    expect(savedUser).not.toBeNull();
    expect(savedUser.passwordHash).not.toBe('StrongPassword123!');
  });

  test('rejects duplicate registration by email', async () => {
    await registerUser();

    const response = await registerUser({
      username: 'shriya_two'
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  test('logs in with valid credentials', async () => {
    await registerUser();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'shriya@example.com',
        password: 'StrongPassword123!'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe('shriya@example.com');
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  test('rejects login with wrong password', async () => {
    await registerUser();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'shriya@example.com',
        password: 'WrongPassword123!'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  test('allows protected current-user route with a valid token', async () => {
    const registerResponse = await registerUser();
    const { token } = registerResponse.body.data;

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('shriya@example.com');
  });

  test('rejects protected current-user route without a token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  test('blacklists token on logout and rejects reuse', async () => {
    const registerResponse = await registerUser();
    const { token } = registerResponse.body.data;

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.success).toBe(true);

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meResponse.status).toBe(401);
    expect(meResponse.body.error.message).toBe('Authentication token has been revoked.');
  });
});
