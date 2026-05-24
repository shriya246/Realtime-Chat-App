/**
 * Purpose: Defines authenticated user lookup routes.
 */

const express = require('express');

const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, userController.searchUsers);
router.get('/:id', authenticate, userController.getUserById);

module.exports = router;
