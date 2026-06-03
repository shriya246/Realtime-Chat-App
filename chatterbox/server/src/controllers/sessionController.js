/**
 * Purpose: Lists and revokes browser sessions for v4 multi-device foundation.
 */

const Session = require('../models/Session');
const redisService = require('../services/redisService');
const { getTokenTtlSeconds } = require('../utils/jwt');
const { revokeAllSessions, revokeSession } = require('../services/sessionService');

const listSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({
      expiresAt: { $gt: new Date() },
      revokedAt: null,
      userId: req.user._id
    }).sort({ lastSeenAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        currentSessionId: req.tokenPayload.sid || null,
        sessions: sessions.map((session) => session.toJSON())
      }
    });
  } catch (error) {
    return next(error);
  }
};

const logoutSession = async (req, res, next) => {
  try {
    const session = await revokeSession(req.params.id, req.user._id);

    return res.status(200).json({
      success: true,
      data: {
        revoked: Boolean(session),
        sessionId: req.params.id
      }
    });
  } catch (error) {
    return next(error);
  }
};

const logoutAllSessions = async (req, res, next) => {
  try {
    const keepCurrent = req.body.keepCurrent !== false;
    const result = await revokeAllSessions(req.user._id, keepCurrent ? req.tokenPayload.sid : null);

    if (!keepCurrent) {
      await redisService.blacklistToken(req.token, getTokenTtlSeconds(req.tokenPayload));
    }

    return res.status(200).json({
      success: true,
      data: {
        revokedCount: result.modifiedCount || 0
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listSessions,
  logoutAllSessions,
  logoutSession
};
