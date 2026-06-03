/**
 * Purpose: Registers status/story routes.
 */

const express = require('express');

const {
  createStatus,
  deleteStatus,
  getActiveStatuses,
  markStatusViewed
} = require('../controllers/statusController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', getActiveStatuses);
router.post('/', createStatus);
router.post('/:id/view', markStatusViewed);
router.delete('/:id', deleteStatus);

module.exports = router;
