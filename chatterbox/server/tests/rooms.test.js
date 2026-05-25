/**
 * Purpose: Verifies core protected room creation, visibility, and membership operations.
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
const Room = require('../src/models/Room');
const User = require('../src/models/User');

let mongoServer;

/**
 * Registers a user for authenticated room requests.
 *
 * @param {string} username - Unique username.
 * @param {string} email - Unique email.
 * @returns {Promise<object>} Registered auth payload.
 */
const registerUser = async (username, email) => {
  const response = await request(app).post('/api/auth/register').send({
    username,
    email,
    password: 'StrongPassword123!'
  });

  return response.body.data;
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
  await Room.deleteMany({});
  await User.deleteMany({});
  await closeRedis();
});

describe('Room API', () => {
  test('creates and lists a public room for an authenticated user', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');

    const createResponse = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ name: 'General', type: 'public' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.room).toMatchObject({
      name: 'General',
      type: 'public',
      memberCount: 1
    });

    const listResponse = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.rooms).toHaveLength(1);
    expect(listResponse.body.data.rooms[0].name).toBe('General');
  });

  test('lets a creator add and a member leave a private room', async () => {
    const creator = await registerUser('creator', 'creator@example.com');
    const member = await registerUser('member', 'member@example.com');

    const createResponse = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ name: 'Private', type: 'private' });
    const roomId = createResponse.body.data.room.id;

    const addMemberResponse = await request(app)
      .post(`/api/rooms/${roomId}/members`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ userId: member.user.id });

    expect(addMemberResponse.status).toBe(200);
    expect(addMemberResponse.body.data.room.memberCount).toBe(2);

    const accessibleResponse = await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(accessibleResponse.status).toBe(200);

    const leaveResponse = await request(app)
      .delete(`/api/rooms/${roomId}/members/me`)
      .set('Authorization', `Bearer ${member.token}`);

    expect(leaveResponse.status).toBe(200);
    expect(leaveResponse.body.data.room.memberCount).toBe(1);
  });

  test('prevents a non-member from viewing a private room', async () => {
    const creator = await registerUser('creator', 'creator@example.com');
    const visitor = await registerUser('visitor', 'visitor@example.com');

    const createResponse = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ name: 'Private', type: 'private' });

    const response = await request(app)
      .get(`/api/rooms/${createResponse.body.data.room.id}`)
      .set('Authorization', `Bearer ${visitor.token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  test('rejects unauthenticated room creation and invalid room identifiers', async () => {
    const unauthenticatedResponse = await request(app)
      .post('/api/rooms')
      .send({ name: 'General', type: 'public' });
    const auth = await registerUser('shriya', 'shriya@example.com');
    const invalidIdResponse = await request(app)
      .get('/api/rooms/not-an-object-id')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(unauthenticatedResponse.status).toBe(401);
    expect(invalidIdResponse.status).toBe(400);
    expect(invalidIdResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('searches users and retrieves a user profile through protected user routes', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');
    await registerUser('alex', 'alex@example.com');

    const listResponse = await request(app)
      .get('/api/users?search=alex')
      .set('Authorization', `Bearer ${auth.token}`);
    const profileResponse = await request(app)
      .get(`/api/users/${listResponse.body.data.users[0].id}`)
      .set('Authorization', `Bearer ${auth.token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.users).toHaveLength(1);
    expect(listResponse.body.data.users[0].username).toBe('alex');
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user.email).toBe('alex@example.com');
  });

  test('returns controlled errors for missing users and unknown API routes', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');
    const missingUserId = new mongoose.Types.ObjectId();

    const userResponse = await request(app)
      .get(`/api/users/${missingUserId}`)
      .set('Authorization', `Bearer ${auth.token}`);
    const routeResponse = await request(app)
      .get('/api/unknown')
      .set('Authorization', `Bearer ${auth.token}`);

    expect(userResponse.status).toBe(404);
    expect(userResponse.body.error.code).toBe('NOT_FOUND');
    expect(routeResponse.status).toBe(404);
    expect(routeResponse.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
