const { authenticateToken } = require('../services/authService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const auth = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  const { user, claims } = await authenticateToken(header.slice(7), req.app.locals.env);
  req.user = user;
  req.claims = claims;
  next();
});
const authorize = (...roles) => (req, _res, next) => roles.includes(req.user.role) ? next() : next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do this.'));
const optionalAuth = (req, res, next) => req.get('authorization') ? auth(req, res, next) : next();
module.exports = { auth, authorize, optionalAuth };
