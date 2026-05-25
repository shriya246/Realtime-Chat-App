/**
 * Purpose: Verifies paginated history authorization and Redis room-history cache behavior.
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
const Message = require('../src/models/Message');
const Room = require('../src/models/Room');
const User = require('../src/models/User');
const redisService = require('../src/services/redisService');
const { loadMessageHistory } = require('../src/socket/events/roomHandler');

let mongoServer;

/**
 * Registers an authenticated user.
 *
 * @param {string} username - Username.
 * @param {string} email - Email.
 * @returns {Promise<object>} Authentication data.
 */
const registerUser = async (username, email) => {
  const response = await request(app).post('/api/auth/register').send({
    username,
    email,
    password: 'StrongPassword123!'
  });

  return response.body.data;
};

/**
 * Creates an authenticated room.
 *
 * @param {string} token - Authentication token.
 * @param {object} payload - Room request body.
 * @returns {Promise<object>} Created room.
 */
const createRoom = async (token, payload = { name: 'General', type: 'public' }) => {
  const response = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);

  return response.body.data.room;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await closeRedis();
});

beforeEach(async () => {
  await Message.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  await closeRedis();
});

describe('Message history API and cache', () => {
  test('returns cursor-paginated room messages in chronological display order', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');
    const room = await createRoom(auth.token);

    for (const content of ['first', 'second', 'third']) {
      await Message.create({
        roomId: room.id,
        senderId: auth.user.id,
        content,
        status: 'delivered'
      });
    }

    const firstPage = await request(app)
      .get(`/api/rooms/${room.id}/messages?limit=2`)
      .set('Authorization', `Bearer ${auth.token}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.messages.map((message) => message.content)).toEqual(['second', 'third']);
    expect(firstPage.body.data.pagination.hasMore).toBe(true);
    expect(firstPage.body.data.pagination.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app)
      .get(`/api/rooms/${room.id}/messages?limit=2&before=${firstPage.body.data.pagination.nextCursor}`)
      .set('Authorization', `Bearer ${auth.token}`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.messages.map((message) => message.content)).toEqual(['first']);
    expect(secondPage.body.data.pagination.hasMore).toBe(false);
  });

  test('serves socket history from cache after a MongoDB miss warms it', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');
    const room = await createRoom(auth.token);
    await Message.create({
      roomId: room.id,
      senderId: auth.user.id,
      content: 'Cached after read',
      status: 'delivered'
    });

    const missResult = await loadMessageHistory(room.id);
    const hitResult = await loadMessageHistory(room.id);

    expect(missResult.source).toBe('database');
    expect(hitResult.source).toBe('cache');
    expect(hitResult.messages[0].content).toBe('Cached after read');
  });

  test('invalidates cached history when private membership changes', async () => {
    const creator = await registerUser('creator', 'creator@example.com');
    const member = await registerUser('member', 'member@example.com');
    const room = await createRoom(creator.token, { name: 'Private', type: 'private' });

    await redisService.cacheMessages(room.id, [{ id: 'cached', content: 'hidden' }]);

    const response = await request(app)
      .post(`/api/rooms/${room.id}/members`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ userId: member.user.id });

    expect(response.status).toBe(200);
    expect(await redisService.getCachedMessages(room.id)).toBeNull();
  });
});
