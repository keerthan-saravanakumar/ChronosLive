const { Slot, Booking, WaitlistEntry } = require('../models');
const { transaction } = require('./transaction');
const { guardSlot, guardActor, guardUser, requireOpen, sameId } = require('./guards');
const { isEligible } = require('./eligibilityService');
const { notify, enqueue, slotChanged } = require('./notificationService');
const { position } = require('./slotService');
const AppError = require('../utils/AppError');

async function claimSeat(slotId, session, now = new Date()) {
  return Slot.findOneAndUpdate({ _id: slotId, status: 'open', startTime: { $gt: now }, $expr: { $lt: ['$bookedCount', '$capacity'] } }, { $inc: { bookedCount: 1 } }, { new: true, session });
}
async function decrementWaitlist(slotId, session) {
  const updated = await Slot.updateOne({ _id: slotId, waitlistCount: { $gt: 0 } }, { $inc: { waitlistCount: -1 } }, { session });
  if (!updated.modifiedCount) throw new AppError(500, 'INVARIANT_ERROR', 'Waitlist count is inconsistent.');
}
async function promoteFromWaitlist(slot, service, session, maxSeats = 1) {
  let promoted = 0;
  if (slot.status !== 'open' || slot.startTime <= new Date()) return promoted;
  while (promoted < maxSeats) {
    const current = await Slot.findById(slot._id).session(session);
    if (current.bookedCount >= current.capacity) break;
    const entry = await WaitlistEntry.findOne({ slot: slot._id, status: 'waiting' }).sort({ createdAt: 1, _id: 1 }).session(session);
    if (!entry) break;
    // This real User write prevents two slots from promoting the same user from stale snapshots.
    const user = await guardUser(entry.user, session);
    const reason = await isEligible(user, slot, service, session);
    if (reason) {
      await WaitlistEntry.updateOne({ _id: entry._id, status: 'waiting' }, { $set: { status: 'skipped', skipReason: reason } }, { session });
      await decrementWaitlist(slot._id, session);
      await notify(entry.user, 'skipped', 'Your waitlist entry for ' + service.title + ' was skipped: ' + reason.replaceAll('_', ' ').toLowerCase() + '.', slot._id, String(entry._id), session);
      continue;
    }
    if (!await claimSeat(slot._id, session)) break;
    const [booking] = await Booking.create([{ slot: slot._id, service: service._id, user: entry.user, source: 'waitlist_promotion' }], { session });
    await WaitlistEntry.updateOne({ _id: entry._id, status: 'waiting' }, { $set: { status: 'promoted', promotedAt: new Date() } }, { session });
    await decrementWaitlist(slot._id, session);
    await notify(entry.user, 'promoted', 'A seat is yours! You were promoted into ' + service.title + '.', slot._id, String(booking._id), session);
    await enqueue('promoted:' + booking._id, 'booking:promoted', { bookingId: String(booking._id), slotId: String(slot._id) }, session, entry.user);
    promoted++;
  }
  return promoted;
}
function requireParticipant(slot, user) {
  if (sameId(slot.organizer, user._id)) throw new AppError(403, 'OWN_SLOT', 'Organizers cannot book or waitlist their own slots.');
}
async function join(slotId, context) {
  return transaction(async session => {
    const { slot, service } = await guardSlot(slotId, session);
    const user = await guardActor(context, session);
    requireParticipant(slot, user);
    requireOpen(slot);
    if (!service.isActive) throw new AppError(409, 'SERVICE_INACTIVE', 'This service is archived.');
    if (await Booking.exists({ slot: slotId, user: user._id, status: 'confirmed' }).session(session)) throw new AppError(409, 'ALREADY_BOOKED', 'You already have a seat.');
    if (await WaitlistEntry.exists({ slot: slotId, user: user._id, status: 'waiting' }).session(session)) throw new AppError(409, 'ALREADY_ON_WAITLIST', 'You are already on this waitlist.');
    if (slot.bookedCount < slot.capacity) throw new AppError(409, 'SLOT_HAS_SEATS', 'There are seats available. Book directly.');
    const [entry] = await WaitlistEntry.create([{ slot: slotId, user: user._id }], { session });
    await Slot.updateOne({ _id: slotId }, { $inc: { waitlistCount: 1 } }, { session });
    await slotChanged(slotId, session);
    return { ...entry.toObject(), position: await position(entry, session) };
  });
}
async function leave(slotId, context) {
  return transaction(async session => {
    await guardSlot(slotId, session);
    const user = await guardActor(context, session);
    const entry = await WaitlistEntry.findOneAndUpdate({ slot: slotId, user: user._id, status: 'waiting' }, { $set: { status: 'left' } }, { new: true, session });
    if (!entry) throw new AppError(409, 'NOT_ON_WAITLIST', 'You are no longer waiting for this slot.');
    await decrementWaitlist(slotId, session);
    await slotChanged(slotId, session);
    return entry;
  });
}
async function mine(userId) {
  const entries = await WaitlistEntry.find({ user: userId, status: 'waiting' }).populate({ path: 'slot', populate: { path: 'service', populate: { path: 'organizer', select: 'name' } } }).sort({ createdAt: 1 }).lean();
  const now = new Date();
  return Promise.all(entries.filter(e => e.slot?.status === 'open' && e.slot.startTime > now).map(async e => ({ ...e, position: await position({ ...e, slot: e.slot._id }) })));
}
module.exports = { claimSeat, decrementWaitlist, promoteFromWaitlist, requireParticipant, join, leave, mine };
