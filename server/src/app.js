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
  // Hosting probes must report database outages and stay outside user request quotas.
  app.get('/api/health', (_req, res) => {
    const state = mongoose.connection.readyState;
    const connected = state === 1;
    res.set('Cache-Control', 'no-store').status(connected ? 200 : 503).json({
      success: connected,
      data: { status: connected ? 'ok' : 'degraded', database: ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || 'unknown' },
      ...(!connected && { error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is temporarily unavailable.' } }),
    });
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', createLimiter(env, 300, 60000));
  const authLimiter = createLimiter(env, 10, 15 * 60000);
  app.use(['/api/auth/login', '/api/auth/register'], authLimiter);
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api', require('./routes/resourceRoutes'));
  app.use('/api', require('./routes/bookingRoutes'));
  app.use('/api', require('./routes/userRoutes'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
