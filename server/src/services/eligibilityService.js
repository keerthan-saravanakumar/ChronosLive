const { Booking, Slot } = require('../models');
const { sameId } = require('./guards');
const { overlap } = require('../utils/time');
async function isEligible(user, slot, service, session, now = new Date()) {
  if (!user?.isActive) return 'INACTIVE_USER';
  const bookings = await Booking.find({ user: user._id, status: 'confirmed' }).select('slot service').session(session).lean();
  const activeSlots = await Slot.find({ _id: { $in: bookings.map(b => b.slot) }, endTime: { $gt: now }, status: { $ne: 'cancelled' } }).session(session).lean();
  const upcomingIds = new Set(activeSlots.filter(s => s.startTime > now).map(s => String(s._id)));
  const upcomingCount = bookings.filter(b => sameId(b.service, service._id) && upcomingIds.has(String(b.slot))).length;
  if (upcomingCount >= service.policy.maxActiveBookingsPerUser) return 'BOOKING_LIMIT_REACHED';
  if (activeSlots.some(other => overlap(slot, other))) return 'TIME_CONFLICT';
  return null;
}
module.exports = { isEligible };
