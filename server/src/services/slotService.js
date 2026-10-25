const { Slot, Booking, WaitlistEntry, Service } = require('../models');
const { transaction } = require('./transaction');
const { guardService, guardActor, guardSchedule, requireOwner, sameId } = require('./guards');
const { overlap, validateInterval, generateSlots } = require('../utils/time');
const AppError = require('../utils/AppError');
async function createSlots(serviceId, intervals, context) {
  if (intervals.length > 200) throw new AppError(400, 'TOO_MANY_SLOTS', 'A request may create at most 200 slots.');
  return transaction(async session => {
    const service = await guardService(serviceId, session);
    const actor = await guardActor(context, session);
    requireOwner(service, actor);
    if (!service.isActive) throw new AppError(409, 'SERVICE_INACTIVE', 'Reactivate this service before publishing slots.');
    await guardSchedule(actor._id, session);
    intervals.forEach(interval => validateInterval(interval));
    const first = new Date(Math.min(...intervals.map(s => +new Date(s.startTime))));
    const last = new Date(Math.max(...intervals.map(s => +new Date(s.endTime))));
    const existing = await Slot.find({ organizer: actor._id, status: { $ne: 'cancelled' }, startTime: { $lt: last }, endTime: { $gt: first } }).session(session).lean();
    const conflicts = [];
    intervals.forEach((slot, index) => {
      for (const previous of existing) if (overlap(slot, previous)) conflicts.push({ index, slotId: previous._id, startTime: previous.startTime, endTime: previous.endTime });
      for (let other = 0; other < index; other++) if (overlap(slot, intervals[other])) conflicts.push({ index, otherIndex: other, startTime: intervals[other].startTime, endTime: intervals[other].endTime });
    });
    if (conflicts.length) throw new AppError(409, 'SLOT_OVERLAP', 'No slots were created. Resolve the conflicting intervals.', { conflicts });
    return Slot.insertMany(intervals.map(slot => ({ ...slot, service: service._id, organizer: actor._id })), { session });
  });
}
async function position(entry, session) {
  const query = WaitlistEntry.countDocuments({ slot: entry.slot, status: 'waiting', $or: [{ createdAt: { $lt: entry.createdAt } }, { createdAt: entry.createdAt, _id: { $lt: entry._id } }] });
  if (session) query.session(session);
  return 1 + await query;
}
async function personal(slot, viewer) {
  if (!viewer) return { ...slot, myBooking: null, myWaitlist: null };
  const [booking, entry] = await Promise.all([
    Booking.findOne({ slot: slot._id, user: viewer._id, status: 'confirmed' }).lean(),
    WaitlistEntry.findOne({ slot: slot._id, user: viewer._id, status: 'waiting' }).lean(),
  ]);
  return { ...slot, myBooking: booking, myWaitlist: entry ? { ...entry, position: await position(entry) } : null };
}
async function get(id, viewer) {
  const slot = await Slot.findById(id).populate({ path: 'service', populate: { path: 'organizer', select: 'name avatarUrl' } }).lean();
  if (!slot) throw new AppError(404, 'SLOT_NOT_FOUND', 'Slot not found.');
  return personal(slot, viewer);
}
async function list(serviceId, filters, viewer) {
  if (!await Service.exists({ _id: serviceId })) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  const { page, limit } = filters;
  const query = { service: serviceId, startTime: { $gte: filters.from ? new Date(filters.from) : new Date() } };
  if (filters.to) query.startTime.$lt = new Date(filters.to);
  const expressions = [];
  if (filters.availableOnly) {
    query.status = 'open';
    query.startTime.$gt = new Date();
    expressions.push({ $lt: ['$bookedCount', '$capacity'] });
  }
  const clock = { $dateToString: { date: '$startTime', format: '%H:%M', timezone: 'Asia/Kolkata' } };
  if (filters.timeFrom) expressions.push({ $gte: [clock, filters.timeFrom] });
  if (filters.timeTo) expressions.push({ $lt: [clock, filters.timeTo] });
  if (expressions.length) query.$expr = { $and: expressions };
  const [slots, total] = await Promise.all([
    Slot.find(query).sort({ startTime: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Slot.countDocuments(query),
  ]);
  return { data: await Promise.all(slots.map(slot => personal(slot, viewer))), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function roster(id, viewer) {
  const slot = await Slot.findById(id).populate('service').lean();
  if (!slot) throw new AppError(404, 'SLOT_NOT_FOUND', 'Slot not found.');
  requireOwner(slot.service, viewer);
  const [attendees, waitlist] = await Promise.all([
    Booking.find({ slot: id, status: 'confirmed' }).populate('user', 'name email avatarUrl isActive').sort({ createdAt: 1 }).lean(),
    WaitlistEntry.find({ slot: id, status: 'waiting' }).populate('user', 'name email avatarUrl isActive').sort({ createdAt: 1, _id: 1 }).lean(),
  ]);
  return { slot, attendees, waitlist: waitlist.map((entry, index) => ({ ...entry, position: index + 1 })) };
}
module.exports = { createSlots, generateSlots, position, personal, get, list, roster };
