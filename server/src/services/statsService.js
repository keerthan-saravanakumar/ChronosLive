const { Slot, Booking, Service } = require('../models');
async function stats(organizer) {
  const now = new Date();
  const [upcoming, history, services, nextSlots, daily] = await Promise.all([
    Slot.aggregate([{ $match: { organizer, status: 'open', startTime: { $gt: now } } }, { $group: { _id: null, upcomingSlots: { $sum: 1 }, totalSeats: { $sum: '$capacity' }, bookedSeats: { $sum: '$bookedCount' }, waitlistDemand: { $sum: '$waitlistCount' } } }]),
    Booking.aggregate([{ $lookup: { from: 'slots', localField: 'slot', foreignField: '_id', as: 'slotInfo' } }, { $unwind: '$slotInfo' }, { $match: { 'slotInfo.organizer': organizer } }, { $group: { _id: null, cancellations: { $sum: { $cond: [{ $ne: ['$status', 'confirmed'] }, 1, 0] } }, promotions: { $sum: { $cond: [{ $eq: ['$source', 'waitlist_promotion'] }, 1, 0] } } } }]),
    Service.countDocuments({ organizer, isActive: true }),
    Slot.find({ organizer, status: 'open', startTime: { $gt: now } }).populate('service', 'title category').sort({ startTime: 1 }).limit(6).lean(),
    Slot.aggregate([{ $match: { organizer, status: 'open', startTime: { $gt: now, $lt: new Date(+now + 7 * 86400000) } } }, { $group: { _id: { $dateToString: { date: '$startTime', format: '%Y-%m-%d', timezone: 'Asia/Kolkata' } }, booked: { $sum: '$bookedCount' }, capacity: { $sum: '$capacity' }, slots: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  const summary = { upcomingSlots: 0, totalSeats: 0, bookedSeats: 0, waitlistDemand: 0, cancellations: 0, promotions: 0, ...upcoming[0], ...history[0] };
  delete summary._id;
  return { ...summary, activeServices: services, fillRate: summary.totalSeats ? Math.round(summary.bookedSeats / summary.totalSeats * 100) : 0, nextSlots, daily };
}
module.exports = { stats };
