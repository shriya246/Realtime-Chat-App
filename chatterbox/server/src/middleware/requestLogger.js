/**
 * Purpose: Logs HTTP request methods, routes, status codes, and response times through Morgan.
 */

const morgan = require('morgan');

const { getConfig } = require('../config');

/**
 * Creates request logging middleware while keeping automated test output quiet.
 *
 * @returns {Function} Morgan request logger middleware.
 */
const createRequestLogger = () =>
  morgan(':method :url :status :response-time ms', {
    skip: () => getConfig().environment === 'test'
  });

module.exports = {
  createRequestLogger
};
