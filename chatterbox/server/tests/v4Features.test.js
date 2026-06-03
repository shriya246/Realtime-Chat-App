/**
 * Purpose: Verifies v4 calls, statuses, channels, sessions, scaling adapter, and dashboard behavior.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-chatterbox-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.EVENT_PUBLISHER = 'noop';

jest.mock('../src/services/azureServiceBusService', () => ({
  closeServiceBus: jest.fn().mockResolvedValue(undefined),
  receiveMessages: jest.fn().mockResolvedValue(null),
  sendMessage: jest.fn().mockResolvedValue({ published: false, reason: 'LOCAL_NOOP_EVENT_PUBLISHER' })
}));

const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { io: createClient } = require('socket.io-client');

const app = require('../src/app');
const { closeRedis } = require('../src/config/redis');
const { Channel } = require('../src/models/Channel');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Report = require('../src/models/Report');
const Session = require('../src/models/Session');
const Status = require('../src/models/Status');
const User = require('../src/models/User');
const {
  startBackgroundWorkers,
  stopBackgroundWorkers
} = require('../src/services/backgroundWorkerService');
const { cleanupExpiredStatuses } = require('../src/services/statusCleanupService');
const { configureSocketAdapter } = require('../src/services/socketAdapterService');
const { initializeSocketServer } = require('../src/socket/socketManager');

let mongoServer;
let httpServer;
let socketServer;
let baseUrl;
const clients = [];

const registerUser = async (username, email) =>
  (await request(app).post('/api/auth/register').send({
    email,
    password: 'StrongPassword123!',
    username
  })).body.data;

const loginUser = async (email) =>
  (await request(app).post('/api/auth/login').send({
    email,
    password: 'StrongPassword123!'
  })).body.data;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createDirectConversation = async (token, targetUserId) =>
  (await request(app)
    .post('/api/conversations/direct')
    .set(auth(token))
    .send({ targetUserId })).body.data.conversation;

const connectSocket = async (token) => {
  const client = createClient(baseUrl, {
    auth: { token },
    forceNew: true,
    reconnection: false,
    transports: ['websocket']
  });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
};

const emitAck = (client, eventName, payload) =>
  new Promise((resolve) => client.emit(eventName, payload, resolve));

const waitForEvent = (client, eventName) =>
  new Promise((resolve) => client.once(eventName, resolve));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  httpServer = http.createServer(app);
  socketServer = initializeSocketServer(httpServer);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

afterAll(async () => {
  clients.forEach((client) => client.disconnect());
  await new Promise((resolve) => socketServer.close(resolve));
  await mongoose.disconnect();
  await mongoServer.stop();
  await closeRedis();
});

beforeEach(async () => {
  while (clients.length > 0) {
    clients.pop().disconnect();
  }
  await Channel.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Report.deleteMany({});
  await Session.deleteMany({});
  await Status.deleteMany({});
  await User.deleteMany({});
  await closeRedis();
});

describe('v4 calls, statuses, channels, sessions, scaling, and dashboard', () => {
  test('authorizes and forwards 1:1 WebRTC call signaling', async () => {
    const caller = await registerUser('caller', 'caller@example.com');
    const receiver = await registerUser('receiver', 'receiver@example.com');
    const outsider = await registerUser('outsider', 'outsider@example.com');
    const conversation = await createDirectConversation(caller.token, receiver.user.id);
    const callerSocket = await connectSocket(caller.token);
    const receiverSocket = await connectSocket(receiver.token);
    const outsiderSocket = await connectSocket(outsider.token);
    const receivedOffer = waitForEvent(receiverSocket, 'call:offer');

    const ack = await emitAck(callerSocket, 'call:offer', {
      callId: 'call-1',
      conversationId: conversation.id,
      mediaType: 'audio',
      offer: { sdp: 'local-offer', type: 'offer' }
    });
    const unauthorizedAck = await emitAck(outsiderSocket, 'call:offer', {
      callId: 'bad-call',
      conversationId: conversation.id,
      mediaType: 'video',
      offer: { sdp: 'bad', type: 'offer' }
    });
    const payload = await receivedOffer;

    expect(ack.success).toBe(true);
    expect(payload.callId).toBe('call-1');
    expect(payload.fromUser.id).toBe(caller.user.id);
    expect(unauthorizedAck.success).toBe(false);
  });

  test('creates statuses, hides expired statuses, and cleanup removes expired records', async () => {
    const owner = await registerUser('statusowner', 'statusowner@example.com');

    const createResponse = await request(app)
      .post('/api/statuses')
      .set(auth(owner.token))
      .send({ content: 'hello status', privacy: 'everyone', type: 'text' });
    await Status.create({
      content: 'expired',
      expiresAt: new Date(Date.now() - 1000),
      ownerId: owner.user.id,
      type: 'text'
    });
    const listResponse = await request(app).get('/api/statuses').set(auth(owner.token));
    const viewResponse = await request(app).post(`/api/statuses/${createResponse.body.data.status.id}/view`).set(auth(owner.token));
    const deletedCount = await cleanupExpiredStatuses();

    expect(createResponse.status).toBe(201);
    expect(listResponse.body.data.statuses.map((status) => status.content)).toEqual(['hello status']);
    expect(viewResponse.body.data.status.viewers).toHaveLength(1);
    expect(deletedCount).toBe(1);
  });

  test('supports channel create, follow, admin-only posts, and reactions', async () => {
    const owner = await registerUser('channelowner', 'channelowner@example.com');
    const follower = await registerUser('follower', 'follower@example.com');
    const createResponse = await request(app)
      .post('/api/channels')
      .set(auth(owner.token))
      .send({ description: 'Updates', name: 'Launch Channel' });
    const channelId = createResponse.body.data.channel.id;
    const followResponse = await request(app).post(`/api/channels/${channelId}/follow`).set(auth(follower.token));
    const blockedPost = await request(app)
      .post(`/api/channels/${channelId}/posts`)
      .set(auth(follower.token))
      .send({ content: 'not allowed' });
    const postResponse = await request(app)
      .post(`/api/channels/${channelId}/posts`)
      .set(auth(owner.token))
      .send({ content: 'Official update' });
    const postId = postResponse.body.data.post._id;
    const reactionResponse = await request(app)
      .post(`/api/channels/${channelId}/posts/${postId}/reactions`)
      .set(auth(follower.token))
      .send({ emoji: '👍' });

    expect(createResponse.status).toBe(201);
    expect(followResponse.body.data.channel.isFollowing).toBe(true);
    expect(blockedPost.status).toBe(403);
    expect(postResponse.status).toBe(201);
    expect(reactionResponse.body.data.post.reactions[0].emoji).toBe('👍');
  });

  test('tracks sessions and can logout all other sessions', async () => {
    const user = await registerUser('sessionuser', 'session@example.com');
    await loginUser('session@example.com');
    const sessionsBefore = await request(app).get('/api/sessions').set(auth(user.token));
    const logoutAll = await request(app)
      .delete('/api/sessions/all')
      .set(auth(user.token))
      .send({ keepCurrent: true });
    const sessionsAfter = await request(app).get('/api/sessions').set(auth(user.token));

    expect(sessionsBefore.body.data.sessions.length).toBeGreaterThanOrEqual(2);
    expect(logoutAll.status).toBe(200);
    expect(sessionsAfter.body.data.sessions).toHaveLength(1);
    expect(sessionsAfter.body.data.currentSessionId).toBe(user.session.sessionId);
  });

  test('Redis Socket.io adapter configuration is safe by default and on missing optional dependency', () => {
    const io = { adapter: jest.fn() };
    const previous = process.env.SOCKET_IO_REDIS_ADAPTER;

    process.env.SOCKET_IO_REDIS_ADAPTER = 'false';
    const disabled = configureSocketAdapter(io);
    process.env.SOCKET_IO_REDIS_ADAPTER = 'true';
    const fallback = configureSocketAdapter(io);
    process.env.SOCKET_IO_REDIS_ADAPTER = previous;

    expect(disabled.enabled).toBe(false);
    expect(fallback.enabled).toBe(false);
    expect(io.adapter).not.toHaveBeenCalled();
  });

  test('starts and stops local background workers', () => {
    const workers = startBackgroundWorkers({ emit: jest.fn() });
    stopBackgroundWorkers();

    expect(workers.disappearingTimer).toBeDefined();
    expect(workers.statusTimer).toBeDefined();
  });

  test('protects admin dashboard metrics and exposes local metrics for admins', async () => {
    const regular = await registerUser('regular', 'regular@example.com');
    const admin = await registerUser('admin', 'admin@example.com');
    await User.findByIdAndUpdate(admin.user.id, { isAdmin: true });
    const conversation = await createDirectConversation(admin.token, regular.user.id);
    await Message.create({ content: 'metric', conversationId: conversation.id, senderId: admin.user.id, status: 'delivered' });

    const blocked = await request(app).get('/api/admin/dashboard').set(auth(regular.token));
    const allowed = await request(app).get('/api/admin/dashboard').set(auth(admin.token));
    const metrics = await request(app).get('/api/admin/metrics').set(auth(admin.token));

    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.metrics.totalUsers).toBe(2);
    expect(metrics.text).toContain('chatterbox_users_total');
  });
});
