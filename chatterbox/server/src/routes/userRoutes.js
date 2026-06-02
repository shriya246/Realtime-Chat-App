/**
 * Purpose: Defines authenticated user lookup routes.
 */

const express = require('express');

const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { updateProfileValidators, userIdValidators, userListValidators } = require('../utils/validators');

const router = express.Router();

router.use(authenticate);

router.get('/', userListValidators, userController.searchUsers);
router.patch('/me', updateProfileValidators, userController.updateCurrentUser);
router.get('/:id', userIdValidators, userController.getUserById);

module.exports = router;
