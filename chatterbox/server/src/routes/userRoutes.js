/**
 * Purpose: Defines authenticated user lookup routes.
 */

const express = require('express');

const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { userIdValidators, userListValidators } = require('../utils/validators');

const router = express.Router();

router.get('/', authenticate, userListValidators, userController.searchUsers);
router.get('/:id', authenticate, userIdValidators, userController.getUserById);

module.exports = router;
