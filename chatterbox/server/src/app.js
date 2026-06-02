/**
 * Purpose: Builds the Express application, middleware chain, health route, and API route mounting.
 */

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');

const { getConfig } = require('./config');
const redis = require('./config/redis');
const authRoutes = require('./routes/authRoutes');
const attachmentRoutes = require('./routes/attachmentRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const roomRoutes = require('./routes/roomRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { createRequestLogger } = require('./middleware/requestLogger');
const { forbiddenError } = require('./utils/errors');

/**
 * Parses comma-separated CORS origins from configuration.
 *
 * @returns {Array<string>} Allowed origins.
 */
const getAllowedOrigins = () => {
  return getConfig().cors.allowedOrigins;
};

/**
 * Builds the CORS middleware options.
 *
 * @returns {object} CORS configuration.
 */
const buildCorsOptions = () => {
  const allowedOrigins = getAllowedOrigins();

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(forbiddenError('Origin is not allowed by CORS.'));
    }
  };
};

const app = express();
const config = getConfig();

if (config.server.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(createRequestLogger());
app.use(helmet());
app.use(compression({ threshold: config.security.compressionThresholdBytes }));
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: config.server.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (_req, res, next) => {
  try {
    const redisClient = redis.getRedisClient();

    const mongoReady = mongoose.connection.readyState === 1;
    const redisReady = redisClient.status === 'ready';
    const healthy = mongoReady && redisReady;

    return res.status(healthy ? 200 : 503).json({
      success: true,
      data: {
        service: 'chatterbox-server',
        status: healthy ? 'ok' : 'degraded',
        uptimeSeconds: Math.floor(process.uptime()),
        mongodb: mongoReady ? 'ready' : 'not_ready',
        redis: redisReady ? 'ready' : redisClient.status || 'not_ready'
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
