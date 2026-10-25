const AppError = require('./AppError');
const DAY = 86400000;
const overlap = (a, b) => new Date(a.startTime) < new Date(b.endTime) && new Date(a.endTime) > new Date(b.startTime);
function validateInterval(slot, now = new Date()) {
  const duration = (new Date(slot.endTime) - new Date(slot.startTime)) / 60000;
  if (new Date(slot.startTime) <= now || !Number.isFinite(duration) || duration < 5 || duration > 240) {
    throw new AppError(400, 'INVALID_INTERVAL', 'Slots must start in the future and last between 5 and 240 minutes.');
  }
}
function generateSlots(input) {
  const slots = [];
  const minutes = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const start = minutes(input.startTime), end = minutes(input.endTime);
  if (end <= start || (end - start) % input.slotMinutes !== 0) throw new AppError(400, 'INVALID_INTERVAL', 'The same-day window must divide exactly into full slots.');
  const first = Date.parse(input.fromDate + 'T00:00:00Z'), last = Date.parse(input.toDate + 'T00:00:00Z');
  if (last < first) throw new AppError(400, 'INVALID_DATE_RANGE', 'The end date must follow the start date.');
  // Bound iteration as well as output; at least one selected weekday occurs in 7 days.
  if (last - first > 1400 * DAY) throw new AppError(400, 'TOO_MANY_SLOTS', 'A request may create at most 200 slots.');
  for (let day = first; day <= last; day += DAY) {
    if (!input.daysOfWeek.includes(new Date(day).getUTCDay())) continue;
    for (let minute = start; minute < end; minute += input.slotMinutes) {
      slots.push({ startTime: new Date(day + (minute - 330) * 60000), endTime: new Date(day + (minute + input.slotMinutes - 330) * 60000), capacity: input.capacity });
      if (slots.length > 200) throw new AppError(400, 'TOO_MANY_SLOTS', 'A request may create at most 200 slots.');
    }
  }
  if (!slots.length) throw new AppError(400, 'NO_SLOTS', 'No selected weekdays fall within this date range.');
  return slots;
}
module.exports = { DAY, overlap, validateInterval, generateSlots };
