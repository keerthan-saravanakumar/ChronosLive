const { User, Service, Slot } = require('../models');
const AppError = require('../utils/AppError');
const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);
async function guardUser(id, session) {
  return User.findOneAndUpdate({ _id: id }, { $inc: { bookingRevision: 1 } }, { new: true, session });
}
async function guardActor(context, session) {
  const user = await guardUser(context.user._id, session);
  if (!user || !user.isActive || user.authVersion !== context.claims.ver) throw new AppError(401, 'SESSION_REVOKED', 'This session has ended.');
  return user;
}
async function guardService(id, session) {
  const service = await Service.findOneAndUpdate({ _id: id }, { $inc: { revision: 1 } }, { new: true, session });
  if (!service) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  return service;
}
async function guardSlot(id, session) {
  // This read discovers an immutable relationship, not authoritative availability.
  const identity = await Slot.findById(id).select('service').session(session);
  if (!identity) throw new AppError(404, 'SLOT_NOT_FOUND', 'Slot not found.');
  const service = await guardService(identity.service, session);
  const slot = await Slot.findOneAndUpdate({ _id: id }, { $inc: { version: 1 } }, { new: true, session });
  return { service, slot };
}
async function guardSchedule(id, session) {
  await User.updateOne({ _id: id }, { $inc: { scheduleRevision: 1 } }, { session });
}
function requireOwner(service, user) {
  if (user.role !== 'organizer' || !sameId(service.organizer, user._id)) throw new AppError(403, 'FORBIDDEN', 'Only the organizer who owns this service can change it.');
}
function requireOpen(slot, now = new Date()) {
  if (slot.status !== 'open') throw new AppError(409, 'SLOT_CLOSED', 'This slot is closed.');
  if (slot.startTime <= now) throw new AppError(409, 'SLOT_IN_PAST', 'This slot has already started.');
}
module.exports = { sameId, guardUser, guardActor, guardService, guardSlot, guardSchedule, requireOwner, requireOpen };
