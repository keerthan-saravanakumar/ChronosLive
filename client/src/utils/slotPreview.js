export function previewSlots(input, bulk) {
  const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  if (!input.fromDate || !input.startTime || !input.endTime || (bulk && !input.toDate)) return { error: 'Choose dates and a time window.', slots: [] };
  const start = toMinutes(input.startTime), end = toMinutes(input.endTime), minutes = bulk ? Number(input.slotMinutes) : end - start;
  if (end <= start || minutes < 5 || minutes > 240 || (end - start) % minutes !== 0) return { error: 'Use a same-day window that divides into complete slots of 5–240 minutes.', slots: [] };
  if (!Number.isInteger(Number(input.capacity)) || Number(input.capacity) < 1 || Number(input.capacity) > 100) return { error: 'Capacity must be a whole number between 1 and 100.', slots: [] };
  const first = Date.parse(input.fromDate + 'T00:00:00Z'), last = Date.parse((bulk ? input.toDate : input.fromDate) + 'T00:00:00Z');
  if (last < first) return { error: 'The end date must follow the start date.', slots: [] };
  if (last - first > 1400 * 86400000) return { error: 'Create no more than 200 slots at a time.', slots: [] };
  const slots = [];
  for (let day = first; day <= last; day += 86400000) {
    if (bulk && !input.daysOfWeek.includes(new Date(day).getUTCDay())) continue;
    for (let minute = start; minute < end; minute += minutes) {
      const startTime = new Date(day + (minute - 330) * 60000), endTime = new Date(day + (minute + minutes - 330) * 60000);
      if (startTime <= new Date()) return { error: 'Every slot must start in the future.', slots: [] };
      slots.push({ startTime: startTime.toISOString(), endTime: endTime.toISOString(), capacity: Number(input.capacity) });
      if (slots.length > 200) return { error: 'Create no more than 200 slots at a time.', slots: [] };
    }
  }
  return { slots, error: slots.length ? null : 'Select weekdays that fall inside the date range.' };
}
