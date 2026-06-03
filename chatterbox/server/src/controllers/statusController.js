/**
 * Purpose: Implements 24-hour status/story APIs.
 */

const Attachment = require('../models/Attachment');
const Status = require('../models/Status');
const { notFoundError, validationError } = require('../utils/errors');

const formatStatus = (status) => {
  const payload = status.toJSON();
  payload.owner = status.ownerId && typeof status.ownerId === 'object'
    ? {
        avatarUrl: status.ownerId.avatarAttachmentId ? `/api/attachments/${status.ownerId.avatarAttachmentId.toString()}/content` : null,
        displayName: status.ownerId.displayName || '',
        id: status.ownerId._id.toString(),
        username: status.ownerId.username
      }
    : { id: status.ownerId?.toString?.() || status.ownerId };
  payload.attachments = (status.attachments || []).map((attachment) => (
    attachment?.toJSON ? attachment.toJSON() : attachment
  ));
  return payload;
};

const getActiveStatuses = async (_req, res, next) => {
  try {
    const statuses = await Status.find({
      expiresAt: { $gt: new Date() },
      privacy: { $ne: 'nobody' }
    })
      .sort({ createdAt: -1 })
      .populate('ownerId', 'username displayName avatarAttachmentId')
      .populate('attachments');

    return res.status(200).json({
      success: true,
      data: {
        statuses: statuses.map(formatStatus)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const createStatus = async (req, res, next) => {
  try {
    const { attachmentId, content = '', privacy = 'everyone', type = attachmentId ? 'image' : 'text' } = req.body;
    const attachments = [];

    if (!['everyone', 'contacts', 'nobody'].includes(privacy)) {
      return next(validationError('Invalid status privacy.', [{ field: 'privacy', message: 'Use everyone, contacts, or nobody.' }]));
    }

    if (!content.trim() && !attachmentId) {
      return next(validationError('Status content or media is required.', [{ field: 'content', message: 'Add text or media.' }]));
    }

    if (attachmentId) {
      const attachment = await Attachment.findById(attachmentId);

      if (!attachment || attachment.ownerId.toString() !== req.user.id || attachment.purpose !== 'status') {
        return next(validationError('Invalid status attachment.', [
          { field: 'attachmentId', message: 'Status media must be an uploaded image/video owned by you.' }
        ]));
      }
      attachments.push(attachment._id);
    }

    const status = await Status.create({
      attachments,
      content: String(content).trim(),
      ownerId: req.user._id,
      privacy,
      type
    });
    await status.populate('ownerId', 'username displayName avatarAttachmentId');
    await status.populate('attachments');

    return res.status(201).json({
      success: true,
      data: {
        status: formatStatus(status)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const markStatusViewed = async (req, res, next) => {
  try {
    const status = await Status.findOne({
      _id: req.params.id,
      expiresAt: { $gt: new Date() }
    }).populate('ownerId', 'username displayName avatarAttachmentId').populate('attachments');

    if (!status) {
      return next(notFoundError('Status not found.'));
    }

    if (!status.viewers.some((viewer) => viewer.viewerId.toString() === req.user.id)) {
      status.viewers.push({ viewerId: req.user._id });
      await status.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        status: formatStatus(status)
      }
    });
  } catch (error) {
    return next(error);
  }
};

const deleteStatus = async (req, res, next) => {
  try {
    const status = await Status.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });

    if (!status) {
      return next(notFoundError('Status not found.'));
    }

    return res.status(200).json({
      success: true,
      data: { statusId: req.params.id }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createStatus,
  deleteStatus,
  formatStatus,
  getActiveStatuses,
  markStatusViewed
};
