const cron = require('node-cron');
const { Slot, Booking, WaitlistEntry } = require('../models');
const { transaction } = require('../services/transaction');
const { guardSlot } = require('../services/guards');
const { notify, slotChanged } = require('../services/notificationService');

async function completeSlot(id, clock) {
  return transaction(async session => {
    // The same Service/Slot writes used by cancellation and promotion serialize this job.
    const { slot } = await guardSlot(id, session);
    if (slot.status !== 'open' || slot.endTime > clock()) return false;
    await WaitlistEntry.updateMany({ slot: id, status: 'waiting' }, { $set: { status: 'expired' } }, { session });
    await Slot.updateOne({ _id: id }, { $set: { status: 'completed', waitlistCount: 0 } }, { session });
    // Confirmed bookings and bookedCount remain as the historical attendance record.
    await slotChanged(id, session);
    return true;
  });
}

async function remindSlot(id, clock) {
  return transaction(async session => {
    const { slot, service } = await guardSlot(id, session);
    const now = clock();
    if (slot.status !== 'open' || slot.startTime <= now || slot.startTime > new Date(+now + 60 * 60000)) return 0;
    const bookings = await Booking.find({ slot: id, status: 'confirmed', reminderSent: false }).session(session);
    for (const booking of bookings) {
      const changed = await Booking.updateOne({ _id: booking._id, status: 'confirmed', reminderSent: false }, { $set: { reminderSent: true } }, { session });
      if (!changed.modifiedCount) continue;
      // Flag and durable intent commit together. A crash cannot lose an acknowledged reminder.
      await notify(booking.user, 'reminder', 'Your session for ' + service.title + ' starts within the next hour.', id, String(booking._id), session);
    }
    return bookings.length;
  });
}

async function runMaintenance({ clock = () => new Date() } = {}) {
  const completed = Slot.find({ status: 'open', endTime: { $lte: clock() } }).select('_id').lean().cursor();
  const result = { completed: 0, reminders: 0 };
  for await (const slot of completed) if (await completeSlot(slot._id, clock)) result.completed++;
  const now = clock();
  const upcoming = Slot.find({ status: 'open', startTime: { $gt: now, $lte: new Date(+now + 60 * 60000) } }).select('_id').lean().cursor();
  for await (const slot of upcoming) result.reminders += await remindSlot(slot._id, clock);
  return result;
}

function startMaintenance() {
  let running;
  function run() {
    if (running) return running;
    running = runMaintenance().catch(error => console.error('Maintenance failed:', error.name, error.code || 'Retry on next run'))
      .finally(() => { running = undefined; });
    return running;
  }
  const task = cron.schedule('*/5 * * * *', run, { timezone: 'Asia/Kolkata', noOverlap: true });
  void run(); // Catch up after a sleeping host or a restart.
  return { stop: async () => { await task.destroy(); await running; } };
}

module.exports = { runMaintenance, startMaintenance };
