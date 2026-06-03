/**
 * Purpose: Registers admin dashboard and local metrics routes.
 */

const express = require('express');

const {
  getDashboardMetrics,
  getPrometheusMetrics
} = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/dashboard', getDashboardMetrics);
router.get('/metrics', getPrometheusMetrics);

module.exports = router;
