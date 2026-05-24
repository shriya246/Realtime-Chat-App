/**
 * Purpose: Defines authentication routes for registration, login, logout, and current-user lookup.
 */

const express = require('express');

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { createAuthRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const authRateLimiter = createAuthRateLimiter();

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
