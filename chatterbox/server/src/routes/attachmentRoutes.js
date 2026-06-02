/**
 * Purpose: Defines protected upload and attachment serving routes.
 */

const express = require('express');

const attachmentController = require('../controllers/attachmentController');
const { getConfig } = require('../config');
const { authenticate } = require('../middleware/auth');
const { attachmentIdValidators } = require('../utils/validators');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  express.raw({ limit: getConfig().media.maxFileSizeBytes, type: '*/*' }),
  attachmentController.uploadAttachment
);
router.get('/:id/content', attachmentIdValidators, attachmentController.serveAttachment);

module.exports = router;
