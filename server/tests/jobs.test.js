const request = require('supertest');
const { createApp } = require('../src/app');
const { env, setupDB, clearDB, closeDB, makeUser } = require('./helpers');
const { Service, Slot, Booking, WaitlistEntry, OutboxEvent, Notification } = require('../src/models');
const { runMaintenance } = require('../src/jobs/maintenance');
const { createOutboxWorker } = require('../src/services/outboxService');
const { transaction } = require('../src/services/transaction');
const { guardSlot } = require('../src/services/guards');
const app = createApp(env);
const as = account => 'Bearer ' + account.token;
beforeAll(setupDB);
beforeEach(clearDB);
afterAll(closeDB);

async function fixture(startMinutes, endMinutes) {
  const organizer = await makeUser('organizer'), attendee = await makeUser(), waiter = await makeUser();
  const service = await Service.create({ organizer: organizer.user._id, title: 'Maintenance session', description: 'Real reminders and lifecycle state', category: 'Labs', location: 'Room', policy: { cancellationCutoffMinutes: 0 } });
  const now = new Date();
  const slot = await Slot.create({ service: service._id, organizer: organizer.user._id, startTime: new Date(+now + startMinutes * 60000), endTime: new Date(+now + endMinutes * 60000), capacity: 1, bookedCount: 1, waitlistCount: 1 });
  const booking = await Booking.create({ slot: slot._id, service: service._id, user: attendee.user._id });
  const entry = await WaitlistEntry.create({ slot: slot._id, user: waiter.user._id });
  return { organizer, attendee, waiter, service, slot, booking, entry, now };
}

test('overlapping job runs complete ended slots once and preserve historical bookings', async () => {
  const f = await fixture(-60, -5);
  const results = await Promise.all([runMaintenance(), runMaintenance()]);
  expect(results.reduce((total, result) => total + result.completed, 0)).toBe(1);
  expect(await Slot.findById(f.slot._id)).toMatchObject({ status: 'completed', bookedCount: 1, waitlistCount: 0 });
  expect((await WaitlistEntry.findById(f.entry._id)).status).toBe('expired');
  expect((await Booking.findById(f.booking._id)).status).toBe('confirmed');
  expect(await OutboxEvent.countDocuments({ kind: 'slot:updated' })).toBe(1);
  expect(await runMaintenance()).toEqual({ completed: 0, reminders: 0 });
});

test('concurrent reminders and worker restarts create exactly one durable notification', async () => {
  const f = await fixture(30, 60);
  const results = await Promise.all([runMaintenance(), runMaintenance(), runMaintenance()]);
  expect(results.reduce((total, result) => total + result.reminders, 0)).toBe(1);
  expect((await Booking.findById(f.booking._id)).reminderSent).toBe(true);
  expect(await OutboxEvent.countDocuments({ kind: 'notification' })).toBe(1);
  expect(await Notification.countDocuments()).toBe(0); // No worker before the simulated restart.
  await createOutboxWorker({ emit: async () => {} }).drain();
  await runMaintenance();
  await createOutboxWorker({ emit: async () => {} }).drain();
  expect(await Notification.countDocuments({ user: f.attendee.user._id, type: 'reminder' })).toBe(1);
});

test('reminders exclude started, distant and cancelled bookings', async () => {
  const started = await fixture(-1, 30), distant = await fixture(61, 90), cancelled = await fixture(30, 60);
  await Booking.updateOne({ _id: cancelled.booking._id }, { $set: { status: 'cancelled' } });
  expect(await runMaintenance()).toEqual({ completed: 0, reminders: 0 });
  expect(await OutboxEvent.countDocuments()).toBe(0);
  for (const f of [started, distant, cancelled]) expect((await Booking.findById(f.booking._id)).reminderSent).toBe(false);
});

test('a reminder waits for a held cancellation guard and rechecks the committed booking', async () => {
  const f = await fixture(30, 60);
  let release, locked;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { locked = resolve; });
  const cancellation = transaction(async session => {
    await guardSlot(f.slot._id, session);
    locked();
    await gate;
    await Booking.updateOne({ _id: f.booking._id }, { $set: { status: 'cancelled' } }, { session });
    await Slot.updateOne({ _id: f.slot._id }, { $set: { bookedCount: 0 } }, { session });
  });
  await ready;
  const mongoose = require('mongoose');
  let sawAttempt;
  const attempted = new Promise(resolve => { sawAttempt = resolve; });
  const onCommand = event => { if (event.commandName === 'findAndModify' && event.command.findAndModify === 'services') sawAttempt(); };
  mongoose.connection.getClient().on('commandStarted', onCommand);
  const job = runMaintenance();
  try { await attempted; } finally { release(); mongoose.connection.getClient().off('commandStarted', onCommand); }
  await Promise.all([cancellation, job]);
  expect(await OutboxEvent.countDocuments({ kind: 'notification' })).toBe(0);
  expect((await Booking.findById(f.booking._id)).reminderSent).toBe(false);
});

test('query-time safety rejects bookings and waitlists even when cron has never run', async () => {
  const f = await fixture(-1, 30);
  const outsider = await makeUser();
  for (const action of ['book', 'waitlist']) {
    const response = await request(app).post('/api/slots/' + f.slot._id + '/' + action).set('Authorization', as(outsider)).send({}).expect(409);
    expect(response.body.error.code).toBe('SLOT_IN_PAST');
  }
  const result = await request(app).get('/api/services/' + f.service._id + '/slots?availableOnly=true&from=' + encodeURIComponent(new Date(+f.now - 86400000).toISOString())).expect(200);
  expect(result.body.data).toHaveLength(0);
  expect((await Slot.findById(f.slot._id)).status).toBe('open');
});

test('date range validation compares instants across different UTC offsets', async () => {
  const f = await fixture(30, 60);
  const url = '/api/services/' + f.service._id + '/slots';
  await request(app).get(url).query({ from: '2030-01-01T10:00:00+05:30', to: '2030-01-01T06:00:00Z' }).expect(200);
  await request(app).get(url).query({ from: '2030-01-01T06:00:00Z', to: '2030-01-01T10:00:00+05:30' }).expect(400);
});
