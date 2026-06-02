/**
 * Purpose: Stores local user/message reports and exposes admin moderation review.
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Report = require('../models/Report');
const User = require('../models/User');
const { forbiddenError, notFoundError, validationError } = require('../utils/errors');

const createReport = async (req, res, next) => {
  try {
    const { messageId, reason = '', reportedUserId, type = messageId ? 'message' : 'user' } = req.body;
    const report = {
      reason: String(reason).trim().slice(0, 500),
      reporterId: req.user._id,
      type
    };

    if (type === 'user') {
      const user = await User.findById(reportedUserId);
      if (!user) {
        return next(notFoundError('Reported user not found.'));
      }
      report.reportedUserId = user._id;
    } else if (type === 'message') {
      const message = await Message.findById(messageId);
      if (!message) {
        return next(notFoundError('Reported message not found.'));
      }

      if (message.conversationId) {
        const conversation = await Conversation.findById(message.conversationId);
        if (!conversation.participants.some((participantId) => participantId.toString() === req.user.id)) {
          return next(forbiddenError('You cannot report a message you cannot access.'));
        }
        report.conversationId = conversation._id;
      }

      report.messageId = message._id;
      report.roomId = message.roomId || null;
      report.reportedUserId = message.senderId;
    } else {
      return next(validationError('Report type must be user or message.'));
    }

    const createdReport = await Report.create(report);
    return res.status(201).json({ success: true, data: { report: createdReport.toJSON() } });
  } catch (error) {
    return next(error);
  }
};

const listReports = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return next(forbiddenError('Only admins can view moderation reports.'));
    }

    const reports = await Report.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('reporterId', 'username email')
      .populate('reportedUserId', 'username email');

    return res.status(200).json({
      success: true,
      data: {
        reports: reports.map((report) => report.toJSON())
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createReport,
  listReports
};
