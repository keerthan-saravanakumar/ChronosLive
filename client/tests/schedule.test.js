import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingStatus, chooseSlot, groupSlotsByDay, isUpcomingSlot, monthCells } from '../src/utils/schedule.js';

const at = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const now = new Date(2026, 9, 27, 12).getTime();
const slot = (id, day, extra = {}) => ({ _id: id, startTime: at(day), endTime: at(day, 11), status: 'open', capacity: 2, bookedCount: 0, ...extra });

test('calendar uses Monday-first weeks and includes the leap day', () => {
  const cells = monthCells(2028, 1);
  assert.equal(cells[0], null);
  assert.equal(cells[1].getDate(), 1);
  assert.equal(cells.filter(Boolean).length, 29);
  assert.equal(cells.filter(Boolean).at(-1).getDate(), 29);
  assert.equal(cells.length % 7, 0);
});

test('calendar month navigation rolls into the next year', () => {
  const january = monthCells(2026, 12).filter(Boolean);
  assert.equal(january.length, 31);
  assert.equal(january[0].getFullYear(), 2027);
  assert.equal(january[0].getMonth(), 0);
});

test('session groups follow local calendar days across midnight', () => {
  const late = slot('late', 27, { startTime: new Date(2026, 9, 27, 23, 45).toISOString() });
  const early = slot('early', 28, { startTime: new Date(2026, 9, 28, 0, 15).toISOString() });
  const groups = groupSlotsByDay([late, early]);
  assert.deepEqual(Object.keys(groups), ['2026-10-27', '2026-10-28']);
  assert.equal(groups['2026-10-28'][0]._id, 'early');
});

test('live availability changes preserve the selected slot, including a newly full slot', () => {
  const selected = slot('selected', 28, { bookedCount: 2 });
  const other = slot('other', 28);
  assert.equal(chooseSlot([other, selected], 'selected', now), selected);
});

test('initial selection skips past and cancelled sessions', () => {
  const slots = [slot('past', 27), slot('cancelled', 28, { status: 'cancelled' }), slot('next', 29)];
  assert.equal(chooseSlot(slots, null, now)._id, 'next');
  assert.equal(isUpcomingSlot(slots[0], now), false);
  assert.equal(isUpcomingSlot(slots[1], now), false);
});

test('changing the visible day cannot retain a slot outside the returned results', () => {
  assert.equal(chooseSlot([slot('new-day', 29)], 'old-day', now)._id, 'new-day');
  assert.equal(chooseSlot([], 'removed', now), null);
});

test('history shows completed sessions rather than an active confirmation', () => {
  assert.deepEqual(bookingStatus({ status: 'confirmed', slot: slot('past', 27) }, false, now), { label: 'Completed', tone: 'gray' });
});

test('cancellations take precedence over elapsed session time', () => {
  assert.deepEqual(bookingStatus({ status: 'cancelled_by_organizer', slot: slot('past', 27) }, false, now), { label: 'Cancelled', tone: 'red' });
});

test('upcoming waitlists remain distinct from confirmed bookings', () => {
  const item = { slot: slot('future', 28) };
  assert.equal(bookingStatus(item, true, now).label, 'Waitlisted');
  assert.equal(bookingStatus(item, false, now).label, 'Confirmed');
});
