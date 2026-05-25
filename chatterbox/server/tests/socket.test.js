/**
 * Purpose: Verifies authenticated Socket.io room, messaging, caching, and typing behavior end to end.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-chatterbox-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.MESSAGE_HISTORY_LIMIT = '50';

jest.mock('../src/services/azureServiceBusService', () => ({
  closeServiceBus: jest.fn().mockResolvedValue(undefined),
  receiveMessages: jest.fn().mockResolvedValue(null),
  sendMessage: jest.fn().mockResolvedValue({ published: true })
}));

const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { io: createClient } = require('socket.io-client');

const app = require('../src/app');
const { closeRedis } = require('../src/config/redis');
const Message = require('../src/models/Message');
const Room = require('../src/models/Room');
const User = require('../src/models/User');
const redisService = require('../src/services/redisService');
const azureServiceBusService = require('../src/services/azureServiceBusService');
const { initializeSocketServer } = require('../src/socket/socketManager');

let mongoServer;
let httpServer;
let socketServer;
let baseUrl;
const clients = [];

/**
 * Registers an authenticated test user.
 *
 * @param {string} username - Unique username.
 * @param {string} email - Unique email.
 * @returns {Promise<object>} Auth response payload.
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
 * Creates a room through the protected REST interface.
 *
 * @param {string} token - Creator JWT.
 * @param {object} payload - Room creation payload.
 * @returns {Promise<object>} Created room.
 */
const createRoom = async (token, payload = { name: 'General', type: 'public' }) => {
  const response = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);

  return response.body.data.room;
};

/**
 * Creates and connects a Socket.io client using the provided token.
 *
 * @param {string} token - Handshake JWT.
 * @returns {Promise<object>} Connected client socket.
 */
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

/**
 * Emits an event and resolves its acknowledgement payload.
 *
 * @param {object} client - Socket.io client.
 * @param {string} eventName - Event name.
 * @param {object} payload - Event payload.
 * @returns {Promise<object>} Event acknowledgement.
 */
const emitWithAcknowledgement = async (client, eventName, payload) =>
  new Promise((resolve) => {
    client.emit(eventName, payload, resolve);
  });

/**
 * Resolves with the next payload for a socket event.
 *
 * @param {object} client - Socket.io client.
 * @param {string} eventName - Event to wait for.
 * @returns {Promise<object>} Received payload.
 */
const waitForEvent = async (client, eventName) =>
  new Promise((resolve) => {
    client.once(eventName, resolve);
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  httpServer = http.createServer(app);
  socketServer = initializeSocketServer(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = httpServer.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  clients.forEach((client) => client.disconnect());

  await new Promise((resolve) => {
    socketServer.close(resolve);
  });

  await mongoose.disconnect();
  await mongoServer.stop();
  await closeRedis();
});

beforeEach(async () => {
  while (clients.length > 0) {
    clients.pop().disconnect();
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  await Message.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  await closeRedis();
  jest.clearAllMocks();
});

describe('Socket.io real-time engine', () => {
  test('connects with a valid token and records user presence', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');

    await connectSocket(auth.token);

    const onlineUsers = await redisService.getOnlineUsers();
    expect(onlineUsers).toEqual([
      expect.objectContaining({
        userId: auth.user.id,
        username: 'shriya'
      })
    ]);
  });

  test('rejects a socket connection with an invalid token', async () => {
    const client = createClient(baseUrl, {
      auth: { token: 'invalid-token' },
      forceNew: true,
      reconnection: false,
      transports: ['websocket']
    });
    clients.push(client);

    const error = await new Promise((resolve) => {
      client.once('connect_error', resolve);
    });

    expect(error.message).toBe('Authentication token is invalid.');
  });

  test('joins a room and returns MongoDB history before caching it', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');
    const room = await createRoom(auth.token);
    await Message.create({
      roomId: room.id,
      senderId: auth.user.id,
      content: 'Existing history',
      status: 'delivered'
    });
    const client = await connectSocket(auth.token);

    const acknowledgement = await emitWithAcknowledgement(client, 'join_room', { roomId: room.id });

    expect(acknowledgement.success).toBe(true);
    expect(acknowledgement.data.source).toBe('database');
    expect(acknowledgement.data.messages[0].content).toBe('Existing history');

    const cachedMessages = await redisService.getCachedMessages(room.id);
    expect(cachedMessages[0].content).toBe('Existing history');
  });

  test('persists, caches, broadcasts, and queues a room message', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const room = await createRoom(sender.token);
    const senderSocket = await connectSocket(sender.token);
    const recipientSocket = await connectSocket(recipient.token);

    await emitWithAcknowledgement(senderSocket, 'join_room', { roomId: room.id });
    await emitWithAcknowledgement(recipientSocket, 'join_room', { roomId: room.id });

    const receivedMessagePromise = waitForEvent(recipientSocket, 'receive_message');
    const acknowledgement = await emitWithAcknowledgement(senderSocket, 'send_message', {
      roomId: room.id,
      content: 'Realtime hello',
      clientMessageId: 'client-1'
    });
    const receivedMessage = await receivedMessagePromise;

    expect(acknowledgement.success).toBe(true);
    expect(acknowledgement.data.queued).toBe(true);
    expect(receivedMessage).toMatchObject({
      content: 'Realtime hello',
      clientMessageId: 'client-1',
      status: 'delivered'
    });
    expect(await Message.countDocuments({ roomId: room.id })).toBe(1);
    expect((await redisService.getCachedMessages(room.id))[0].content).toBe('Realtime hello');
    expect(azureServiceBusService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Realtime hello' })
    );
  });

  test('broadcasts a typing indicator only to other room clients', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const room = await createRoom(sender.token);
    const senderSocket = await connectSocket(sender.token);
    const recipientSocket = await connectSocket(recipient.token);

    await emitWithAcknowledgement(senderSocket, 'join_room', { roomId: room.id });
    await emitWithAcknowledgement(recipientSocket, 'join_room', { roomId: room.id });

    const indicatorPromise = waitForEvent(recipientSocket, 'typing_indicator');
    const acknowledgement = await emitWithAcknowledgement(senderSocket, 'user_typing', {
      roomId: room.id,
      isTyping: true
    });
    const indicator = await indicatorPromise;

    expect(acknowledgement.success).toBe(true);
    expect(indicator).toMatchObject({
      roomId: room.id,
      username: 'sender',
      isTyping: true
    });
  });
});
