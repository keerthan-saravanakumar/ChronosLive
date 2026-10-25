const service = require('../services/authService');
exports.register = async (req, res) => res.status(201).json({ success: true, data: await service.register(req.validated.body, req.app.locals.env) });
exports.login = async (req, res) => res.json({ success: true, data: await service.login(req.validated.body, req.app.locals.env) });
exports.me = async (req, res) => res.json({ success: true, data: service.publicUser(req.user) });
exports.logout = async (req, res) => {
  await service.logout(req.user, req.claims);
  await req.app.locals.revokeSockets?.(String(req.user._id));
  res.json({ success: true, data: { message: 'Signed out of all sessions.' } });
};
