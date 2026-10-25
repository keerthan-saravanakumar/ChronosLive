const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

function publicUser(user) {
  return { _id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl, isActive: user.isActive, createdAt: user.createdAt };
}
function issueToken(user, env) {
  return jwt.sign({ ver: user.authVersion }, env.JWT_SECRET, { subject: String(user._id), expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' });
}
async function register(data, env) {
  try {
    const user = await User.create({ name: data.name, email: data.email, role: data.role, passwordHash: await bcrypt.hash(data.password, 12) });
    return { user: publicUser(user), token: issueToken(user, env) };
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    throw error;
  }
}
async function login(data, env) {
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  const valid = user && await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
  if (!user.isActive) throw new AppError(401, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
  return { user: publicUser(user), token: issueToken(user, env) };
}
async function authenticateToken(token, env) {
  let claims;
  try { claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { throw new AppError(401, 'SESSION_EXPIRED', 'Please sign in again.'); }
  if (!claims || typeof claims.sub !== 'string' || !/^[a-f\d]{24}$/i.test(claims.sub)) throw new AppError(401, 'INVALID_TOKEN', 'Please sign in again.');
  const user = await User.findById(claims.sub);
  if (!user || !user.isActive || user.authVersion !== claims.ver) throw new AppError(401, 'SESSION_REVOKED', 'This session has ended. Please sign in again.');
  return { user, claims };
}
async function logout(user, claims) {
  const { transaction } = require('./transaction');
  const { enqueue } = require('./notificationService');
  return transaction(async session => {
    const updated = await User.findOneAndUpdate({ _id: user._id, authVersion: claims.ver, isActive: true }, { $inc: { authVersion: 1 } }, { new: true, session });
    if (!updated) throw new AppError(401, 'SESSION_REVOKED', 'This session has already ended.');
    await enqueue('revoke:' + user._id + ':' + updated.authVersion, 'auth:revoked', { userId: String(user._id), authVersion: updated.authVersion }, session, user._id);
    return updated;
  });
}
module.exports = { publicUser, issueToken, register, login, authenticateToken, logout };
