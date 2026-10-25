const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const { createLimiter } = require('./middlewares/rateLimiters');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

function createApp(env) {
  const app = express();
  app.locals.env = env;
  app.disable('x-powered-by');
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', createLimiter(env, 300, 60000));
  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded', database: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] } }));
  app.use('/api/auth', createLimiter(env, 10, 15 * 60000), require('./routes/authRoutes'));
  app.use('/api', require('./routes/resourceRoutes'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
