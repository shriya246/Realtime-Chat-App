/**
 * Purpose: Verifies v2.5 local media uploads, profile updates, chat settings, and message search.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-chatterbox-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.EVENT_PUBLISHER = 'noop';
process.env.UPLOAD_DIR = 'test-uploads';

const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../src/app');
const { closeRedis } = require('../src/config/redis');
const Attachment = require('../src/models/Attachment');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Room = require('../src/models/Room');
const User = require('../src/models/User');

let mongoServer;

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

  return response.body.data.conversation;
};

const uploadAttachment = async (token, conversationId, overrides = {}) =>
  request(app)
    .post(`/api/attachments?conversationId=${conversationId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', overrides.mimeType || 'text/plain')
    .set('X-File-Name', encodeURIComponent(overrides.filename || 'note.txt'))
    .send(Buffer.from(overrides.content || 'safe file'));

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await closeRedis();
  await fs.rm(path.resolve(process.cwd(), process.env.UPLOAD_DIR), { force: true, recursive: true });
});

beforeEach(async () => {
  await Attachment.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Room.deleteMany({});
  await User.deleteMany({});
  await closeRedis();
  await fs.rm(path.resolve(process.cwd(), process.env.UPLOAD_DIR), { force: true, recursive: true });
});

describe('Media, profile, settings, and search APIs', () => {
  test('uploads an allowed local attachment and serves it to conversation participants', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const conversation = await createDirectConversation(shriya.token, alex.user.id);

    const uploadResponse = await uploadAttachment(shriya.token, conversation.id);
    const attachmentId = uploadResponse.body.data.attachment.id;
    const downloadResponse = await request(app)
      .get(`/api/attachments/${attachmentId}/content`)
      .set('Authorization', `Bearer ${alex.token}`);

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.data.attachment).toMatchObject({
      kind: 'file',
      mimeType: 'text/plain',
      originalFilename: 'note.txt',
      size: 9
    });
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.text).toBe('safe file');
  });

  test('rejects dangerous uploads and blocks attachment access for non-participants', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const visitor = await registerUser('visitor', 'visitor@example.com');
    const conversation = await createDirectConversation(shriya.token, alex.user.id);

    const rejectedResponse = await uploadAttachment(shriya.token, conversation.id, {
      content: 'bad',
      filename: 'run.exe',
      mimeType: 'application/x-msdownload'
    });
    const uploadResponse = await uploadAttachment(shriya.token, conversation.id);
    const blockedResponse = await request(app)
      .get(`/api/attachments/${uploadResponse.body.data.attachment.id}/content`)
      .set('Authorization', `Bearer ${visitor.token}`);

    expect(rejectedResponse.status).toBe(400);
    expect(rejectedResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(blockedResponse.status).toBe(403);
  });

  test('updates profile fields and avatar from local image upload', async () => {
    const auth = await registerUser('shriya', 'shriya@example.com');
    const avatarUpload = await request(app)
      .post('/api/attachments?purpose=avatar')
      .set('Authorization', `Bearer ${auth.token}`)
      .set('Content-Type', 'image/png')
      .set('X-File-Name', encodeURIComponent('avatar.png'))
      .send(Buffer.from('png-bytes'));

    const profileResponse = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        about: 'Building calm real-time tools.',
        avatarAttachmentId: avatarUpload.body.data.attachment.id,
        displayName: 'Shriya Patel'
      });

    expect(avatarUpload.status).toBe(201);
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user).toMatchObject({
      about: 'Building calm real-time tools.',
      avatarUrl: `/api/attachments/${avatarUpload.body.data.attachment.id}/content`,
      displayName: 'Shriya Patel'
    });
  });

  test('updates pinned archived and muted settings for the current user', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const conversation = await createDirectConversation(shriya.token, alex.user.id);

    const response = await request(app)
      .patch(`/api/conversations/${conversation.id}/settings`)
      .set('Authorization', `Bearer ${shriya.token}`)
      .send({ archived: true, muted: true, pinned: true });

    expect(response.status).toBe(200);
    expect(response.body.data.conversation.settings).toMatchObject({
      archived: true,
      muted: true,
      pinned: true
    });
  });

  test('searches messages only inside authorized conversations', async () => {
    const shriya = await registerUser('shriya', 'shriya@example.com');
    const alex = await registerUser('alex', 'alex@example.com');
    const visitor = await registerUser('visitor', 'visitor@example.com');
    const conversation = await createDirectConversation(shriya.token, alex.user.id);

    await Message.create({
      conversationId: conversation.id,
      content: 'Needle in the haystack',
      senderId: shriya.user.id,
      status: 'delivered'
    });

    const searchResponse = await request(app)
      .get(`/api/conversations/${conversation.id}/search?q=needle`)
      .set('Authorization', `Bearer ${alex.token}`);
    const blockedResponse = await request(app)
      .get(`/api/conversations/${conversation.id}/search?q=needle`)
      .set('Authorization', `Bearer ${visitor.token}`);

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.data.results[0].content).toBe('Needle in the haystack');
    expect(blockedResponse.status).toBe(403);
  });
});
