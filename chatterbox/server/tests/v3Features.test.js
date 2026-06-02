/**
 * Purpose: Verifies v3 privacy, group management, reports, locked chats, and encryption-demo behavior.
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
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Report = require('../src/models/Report');
const Room = require('../src/models/Room');
const User = require('../src/models/User');
const {
  cleanupExpiredMessages,
  startDisappearingMessageCleanup,
  stopDisappearingMessageCleanup
} = require('../src/services/disappearingMessageService');
const { initializeSocketServer } = require('../src/socket/socketManager');

let mongoServer;
let httpServer;
let socketServer;
let baseUrl;
const clients = [];

const registerUser = async (username, email) =>
  (await request(app).post('/api/auth/register').send({
    username,
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
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Report.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  await closeRedis();
});

describe('v3 privacy and group features', () => {
  test('enforces group admin authorization and member role changes', async () => {
    const owner = await registerUser('owner', 'owner@example.com');
    const member = await registerUser('member', 'member@example.com');
    const outsider = await registerUser('outsider', 'outsider@example.com');
    const roomResponse = await request(app)
      .post('/api/rooms')
      .set(auth(owner.token))
      .send({ members: [member.user.id], name: 'Core Team', type: 'private' });
    const roomId = roomResponse.body.data.room.id;

    const unauthorizedAdd = await request(app)
      .post(`/api/rooms/${roomId}/members`)
      .set(auth(member.token))
      .send({ userId: outsider.user.id });
    const promoteResponse = await request(app)
      .patch(`/api/rooms/${roomId}/admins/${member.user.id}`)
      .set(auth(owner.token))
      .send({ admin: true });
    const adminAddResponse = await request(app)
      .post(`/api/rooms/${roomId}/members`)
      .set(auth(member.token))
      .send({ userId: outsider.user.id });
    const demoteResponse = await request(app)
      .patch(`/api/rooms/${roomId}/admins/${member.user.id}`)
      .set(auth(owner.token))
      .send({ admin: false });
    const removeResponse = await request(app)
      .delete(`/api/rooms/${roomId}/members/${outsider.user.id}`)
      .set(auth(owner.token));

    expect(unauthorizedAdd.status).toBe(403);
    expect(promoteResponse.status).toBe(200);
    expect(adminAddResponse.status).toBe(200);
    expect(demoteResponse.status).toBe(200);
    expect(removeResponse.status).toBe(200);
    expect((await Room.findById(roomId)).members.map(String)).not.toContain(outsider.user.id);
  });

  test('supports invite links with join approval', async () => {
    const owner = await registerUser('owner', 'owner@example.com');
    const pending = await registerUser('pending', 'pending@example.com');
    const roomResponse = await request(app)
      .post('/api/rooms')
      .set(auth(owner.token))
      .send({ name: 'Private Group', type: 'private' });
    const roomId = roomResponse.body.data.room.id;

    await request(app)
      .patch(`/api/rooms/${roomId}`)
      .set(auth(owner.token))
      .send({ settings: { joinApprovalRequired: true } });
    const inviteResponse = await request(app)
      .post(`/api/rooms/${roomId}/invite`)
      .set(auth(owner.token));
    const joinResponse = await request(app)
      .post(`/api/rooms/join/${inviteResponse.body.data.inviteToken}`)
      .set(auth(pending.token));
    const approveResponse = await request(app)
      .post(`/api/rooms/${roomId}/join-requests/${pending.user.id}`)
      .set(auth(owner.token))
      .send({ approved: true });

    expect(inviteResponse.status).toBe(200);
    expect(joinResponse.status).toBe(202);
    expect(approveResponse.status).toBe(200);
    expect((await Room.findById(roomId)).members.map(String)).toContain(pending.user.id);
  });

  test('filters expired disappearing messages from history', async () => {
    const owner = await registerUser('owner', 'owner@example.com');
    const roomResponse = await request(app)
      .post('/api/rooms')
      .set(auth(owner.token))
      .send({ name: 'Expiry Room', type: 'public' });
    const roomId = roomResponse.body.data.room.id;
    await Message.create({
      content: 'expired',
      expiresAt: new Date(Date.now() - 1000),
      roomId,
      senderId: owner.user.id,
      status: 'delivered'
    });
    await Message.create({
      content: 'visible',
      roomId,
      senderId: owner.user.id,
      status: 'delivered'
    });

    const historyResponse = await request(app)
      .get(`/api/rooms/${roomId}/messages`)
      .set(auth(owner.token));

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.messages.map((message) => message.content)).toEqual(['visible']);
  });

  test('blocked users cannot send direct messages to the blocker', async () => {
    const blocker = await registerUser('blocker', 'blocker@example.com');
    const blocked = await registerUser('blocked', 'blocked@example.com');
    const conversation = await createDirectConversation(blocker.token, blocked.user.id);
    await request(app).post(`/api/users/${blocked.user.id}/block`).set(auth(blocker.token));
    const blockedSocket = await connectSocket(blocked.token);

    const response = await emitAck(blockedSocket, 'direct_message:send', {
      content: 'please read',
      conversationId: conversation.id
    });

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('AUTHORIZATION_ERROR');
  });

  test('stores local reports and protects moderation listing with admin flag', async () => {
    const reporter = await registerUser('reporter', 'reporter@example.com');
    const reported = await registerUser('reported', 'reported@example.com');
    const admin = await registerUser('admin', 'admin@example.com');
    await User.findByIdAndUpdate(admin.user.id, { isAdmin: true });

    const reportResponse = await request(app)
      .post('/api/reports')
      .set(auth(reporter.token))
      .send({ reason: 'spam', reportedUserId: reported.user.id, type: 'user' });
    const blockedList = await request(app).get('/api/reports').set(auth(reporter.token));
    const adminList = await request(app).get('/api/reports').set(auth(admin.token));

    expect(reportResponse.status).toBe(201);
    expect(blockedList.status).toBe(403);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.reports[0].reason).toBe('spam');
  });

  test('locked chats require password or PIN before history opens', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const conversation = await createDirectConversation(shriya.token, alex.user.id);
    await request(app).patch('/api/conversations/locked-pin').set(auth(shriya.token)).send({ pin: '1234' });
    await request(app)
      .patch(`/api/conversations/${conversation.id}/settings`)
      .set(auth(shriya.token))
      .send({ locked: true });

    const lockedHistory = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set(auth(shriya.token));
    const unlockResponse = await request(app)
      .post(`/api/conversations/${conversation.id}/unlock`)
      .set(auth(shriya.token))
      .send({ pin: '1234' });
    const unlockedHistory = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set(auth(shriya.token));

    expect(lockedHistory.status).toBe(403);
    expect(unlockResponse.status).toBe(200);
    expect(unlockedHistory.status).toBe(200);
  });

  test('encrypted direct message stores ciphertext and metadata', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const conversation = await createDirectConversation(sender.token, recipient.user.id);
    const senderSocket = await connectSocket(sender.token);

    const response = await emitAck(senderSocket, 'direct_message:send', {
      content: 'ciphertext-value',
      conversationId: conversation.id,
      encryptionMetadata: { algorithm: 'AES-GCM', iv: 'demo-iv' },
      isEncrypted: true
    });
    const message = await Message.findById(response.data.message.id);

    expect(response.success).toBe(true);
    expect(message.content).toBe('ciphertext-value');
    expect(message.isEncrypted).toBe(true);
    expect(message.encryptionMetadata.algorithm).toBe('AES-GCM');
  });

  test('updates privacy settings and filters blocked users from search', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');

    const privacyResponse = await request(app)
      .patch('/api/users/me/privacy')
      .set(auth(shriya.token))
      .send({
        aboutVisibility: 'nobody',
        lastSeenVisibility: 'contacts',
        onlineVisibility: 'nobody',
        profilePhotoVisibility: 'contacts',
        readReceipts: false
      });
    const invalidPrivacyResponse = await request(app)
      .patch('/api/users/me/privacy')
      .set(auth(shriya.token))
      .send({ onlineVisibility: 'friends-only' });
    const blockResponse = await request(app).post(`/api/users/${alex.user.id}/block`).set(auth(shriya.token));
    const searchResponse = await request(app).get('/api/users?search=alex').set(auth(shriya.token));
    const unblockResponse = await request(app).delete(`/api/users/${alex.user.id}/block`).set(auth(shriya.token));
    const searchAfterUnblock = await request(app).get('/api/users?search=alex').set(auth(shriya.token));

    expect(privacyResponse.status).toBe(200);
    expect(privacyResponse.body.data.user.privacySettings.readReceipts).toBe(false);
    expect(invalidPrivacyResponse.status).toBe(400);
    expect(blockResponse.status).toBe(200);
    expect(searchResponse.body.data.users).toHaveLength(0);
    expect(unblockResponse.status).toBe(200);
    expect(searchAfterUnblock.body.data.users[0].username).toBe('alex');
  });

  test('rejects self-block and missing block targets', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const missingId = new mongoose.Types.ObjectId().toString();

    const selfBlock = await request(app).post(`/api/users/${shriya.user.id}/block`).set(auth(shriya.token));
    const missingBlock = await request(app).post(`/api/users/${missingId}/block`).set(auth(shriya.token));

    expect(selfBlock.status).toBe(403);
    expect(missingBlock.status).toBe(404);
  });

  test('reports messages only when the reporter can access the message', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const outsider = await registerUser('outsider', 'outsider@example.com');
    const conversation = await createDirectConversation(sender.token, recipient.user.id);
    const message = await Message.create({
      content: 'reportable',
      conversationId: conversation.id,
      senderId: sender.user.id,
      status: 'delivered'
    });

    const messageReport = await request(app)
      .post('/api/reports')
      .set(auth(recipient.token))
      .send({ messageId: message.id, reason: 'abuse', type: 'message' });
    const outsiderReport = await request(app)
      .post('/api/reports')
      .set(auth(outsider.token))
      .send({ messageId: message.id, reason: 'cannot access', type: 'message' });
    const invalidType = await request(app)
      .post('/api/reports')
      .set(auth(sender.token))
      .send({ reason: 'bad type', type: 'other' });

    expect(messageReport.status).toBe(201);
    expect(messageReport.body.data.report.messageId).toBe(message.id);
    expect(outsiderReport.status).toBe(403);
    expect(invalidType.status).toBe(400);
  });

  test('cleanup worker soft-deletes expired messages and emits expiry events', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const conversation = await createDirectConversation(shriya.token, alex.user.id);
    const expired = await Message.create({
      content: 'vanish',
      conversationId: conversation.id,
      expiresAt: new Date(Date.now() - 1000),
      senderId: shriya.user.id,
      status: 'delivered'
    });
    await Message.create({
      content: 'stay',
      conversationId: conversation.id,
      expiresAt: new Date(Date.now() + 60000),
      senderId: shriya.user.id,
      status: 'delivered'
    });
    const io = { emit: jest.fn() };

    const expiredIds = await cleanupExpiredMessages(io);
    const updated = await Message.findById(expired.id);
    const emptyRun = await cleanupExpiredMessages(io);
    const timer = startDisappearingMessageCleanup(io, 1000);
    const sameTimer = startDisappearingMessageCleanup(io, 1000);
    stopDisappearingMessageCleanup();

    expect(expiredIds).toEqual([expired.id]);
    expect(updated.isDeleted).toBe(true);
    expect(updated.content).toBe('This message expired');
    expect(io.emit).toHaveBeenCalledWith('message:expired', expect.objectContaining({
      conversationId: conversation.id,
      messageId: expired.id,
      roomId: null
    }));
    expect(emptyRun).toEqual([]);
    expect(sameTimer).toBe(timer);
  });

  test('handles v3 group management socket events', async () => {
    const owner = await registerUser('owner', 'owner@example.com');
    const member = await registerUser('member', 'member@example.com');
    const outsider = await registerUser('outsider', 'outsider@example.com');
    const pending = await registerUser('pending', 'pending@example.com');
    const roomResponse = await request(app)
      .post('/api/rooms')
      .set(auth(owner.token))
      .send({ members: [member.user.id], name: 'Socket Group', type: 'private' });
    const roomId = roomResponse.body.data.room.id;
    await Room.findByIdAndUpdate(roomId, {
      $push: {
        joinRequests: {
          requestedAt: new Date(),
          status: 'pending',
          userId: pending.user.id
        }
      }
    });
    const ownerSocket = await connectSocket(owner.token);
    const memberSocket = await connectSocket(member.token);

    const unauthorizedUpdate = await emitAck(memberSocket, 'group:update', {
      name: 'Nope',
      roomId
    });
    const updateResponse = await emitAck(ownerSocket, 'group:update', {
      description: 'Managed over socket',
      name: 'Socket Core',
      roomId,
      settings: { disappearingMode: '90d', whoCanSendMessages: 'admins' }
    });
    const addResponse = await emitAck(ownerSocket, 'group:member:add', {
      roomId,
      userId: outsider.user.id
    });
    const promoteResponse = await emitAck(ownerSocket, 'group:admin:update', {
      admin: true,
      roomId,
      userId: member.user.id
    });
    const removeResponse = await emitAck(ownerSocket, 'group:member:remove', {
      roomId,
      userId: outsider.user.id
    });
    const resolveResponse = await emitAck(ownerSocket, 'group:join_request:resolved', {
      approved: true,
      roomId,
      userId: pending.user.id
    });
    const room = await Room.findById(roomId);

    expect(unauthorizedUpdate.success).toBe(false);
    expect(updateResponse.success).toBe(true);
    expect(updateResponse.data.room.name).toBe('Socket Core');
    expect(addResponse.success).toBe(true);
    expect(promoteResponse.success).toBe(true);
    expect(removeResponse.data.removedUserId).toBe(outsider.user.id);
    expect(resolveResponse.data.approved).toBe(true);
    expect(room.admins.map(String)).toContain(member.user.id);
    expect(room.members.map(String)).toContain(pending.user.id);
    expect(room.members.map(String)).not.toContain(outsider.user.id);
  });
});
