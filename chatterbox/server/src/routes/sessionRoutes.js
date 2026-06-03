/**
 * Purpose: Registers browser-session management routes.
 */

const express = require('express');

const {
  listSessions,
  logoutAllSessions,
  logoutSession
} = require('../controllers/sessionController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', listSessions);
router.delete('/all', logoutAllSessions);
router.delete('/:id', logoutSession);

module.exports = router;
