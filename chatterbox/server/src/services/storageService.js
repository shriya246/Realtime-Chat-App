/**
 * Purpose: Provides local filesystem attachment storage behind a swappable service boundary.
 */

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const { getConfig } = require('../config');
const Attachment = require('../models/Attachment');
const { validationError } = require('../utils/errors');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'application/pdf',
  'text/plain'
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.js',
  '.jse',
  '.msi',
  '.ps1',
  '.scr',
  '.sh',
  '.vbs'
]);

/**
 * Returns a filesystem-safe filename.
 *
 * @param {string} filename - User supplied filename.
 * @returns {string} Safe filename.
 */
const sanitizeFilename = (filename = 'attachment') =>
  path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'attachment';

/**
 * Classifies an attachment from MIME type and purpose.
 *
 * @param {string} mimeType - MIME type.
 * @param {string} purpose - Attachment purpose.
 * @returns {string} Attachment kind.
 */
const getAttachmentKind = (mimeType, purpose = 'message') => {
  if (purpose === 'avatar') {
    return 'avatar';
  }

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }

  return 'file';
};

/**
 * Resolves the configured upload directory.
 *
 * @returns {string} Absolute upload directory path.
 */
const getUploadDirectory = () => path.resolve(process.cwd(), getConfig().media.uploadDir);

/**
 * Validates file metadata and contents before local persistence.
 *
 * @param {object} input - File metadata.
 * @returns {void}
 */
const validateUpload = ({ buffer, mimeType, originalFilename, purpose }) => {
  const { maxFileSizeBytes } = getConfig().media;
  const safeFilename = sanitizeFilename(originalFilename);
  const extension = path.extname(safeFilename).toLowerCase();

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw validationError('Upload file is required.', [{ field: 'file', message: 'Upload body cannot be empty.' }]);
  }

  if (buffer.length > maxFileSizeBytes) {
    throw validationError('Upload file is too large.', [
      { field: 'file', message: `File cannot exceed ${maxFileSizeBytes} bytes.` }
    ]);
  }

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    throw validationError('Upload file type is not allowed.', [
      { field: 'filename', message: 'Executable and script files are not allowed.' }
    ]);
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw validationError('Upload MIME type is not allowed.', [
      { field: 'mimeType', message: 'This file type is not supported.' }
    ]);
  }

  if (purpose === 'avatar' && !mimeType.startsWith('image/')) {
    throw validationError('Avatar must be an image.', [
      { field: 'mimeType', message: 'Avatar uploads must be image files.' }
    ]);
  }

  if (purpose === 'status' && !mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    throw validationError('Status media must be an image or video.', [
      { field: 'mimeType', message: 'Status uploads must be image or video files.' }
    ]);
  }
};

/**
 * Stores a file locally and records its metadata in MongoDB.
 *
 * @param {object} input - Attachment creation input.
 * @returns {Promise<object>} Saved attachment.
 */
const saveAttachment = async ({
  buffer,
  conversationId = null,
  duration = null,
  height = null,
  mimeType,
  originalFilename,
  ownerId,
  purpose = 'message',
  width = null
}) => {
  validateUpload({ buffer, mimeType, originalFilename, purpose });

  const uploadDirectory = getUploadDirectory();
  await fs.mkdir(uploadDirectory, { recursive: true });

  const safeFilename = sanitizeFilename(originalFilename);
  const extension = path.extname(safeFilename).toLowerCase();
  const storedFilename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const absolutePath = path.join(uploadDirectory, storedFilename);

  await fs.writeFile(absolutePath, buffer);

  return Attachment.create({
    conversationId,
    duration,
    height,
    kind: getAttachmentKind(mimeType, purpose),
    mimeType,
    originalFilename: safeFilename,
    ownerId,
    purpose,
    relativePath: storedFilename,
    size: buffer.length,
    storedFilename,
    width
  });
};

/**
 * Returns the absolute local path for an attachment.
 *
 * @param {object} attachment - Attachment document.
 * @returns {string} Absolute path.
 */
const getAttachmentPath = (attachment) =>
  path.join(getUploadDirectory(), attachment.relativePath);

module.exports = {
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
  getAttachmentKind,
  getAttachmentPath,
  saveAttachment,
  sanitizeFilename,
  validateUpload
};
