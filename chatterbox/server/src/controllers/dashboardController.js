/**
 * Purpose: Provides local admin observability metrics.
 */

const mongoose = require('mongoose');

const redis = require('../config/redis');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Report = require('../models/Report');
const User = require('../models/User');
const { forbiddenError } = require('../utils/errors');

const assertAdmin = (req) => {
  if (!req.user.isAdmin) {
    throw forbiddenError('Only admins can view dashboard metrics.');
  }
};

const getDashboardMetrics = async (req, res, next) => {
  try {
    assertAdmin(req);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      activeUsers,
      totalMessages,
      activeConversations,
      reportedMessages,
      messagesPerDay
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ lastSeen: { $gte: since24h } }),
      Message.countDocuments({}),
      Conversation.countDocuments({ lastMessageAt: { $ne: null } }),
      Report.countDocuments({ status: 'open' }),
      Message.aggregate([
        {
          $group: {
            _id: {
              $dateToString: { date: '$createdAt', format: '%Y-%m-%d' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 14 }
      ])
    ]);
    const redisClient = redis.getRedisClient();

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          activeConversations,
          activeUsers,
          messagesPerDay: messagesPerDay.map((row) => ({ count: row.count, day: row._id })),
          reportedMessages,
          systemHealth: {
            mongodb: mongoose.connection.readyState === 1 ? 'ready' : 'not_ready',
            redis: redisClient.status || 'not_ready',
            uptimeSeconds: Math.floor(process.uptime())
          },
          totalMessages,
          totalUsers
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getPrometheusMetrics = async (req, res, next) => {
  try {
    assertAdmin(req);
    const totalUsers = await User.countDocuments({});
    const totalMessages = await Message.countDocuments({});
    const openReports = await Report.countDocuments({ status: 'open' });

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    return res.status(200).send([
      '# HELP chatterbox_users_total Total registered users.',
      '# TYPE chatterbox_users_total gauge',
      `chatterbox_users_total ${totalUsers}`,
      '# HELP chatterbox_messages_total Total persisted messages.',
      '# TYPE chatterbox_messages_total gauge',
      `chatterbox_messages_total ${totalMessages}`,
      '# HELP chatterbox_reports_open Open local moderation reports.',
      '# TYPE chatterbox_reports_open gauge',
      `chatterbox_reports_open ${openReports}`
    ].join('\n'));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboardMetrics,
  getPrometheusMetrics
};
