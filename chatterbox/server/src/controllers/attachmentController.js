/**
 * Purpose: Handles secure local attachment upload and authorized file serving.
 */

const fs = require('fs');
const path = require('path');

const Attachment = require('../models/Attachment');
const { getAccessibleConversation } = require('../services/conversationService');
const { getAttachmentPath, saveAttachment } = require('../services/storageService');
const { forbiddenError, notFoundError, validationError } = require('../utils/errors');

/**
 * Reads upload metadata from headers and query parameters.
 *
 * @param {object} req - Express request.
 * @returns {object} Upload metadata.
 */
const getUploadMetadata = (req) => ({
  conversationId: req.query.conversationId || req.headers['x-conversation-id'] || null,
  duration: req.headers['x-media-duration'] ? Number(req.headers['x-media-duration']) : null,
  height: req.headers['x-media-height'] ? Number(req.headers['x-media-height']) : null,
  mimeType: req.headers['content-type'] || 'application/octet-stream',
  originalFilename: decodeURIComponent(req.headers['x-file-name'] || 'attachment'),
  purpose: req.query.purpose || req.headers['x-upload-purpose'] || 'message',
  width: req.headers['x-media-width'] ? Number(req.headers['x-media-width']) : null
});

/**
 * Uploads a binary attachment to local storage.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} JSON response or error handoff.
 */
const uploadAttachment = async (req, res, next) => {
  try {
    const metadata = getUploadMetadata(req);

    if (metadata.purpose === 'message') {
      if (!metadata.conversationId) {
        return next(validationError('Conversation ID is required for message attachments.', [
          { field: 'conversationId', message: 'Conversation ID is required.' }
        ]));
      }

      await getAccessibleConversation(metadata.conversationId, req.user.id);
    } else if (metadata.purpose !== 'avatar') {
      return next(validationError('Invalid upload purpose.', [
        { field: 'purpose', message: 'Upload purpose must be message or avatar.' }
      ]));
    }

    const attachment = await saveAttachment({
      buffer: req.body,
      conversationId: metadata.purpose === 'message' ? metadata.conversationId : null,
      duration: metadata.duration,
      height: metadata.height,
      mimeType: metadata.mimeType,
      originalFilename: metadata.originalFilename,
      ownerId: req.user._id,
      purpose: metadata.purpose,
      width: metadata.width
    });

    return res.status(201).json({
      success: true,
      data: {
        attachment: attachment.toJSON()
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Ensures the current user can access an attachment.
 *
 * @param {object} attachment - Attachment document.
 * @param {string} userId - Authenticated user id.
 * @returns {Promise<void>} Resolves when access is allowed.
 */
const authorizeAttachmentAccess = async (attachment, userId) => {
  if (attachment.purpose === 'avatar') {
    return;
  }

  if (!attachment.conversationId) {
    throw forbiddenError('You do not have access to this attachment.');
  }

  await getAccessibleConversation(attachment.conversationId.toString(), userId);
};

/**
 * Serves an authorized local attachment.
 *
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {Promise<object|void>} Stream response or error handoff.
 */
const serveAttachment = async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.id);

    if (!attachment) {
      return next(notFoundError('Attachment not found.'));
    }

    await authorizeAttachmentAccess(attachment, req.user.id);

    const absolutePath = getAttachmentPath(attachment);

    if (!fs.existsSync(absolutePath)) {
      return next(notFoundError('Attachment file not found.'));
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${path.basename(attachment.originalFilename)}"`
    );

    return fs.createReadStream(absolutePath).pipe(res);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  authorizeAttachmentAccess,
  serveAttachment,
  uploadAttachment
};
