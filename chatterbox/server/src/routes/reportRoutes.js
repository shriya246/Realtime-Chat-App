/**
 * Purpose: Defines local report and moderation routes.
 */

const express = require('express');

const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', reportController.createReport);
router.get('/', reportController.listReports);

module.exports = router;
