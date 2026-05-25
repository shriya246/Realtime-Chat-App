/**
 * Purpose: Defines authentication routes for registration, login, logout, and current-user lookup.
 */

const express = require('express');

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { createAuthRateLimiter } = require('../middleware/rateLimiter');
const { loginValidators, registerValidators } = require('../utils/validators');

const router = express.Router();
const authRateLimiter = createAuthRateLimiter();

router.post('/register', authRateLimiter, registerValidators, authController.register);
router.post('/login', authRateLimiter, loginValidators, authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
