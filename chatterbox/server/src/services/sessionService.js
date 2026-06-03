/**
 * Purpose: Creates, tracks, and revokes local browser sessions.
 */

const crypto = require('crypto');

const Session = require('../models/Session');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getExpiryDateFromPayload = (payload) => {
  if (!payload?.exp) {
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  return new Date(payload.exp * 1000);
};

const buildSessionMetadata = (req) => ({
  ipAddress: req.ip || req.socket?.remoteAddress || '',
  userAgent: String(req.get?.('user-agent') || '').slice(0, 300)
});

const createSessionRecord = async ({ decodedToken, req, token, userId }) => {
  if (!decodedToken.sid) {
    return null;
  }

  return Session.create({
    ...buildSessionMetadata(req),
    expiresAt: getExpiryDateFromPayload(decodedToken),
    sessionId: decodedToken.sid,
    tokenHash: hashToken(token),
    userId
  });
};

const touchSession = async (decodedToken) => {
  if (!decodedToken?.sid) {
    return null;
  }

  return Session.findOneAndUpdate(
    {
      expiresAt: { $gt: new Date() },
      revokedAt: null,
      sessionId: decodedToken.sid
    },
    { lastSeenAt: new Date() },
    { new: true }
  );
};

const revokeSession = async (sessionId, userId) =>
  Session.findOneAndUpdate(
    { sessionId, userId, revokedAt: null },
    { revokedAt: new Date() },
    { new: true }
  );

const revokeAllSessions = async (userId, exceptSessionId = null) => {
  const query = { userId, revokedAt: null };

  if (exceptSessionId) {
    query.sessionId = { $ne: exceptSessionId };
  }

  return Session.updateMany(query, { revokedAt: new Date() });
};

module.exports = {
  buildSessionMetadata,
  createSessionRecord,
  getExpiryDateFromPayload,
  hashToken,
  revokeAllSessions,
  revokeSession,
  touchSession
};
