/**
 * Purpose: Builds the Express application, middleware chain, health route, and API route mounting.
 */

const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');

const redis = require('./config/redis');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

dotenv.config();

const DEFAULT_CLIENT_URL = 'http://localhost:3000';
const JSON_BODY_LIMIT = '1mb';

/**
 * Parses comma-separated CORS origins from configuration.
 *
 * @returns {Array<string>} Allowed origins.
 */
const getAllowedOrigins = () => {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_URL || DEFAULT_CLIENT_URL;
  return configuredOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);
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

      return callback(new Error('Origin is not allowed by CORS.'));
    }
  };
};

const app = express();

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (_req, res, next) => {
  try {
    const redisClient = redis.getRedisClient();

    return res.status(200).json({
      success: true,
      data: {
        service: 'chatterbox-server',
        status: 'ok',
        uptimeSeconds: Math.floor(process.uptime()),
        mongodb: mongoose.connection.readyState,
        redis: redisClient.status || 'unknown'
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
