/**
 * Purpose: Defines protected REST routes for one-to-one direct conversations.
 */

const express = require('express');

const conversationController = require('../controllers/conversationController');
const { authenticate } = require('../middleware/auth');
const {
  conversationIdValidators,
  conversationListValidators,
  conversationSettingsValidators,
  createDirectConversationValidators,
  directMessageHistoryValidators,
  messageSearchValidators
} = require('../utils/validators');

const router = express.Router();

router.use(authenticate);

router.post('/direct', createDirectConversationValidators, conversationController.createDirectConversation);
router.get('/', conversationListValidators, conversationController.listConversations);
router.get('/:id/search', messageSearchValidators, conversationController.searchConversationMessages);
router.get('/:id/messages', directMessageHistoryValidators, conversationController.getConversationMessages);
router.post('/:id/read', conversationIdValidators, conversationController.markConversationAsRead);
router.patch('/:id/settings', conversationSettingsValidators, conversationController.updateSettings);

module.exports = router;
