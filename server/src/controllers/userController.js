const users = require('../services/userService');
const { stats } = require('../services/statsService');
const { context } = require('./resourceController');
exports.profile = async (req, res) => res.json({ success: true, data: await users.profile(req.validated.body, req.file, context(req), req.app.locals.env) });
exports.cover = async (req, res) => res.json({ success: true, data: await users.cover(req.validated.params.id, req.file, context(req), req.app.locals.env) });
exports.users = async (req, res) => res.json({ success: true, ...await users.users(req.validated.query) });
exports.status = async (req, res) => {
  const user = await users.status(req.validated.params.id, req.validated.body.isActive, context(req));
  await req.app.locals.revokeSockets?.(String(user._id));
  res.json({ success: true, data: user });
};
exports.stats = async (req, res) => res.json({ success: true, data: await stats(req.user._id) });
