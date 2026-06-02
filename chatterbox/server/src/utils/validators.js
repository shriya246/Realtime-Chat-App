/**
 * Purpose: Defines express-validator rules and a shared validation-result middleware for REST inputs.
 */

const { body, param, query, validationResult } = require('express-validator');

const { validationError } = require('./errors');

const ROOM_TYPES = ['public', 'private'];
const MIN_PASSWORD_LENGTH = 8;
const MAX_MESSAGE_HISTORY_LIMIT = 100;

/**
 * Returns validation failures to the centralized error handler.
 *
 * @param {object} req - Express request.
 * @param {object} _res - Express response.
 * @param {Function} next - Express next callback.
 * @returns {void} Continues with valid requests or passes a validation error.
 */
const validateRequest = (req, _res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const details = result.array().map((error) => ({
    field: error.path,
    message: error.msg
  }));

  return next(validationError('Request validation failed.', details));
};

const registerValidators = [
  body('username')
    .isString()
    .withMessage('Username is required.')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters.')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username may only contain letters, numbers, underscores, and hyphens.'),
  body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
  body('password').isString().withMessage('Password is required.').isLength({ min: MIN_PASSWORD_LENGTH }).withMessage('Password must be at least 8 characters.'),
  validateRequest
];

const loginValidators = [
  body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
  body('password').isString().withMessage('Password is required.').notEmpty().withMessage('Password is required.'),
  validateRequest
];

const roomIdValidators = [
  param('id').isMongoId().withMessage('Room ID must be a valid ObjectId.'),
  validateRequest
];

const attachmentIdValidators = [
  param('id').isMongoId().withMessage('Attachment ID must be a valid ObjectId.'),
  validateRequest
];

const conversationIdValidators = [
  param('id').isMongoId().withMessage('Conversation ID must be a valid ObjectId.'),
  validateRequest
];

const createDirectConversationValidators = [
  body('targetUserId').isMongoId().withMessage('Target user ID must be a valid ObjectId.'),
  validateRequest
];

const conversationListValidators = [
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters.'),
  validateRequest
];

const createRoomValidators = [
  body('name').isString().withMessage('Room name is required.').trim().isLength({ min: 1, max: 80 }).withMessage('Room name must be between 1 and 80 characters.'),
  body('type').optional().isIn(ROOM_TYPES).withMessage('Room type must be public or private.'),
  body('members').optional().isArray().withMessage('Members must be an array of user identifiers.'),
  body('members.*').optional().isMongoId().withMessage('Every member must be a valid user identifier.'),
  validateRequest
];

const roomListValidators = [
  query('type').optional().isIn(ROOM_TYPES).withMessage('Room type must be public or private.'),
  query('search').optional().isString().trim().isLength({ max: 80 }).withMessage('Search cannot exceed 80 characters.'),
  validateRequest
];

const addMemberValidators = [
  param('id').isMongoId().withMessage('Room ID must be a valid ObjectId.'),
  body('userId').isMongoId().withMessage('User ID must be a valid ObjectId.'),
  validateRequest
];

const messageHistoryValidators = [
  param('id').isMongoId().withMessage('Room ID must be a valid ObjectId.'),
  query('limit').optional().isInt({ min: 1, max: MAX_MESSAGE_HISTORY_LIMIT }).withMessage('Limit must be between 1 and 100.').toInt(),
  query('before').optional().isMongoId().withMessage('Before cursor must be a valid ObjectId.'),
  validateRequest
];

const directMessageHistoryValidators = [
  param('id').isMongoId().withMessage('Conversation ID must be a valid ObjectId.'),
  query('limit').optional().isInt({ min: 1, max: MAX_MESSAGE_HISTORY_LIMIT }).withMessage('Limit must be between 1 and 100.').toInt(),
  query('before').optional().isMongoId().withMessage('Before cursor must be a valid ObjectId.'),
  validateRequest
];

const messageSearchValidators = [
  param('id').isMongoId().withMessage('Conversation ID must be a valid ObjectId.'),
  query('q').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters.'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50.').toInt(),
  validateRequest
];

const conversationSettingsValidators = [
  param('id').isMongoId().withMessage('Conversation ID must be a valid ObjectId.'),
  body('pinned').optional().isBoolean().withMessage('Pinned must be true or false.').toBoolean(),
  body('archived').optional().isBoolean().withMessage('Archived must be true or false.').toBoolean(),
  body('muted').optional().isBoolean().withMessage('Muted must be true or false.').toBoolean(),
  validateRequest
];

const updateProfileValidators = [
  body('displayName').optional().isString().trim().isLength({ max: 60 }).withMessage('Display name cannot exceed 60 characters.'),
  body('about').optional().isString().trim().isLength({ max: 160 }).withMessage('About cannot exceed 160 characters.'),
  body('avatarAttachmentId').optional({ nullable: true }).isMongoId().withMessage('Avatar attachment ID must be valid.'),
  validateRequest
];

const userListValidators = [
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters.'),
  validateRequest
];

const userIdValidators = [
  param('id').isMongoId().withMessage('User ID must be a valid ObjectId.'),
  validateRequest
];

module.exports = {
  addMemberValidators,
  attachmentIdValidators,
  conversationIdValidators,
  conversationListValidators,
  conversationSettingsValidators,
  createRoomValidators,
  createDirectConversationValidators,
  directMessageHistoryValidators,
  loginValidators,
  messageHistoryValidators,
  registerValidators,
  roomIdValidators,
  roomListValidators,
  messageSearchValidators,
  updateProfileValidators,
  userIdValidators,
  userListValidators
};
