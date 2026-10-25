const services = require('../services/serviceService');
const slots = require('../services/slotService');
const context = req => ({ user: req.user, claims: req.claims });
exports.context = context;
exports.listServices = async (req, res) => res.json({ success: true, ...await services.list(req.validated.query, req.user) });
exports.getService = async (req, res) => res.json({ success: true, data: await services.get(req.validated.params.id) });
exports.createService = async (req, res) => res.status(201).json({ success: true, data: await services.create(req.validated.body, context(req)) });
exports.updateService = async (req, res) => res.json({ success: true, data: await services.update(req.validated.params.id, req.validated.body, context(req)) });
exports.archiveService = async (req, res) => res.json({ success: true, data: await services.update(req.validated.params.id, { isActive: false }, context(req)) });
exports.listSlots = async (req, res) => res.json({ success: true, ...await slots.list(req.validated.params.id, req.validated.query, req.user) });
exports.getSlot = async (req, res) => res.json({ success: true, data: await slots.get(req.validated.params.id, req.user) });
exports.createSlot = async (req, res) => res.status(201).json({ success: true, data: (await slots.createSlots(req.validated.params.id, [req.validated.body], context(req)))[0] });
exports.createBulk = async (req, res) => {
  const created = await slots.createSlots(req.validated.params.id, slots.generateSlots(req.validated.body), context(req));
  res.status(201).json({ success: true, data: { count: created.length, slots: created } });
};
exports.roster = async (req, res) => res.json({ success: true, data: await slots.roster(req.validated.params.id, req.user) });
