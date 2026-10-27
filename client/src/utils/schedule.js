import { localDate } from './format.js';

export function isUpcomingSlot(slot, now = Date.now()) {
  return slot.status === 'open' && new Date(slot.startTime).getTime() > now;
}

export function groupSlotsByDay(slots) {
  return slots.reduce((groups, slot) => {
    const day = localDate(slot.startTime);
    (groups[day] ||= []).push(slot);
    return groups;
  }, {});
}

export function chooseSlot(slots, preferredId, now = Date.now()) {
  return slots.find(slot => slot._id === preferredId)
    || slots.find(slot => isUpcomingSlot(slot, now))
    || slots[0]
    || null;
}

export function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const length = Math.ceil((leading + days) / 7) * 7;
  return Array.from({ length }, (_, i) => {
    const day = i - leading + 1;
    return day > 0 && day <= days ? new Date(year, month, day) : null;
  });
}

export function bookingStatus(item, waitlist = false, now = Date.now()) {
  if (item.status?.startsWith('cancelled') || item.slot?.status === 'cancelled') return { label: 'Cancelled', tone: 'red' };
  if (item.slot?.status === 'completed' || new Date(item.slot?.endTime).getTime() <= now) return { label: 'Completed', tone: 'gray' };
  if (waitlist) return { label: 'Waitlisted', tone: 'amber' };
  return { label: 'Confirmed', tone: 'green' };
}
