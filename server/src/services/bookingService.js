const { Booking, Slot, WaitlistEntry } = require('../models');
const { transaction } = require('./transaction');
const { guardSlot, guardActor, guardUser, guardSchedule, requireOwner, requireOpen, sameId } = require('./guards');
const { isEligible } = require('./eligibilityService');
const { claimSeat, decrementWaitlist, promoteFromWaitlist, requireParticipant } = require('./waitlistService');
const { notify, slotChanged } = require('./notificationService');
const AppError = require('../utils/AppError');
async function book(slotId, context) {
  try {
    return await transaction(async session => {
      const { slot, service } = await guardSlot(slotId, session);
      const user = await guardActor(context, session);
      requireOpen(slot);
      requireParticipant(slot, user);
      if (!service.isActive) throw new AppError(409, 'SERVICE_INACTIVE', 'This service is archived.');
      if (await Booking.exists({ slot: slotId, user: user._id, status: 'confirmed' }).session(session)) throw new AppError(409, 'ALREADY_BOOKED', 'You already have a seat.');
      const reason = await isEligible(user, slot, service, session);
      if (reason) throw new AppError(409, reason, reason === 'TIME_CONFLICT' ? 'You have another booking at this time.' : 'You have reached this service’s active booking limit.');
      if (!await claimSeat(slotId, session)) throw new AppError(409, 'SLOT_FULL', 'This slot has just filled up. Join the waitlist.', { canJoinWaitlist: true });
      const [booking] = await Booking.create([{ slot: slotId, service: service._id, user: user._id }], { session });
      const waiting = await WaitlistEntry.findOneAndUpdate({ slot: slotId, user: user._id, status: 'waiting' }, { $set: { status: 'left' } }, { session });
      if (waiting) await decrementWaitlist(slotId, session);
      await notify(user._id, 'booking_confirmed', 'Your seat for ' + service.title + ' is confirmed.', slotId, String(booking._id), session);
      await slotChanged(slotId, session);
      return booking;
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'ALREADY_BOOKED', 'You already have a seat.');
    throw error;
  }
}
async function cancel(bookingId, reason, context) {
  return transaction(async session => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    const { slot, service } = await guardSlot(booking.slot, session);
    const actor = await guardActor(context, session);
    const manager = actor.role === 'admin' || (actor.role === 'organizer' && sameId(slot.organizer, actor._id));
    if (!manager && !sameId(booking.user, actor._id)) throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own bookings.');
    if (booking.status !== 'confirmed') throw new AppError(409, 'ALREADY_CANCELLED', 'This booking has already been cancelled.');
    if (!manager && slot.startTime - new Date() <= service.policy.cancellationCutoffMinutes * 60000) throw new AppError(409, 'CANCELLATION_WINDOW_CLOSED', 'The cancellation window for this slot has closed.');
    if (!sameId(booking.user, actor._id)) await guardUser(booking.user, session);
    const cancelled = await Booking.findOneAndUpdate({ _id: bookingId, status: 'confirmed' }, { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason || (manager ? 'Removed by organizer or admin' : 'Cancelled by attendee') } }, { new: true, session });
    if (!cancelled) throw new AppError(409, 'ALREADY_CANCELLED', 'This booking has already been cancelled.');
    const decrement = await Slot.updateOne({ _id: slot._id, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } }, { session });
    if (!decrement.modifiedCount) throw new AppError(500, 'INVARIANT_ERROR', 'Booking count is inconsistent.');
    await notify(booking.user, 'booking_cancelled', 'Your booking for ' + service.title + ' was cancelled.', slot._id, String(bookingId), session);
    await promoteFromWaitlist(slot, service, session);
    await slotChanged(slot._id, session);
    return cancelled;
  });
}
async function capacity(slotId, value, context) {
  return transaction(async session => {
    const { slot, service } = await guardSlot(slotId, session);
    requireOwner(service, await guardActor(context, session));
    requireOpen(slot);
    if (value < slot.bookedCount) throw new AppError(409, 'CAPACITY_BELOW_BOOKED', 'Capacity cannot be lower than the number of confirmed bookings.');
    const delta = value - slot.capacity;
    await Slot.updateOne({ _id: slotId }, { $set: { capacity: value } }, { session });
    if (delta > 0) await promoteFromWaitlist(slot, service, session, delta);
    const current = await slotChanged(slotId, session);
    if (delta !== 0) {
      const participants = await Booking.find({ slot: slotId, status: 'confirmed' }).select('user').session(session);
      for (const participant of participants) await notify(participant.user, 'slot_updated', 'Capacity for ' + service.title + ' is now ' + value + '.', slotId, String(slotId) + ':' + current.version, session);
    }
    return current;
  });
}
async function cancelSlot(slotId, reason, context) {
  return transaction(async session => {
    const { slot, service } = await guardSlot(slotId, session);
    const actor = await guardActor(context, session);
    requireOwner(service, actor);
    if (slot.status === 'cancelled') throw new AppError(409, 'SLOT_CLOSED', 'This slot has already been cancelled.');
    await guardSchedule(slot.organizer, session);
    const bookings = await Booking.find({ slot: slotId, status: 'confirmed' }).session(session);
    const waiting = await WaitlistEntry.find({ slot: slotId, status: 'waiting' }).session(session);
    const bookedUsers = [...new Set(bookings.map(b => String(b.user)))].sort();
    for (const user of bookedUsers) if (!sameId(user, actor._id)) await guardUser(user, session);
    await Booking.updateMany({ slot: slotId, status: 'confirmed' }, { $set: { status: 'cancelled_by_organizer', cancelledAt: new Date(), cancelReason: reason || 'Slot cancelled by organizer' } }, { session });
    await WaitlistEntry.updateMany({ slot: slotId, status: 'waiting' }, { $set: { status: 'expired' } }, { session });
    await Slot.updateOne({ _id: slotId }, { $set: { status: 'cancelled', bookedCount: 0, waitlistCount: 0 } }, { session });
    for (const user of new Set([...bookedUsers, ...waiting.map(e => String(e.user))])) await notify(user, 'slot_cancelled', service.title + ' was cancelled by its organizer.' + (reason ? ' ' + reason : ''), slotId, String(slotId), session);
    return slotChanged(slotId, session, true);
  });
}
async function mine(userId, status) {
  const query = { user: userId, status: status === 'cancelled' ? { $ne: 'confirmed' } : 'confirmed' };
  const bookings = await Booking.find(query).populate('slot').populate({ path: 'service', populate: { path: 'organizer', select: 'name' } }).lean();
  const now = new Date();
  return bookings.filter(b => b.slot && (status === 'cancelled' || (status === 'upcoming' ? b.slot.startTime > now : b.slot.startTime <= now)))
    .sort((a, b) => status === 'upcoming' ? a.slot.startTime - b.slot.startTime : b.slot.startTime - a.slot.startTime);
}
module.exports = { book, cancel, capacity, cancelSlot, mine };
