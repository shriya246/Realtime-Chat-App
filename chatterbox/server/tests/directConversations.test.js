/**
 * Purpose: Verifies v2 direct conversations, direct-message sockets, receipts, reactions, edits, and deletes.
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
const Attachment = require('../src/models/Attachment');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Room = require('../src/models/Room');
const User = require('../src/models/User');
const { initializeSocketServer } = require('../src/socket/socketManager');

let mongoServer;
let httpServer;
let socketServer;
let baseUrl;
const clients = [];

const registerUser = async (username, email) => {
  const response = await request(app).post('/api/auth/register').send({
    username,
    email,
    password: 'StrongPassword123!'
  });

  return response.body.data;
};

const createDirectConversation = async (token, targetUserId) => {
  const response = await request(app)
    .post('/api/conversations/direct')
    .set('Authorization', `Bearer ${token}`)
    .send({ targetUserId });

  return response;
};

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

const emitWithAcknowledgement = async (client, eventName, payload) =>
  new Promise((resolve) => {
    client.emit(eventName, payload, resolve);
  });

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

  await Conversation.deleteMany({});
  await Attachment.deleteMany({});
  await Message.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  await closeRedis();
});

describe('Direct conversations API and socket events', () => {
  test('creates a direct conversation and returns the existing one for the same user pair', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');

    const firstResponse = await createDirectConversation(shriya.token, alex.user.id);
    const secondResponse = await createDirectConversation(shriya.token, alex.user.id);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.data.conversation.id).toBe(firstResponse.body.data.conversation.id);
    expect(await Conversation.countDocuments()).toBe(1);
    expect(firstResponse.body.data.conversation.participant).toMatchObject({
      id: alex.user.id,
      username: 'alex',
      isOnline: false
    });
  });

  test('lists conversations with participant info, last message preview, and unread counts', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const conversationResponse = await createDirectConversation(shriya.token, alex.user.id);
    const conversationId = conversationResponse.body.data.conversation.id;
    const message = await Message.create({
      conversationId,
      senderId: alex.user.id,
      content: 'Unread hello',
      status: 'delivered',
      deliveredTo: [{ userId: shriya.user.id }]
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageId: message._id,
      lastMessagePreview: message.content,
      lastMessageAt: message.timestamp
    });

    const response = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${shriya.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.conversations).toHaveLength(1);
    expect(response.body.data.conversations[0]).toMatchObject({
      id: conversationId,
      lastMessagePreview: 'Unread hello',
      unreadCount: 1,
      participant: {
        username: 'alex'
      }
    });
  });

  test('sends a direct message in real time and exposes unread history', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const conversationResponse = await createDirectConversation(sender.token, recipient.user.id);
    const conversationId = conversationResponse.body.data.conversation.id;
    const senderSocket = await connectSocket(sender.token);
    const recipientSocket = await connectSocket(recipient.token);
    const incomingPromise = waitForEvent(recipientSocket, 'direct_message:new');

    const acknowledgement = await emitWithAcknowledgement(senderSocket, 'direct_message:send', {
      conversationId,
      content: 'Direct hello',
      clientMessageId: 'client-direct-1'
    });
    const incomingMessage = await incomingPromise;

    expect(acknowledgement.success).toBe(true);
    expect(acknowledgement.data.message).toMatchObject({
      clientMessageId: 'client-direct-1',
      content: 'Direct hello',
      status: 'delivered'
    });
    expect(incomingMessage).toMatchObject({
      conversationId,
      content: 'Direct hello',
      status: 'delivered'
    });
    expect(await Message.countDocuments({ conversationId })).toBe(1);

    const historyResponse = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${recipient.token}`);
    const listResponse = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${recipient.token}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.messages[0].content).toBe('Direct hello');
    expect(listResponse.body.data.conversations[0].unreadCount).toBe(1);
  });

  test('marks direct messages as read and clears unread counts', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const conversationResponse = await createDirectConversation(sender.token, recipient.user.id);
    const conversationId = conversationResponse.body.data.conversation.id;

    await Message.create({
      conversationId,
      senderId: sender.user.id,
      content: 'Read me',
      status: 'delivered',
      deliveredTo: [{ userId: recipient.user.id }]
    });

    const readResponse = await request(app)
      .post(`/api/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${recipient.token}`);
    const listResponse = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${recipient.token}`);
    const savedMessage = await Message.findOne({ conversationId });

    expect(readResponse.status).toBe(200);
    expect(readResponse.body.data.messageIds).toHaveLength(1);
    expect(listResponse.body.data.conversations[0].unreadCount).toBe(0);
    expect(savedMessage.status).toBe('read');
    expect(savedMessage.readBy[0].userId.toString()).toBe(recipient.user.id);
  });

  test('adds, changes, and removes one reaction per user', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const conversationResponse = await createDirectConversation(sender.token, recipient.user.id);
    const conversationId = conversationResponse.body.data.conversation.id;
    const message = await Message.create({
      conversationId,
      senderId: sender.user.id,
      content: 'React here',
      status: 'delivered'
    });
    const recipientSocket = await connectSocket(recipient.token);

    const addResponse = await emitWithAcknowledgement(recipientSocket, 'message:reaction:update', {
      messageId: message.id,
      emoji: '👍'
    });
    const changeResponse = await emitWithAcknowledgement(recipientSocket, 'message:reaction:update', {
      messageId: message.id,
      emoji: '❤️'
    });
    const removeResponse = await emitWithAcknowledgement(recipientSocket, 'message:reaction:update', {
      messageId: message.id,
      emoji: null
    });

    expect(addResponse.success).toBe(true);
    expect(addResponse.data.message.reactions[0]).toMatchObject({ emoji: '👍', count: 1 });
    expect(changeResponse.data.message.reactions[0]).toMatchObject({ emoji: '❤️', count: 1 });
    expect(removeResponse.data.message.reactions).toEqual([]);
    expect((await Message.findById(message.id)).reactions).toHaveLength(0);
  });

  test('enforces sender-only edit and delete authorization', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const conversationResponse = await createDirectConversation(sender.token, recipient.user.id);
    const conversationId = conversationResponse.body.data.conversation.id;
    const message = await Message.create({
      conversationId,
      senderId: sender.user.id,
      content: 'Original',
      status: 'delivered'
    });
    const senderSocket = await connectSocket(sender.token);
    const recipientSocket = await connectSocket(recipient.token);

    const unauthorizedEdit = await emitWithAcknowledgement(recipientSocket, 'message:edit', {
      messageId: message.id,
      content: 'Not allowed'
    });
    const editResponse = await emitWithAcknowledgement(senderSocket, 'message:edit', {
      messageId: message.id,
      content: 'Edited'
    });
    const unauthorizedDelete = await emitWithAcknowledgement(recipientSocket, 'message:delete', {
      messageId: message.id
    });
    const deleteResponse = await emitWithAcknowledgement(senderSocket, 'message:delete', {
      messageId: message.id
    });

    expect(unauthorizedEdit.success).toBe(false);
    expect(unauthorizedEdit.error.code).toBe('AUTHORIZATION_ERROR');
    expect(editResponse.success).toBe(true);
    expect(editResponse.data.message).toMatchObject({ content: 'Edited' });
    expect(editResponse.data.message.editedAt).toEqual(expect.any(String));
    expect(unauthorizedDelete.success).toBe(false);
    expect(deleteResponse.success).toBe(true);
    expect(deleteResponse.data.message).toMatchObject({
      content: 'This message was deleted',
      isDeleted: true
    });
  });

  test('sends a media direct message and rejects editing that media message', async () => {
    const sender = await registerUser('sender', 'sender@example.com');
    const recipient = await registerUser('recipient', 'recipient@example.com');
    const conversationResponse = await createDirectConversation(sender.token, recipient.user.id);
    const conversationId = conversationResponse.body.data.conversation.id;
    const attachment = await Attachment.create({
      conversationId,
      kind: 'image',
      mimeType: 'image/png',
      originalFilename: 'photo.png',
      ownerId: sender.user.id,
      purpose: 'message',
      relativePath: 'message/photo.png',
      size: 12,
      storedFilename: 'photo.png'
    });
    const senderSocket = await connectSocket(sender.token);
    const recipientSocket = await connectSocket(recipient.token);
    const mediaPromise = waitForEvent(recipientSocket, 'media_message:new');

    const acknowledgement = await emitWithAcknowledgement(senderSocket, 'direct_message:send', {
      attachmentId: attachment.id,
      clientMessageId: 'client-media-1',
      content: '',
      conversationId
    });
    const mediaMessage = await mediaPromise;
    const editResponse = await emitWithAcknowledgement(senderSocket, 'message:edit', {
      content: 'Cannot edit media',
      messageId: acknowledgement.data.message.id
    });

    expect(acknowledgement.success).toBe(true);
    expect(acknowledgement.data.message).toMatchObject({
      clientMessageId: 'client-media-1',
      content: 'photo.png',
      type: 'image'
    });
    expect(acknowledgement.data.message.attachments[0]).toMatchObject({
      id: attachment.id,
      originalFilename: 'photo.png'
    });
    expect(mediaMessage).toMatchObject({
      conversationId,
      content: 'photo.png',
      type: 'image'
    });
    expect(editResponse.success).toBe(false);
    expect(editResponse.error.code).toBe('VALIDATION_ERROR');
  });

  test('updates conversation settings through the socket event', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const conversationResponse = await createDirectConversation(shriya.token, alex.user.id);
    const conversationId = conversationResponse.body.data.conversation.id;
    const socket = await connectSocket(shriya.token);

    const emptyResponse = await emitWithAcknowledgement(socket, 'conversation:settings:update', {
      conversationId
    });
    const updatePromise = waitForEvent(socket, 'conversation:settings:update');
    const acknowledgement = await emitWithAcknowledgement(socket, 'conversation:settings:update', {
      archived: true,
      conversationId,
      muted: true,
      pinned: true
    });
    const updateEvent = await updatePromise;

    expect(emptyResponse.success).toBe(false);
    expect(emptyResponse.error.code).toBe('VALIDATION_ERROR');
    expect(acknowledgement.success).toBe(true);
    expect(acknowledgement.data.conversation.settings).toMatchObject({
      archived: true,
      muted: true,
      pinned: true
    });
    expect(updateEvent.conversation.settings).toMatchObject({
      archived: true,
      muted: true,
      pinned: true
    });
  });

  test('updates profile fields and avatar through the socket event', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');
    const avatar = await Attachment.create({
      kind: 'avatar',
      mimeType: 'image/png',
      originalFilename: 'avatar.png',
      ownerId: auth.user.id,
      purpose: 'avatar',
      relativePath: 'avatar/avatar.png',
      size: 20,
      storedFilename: 'avatar.png'
    });
    const socket = await connectSocket(auth.token);
    const updatePromise = waitForEvent(socket, 'profile:update');

    const acknowledgement = await emitWithAcknowledgement(socket, 'profile:update', {
      about: 'Socket profile update',
      avatarAttachmentId: avatar.id,
      displayName: 'Shriya Socket'
    });
    const updateEvent = await updatePromise;

    expect(acknowledgement.success).toBe(true);
    expect(acknowledgement.data.user).toMatchObject({
      about: 'Socket profile update',
      avatarUrl: `/api/attachments/${avatar.id}/content`,
      displayName: 'Shriya Socket'
    });
    expect(updateEvent.user.displayName).toBe('Shriya Socket');
    expect((await User.findById(auth.user.id)).avatarAttachmentId.toString()).toBe(avatar.id);
  });
});
