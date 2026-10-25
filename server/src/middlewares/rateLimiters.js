const { rateLimit } = require('express-rate-limit');
const createLimiter = (env, limit, windowMs) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } }),
});
module.exports = { createLimiter };
