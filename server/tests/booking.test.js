const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { env, setupDB, clearDB, closeDB, makeUser } = require('./helpers');
const { Service, Slot, Booking, WaitlistEntry, User } = require('../src/models');
const app = createApp(env), secondApp = createApp(env);
const as = account => 'Bearer ' + account.token;
let owner, service, slot;
const book = (account, target = slot, application = app) => request(application).post('/api/slots/' + target._id + '/book').set('Authorization', as(account)).send({});
const join = (account, target = slot) => request(app).post('/api/slots/' + target._id + '/waitlist').set('Authorization', as(account)).send({});
const cancel = (account, bookingId) => request(app).delete('/api/bookings/' + bookingId).set('Authorization', as(account)).send({});
async function newService(extra = {}, organizer = owner) {
  return Service.create({ organizer: organizer.user._id, title: 'Test Office Hours', description: 'Appointments for database questions', category: 'Office hours', location: 'Room 204', policy: { maxActiveBookingsPerUser: 50, cancellationCutoffMinutes: 30 }, ...extra });
}
async function newSlot(targetService = service, extra = {}) {
  return Slot.create({ service: targetService._id, organizer: targetService.organizer, startTime: new Date(Date.now() + 48 * 3600000), endTime: new Date(Date.now() + 49 * 3600000), capacity: 5, ...extra });
}
async function assertCounts(target = slot) {
  const stored = await Slot.findById(target._id);
  expect(stored.bookedCount).toBe(await Booking.countDocuments({ slot: target._id, status: 'confirmed' }));
  expect(stored.waitlistCount).toBe(await WaitlistEntry.countDocuments({ slot: target._id, status: 'waiting' }));
  expect(stored.bookedCount).toBeGreaterThanOrEqual(0);
  expect(stored.bookedCount).toBeLessThanOrEqual(stored.capacity);
  expect(stored.waitlistCount).toBeGreaterThanOrEqual(0);
}
beforeAll(setupDB);
beforeEach(async () => { await clearDB(); owner = await makeUser('organizer'); service = await newService(); slot = await newSlot(); });
afterAll(closeDB);

test('20 parallel users compete for 5 seats across independent app instances', async () => {
  const users = await Promise.all(Array.from({ length: 20 }, () => makeUser()));
  const results = await Promise.all(users.map((u, i) => book(u, slot, i % 2 ? app : secondApp)));
  expect(results.filter(r => r.status === 201)).toHaveLength(5);
  expect(results.filter(r => r.status === 409 && r.body.error.code === 'SLOT_FULL')).toHaveLength(15);
  await assertCounts();
});
test('5 parallel requests from the same user create exactly one booking', async () => {
  const user = await makeUser();
  const results = await Promise.all(Array.from({ length: 5 }, () => book(user)));
  expect(results.filter(r => r.status === 201)).toHaveLength(1);
  expect(results.filter(r => r.body.error?.code === 'ALREADY_BOOKED')).toHaveLength(4);
  await assertCounts();
});
test('per-service user limit holds across distinct non-overlapping slots', async () => {
  await Service.updateOne({ _id: service._id }, { 'policy.maxActiveBookingsPerUser': 1 });
  const later = await newSlot(service, { startTime: new Date(+slot.endTime + 3600000), endTime: new Date(+slot.endTime + 7200000) });
  const user = await makeUser();
  const results = await Promise.all([book(user), book(user, later, secondApp)]);
  expect(results.filter(r => r.status === 201)).toHaveLength(1);
  expect(results.filter(r => r.body.error?.code === 'BOOKING_LIMIT_REACHED')).toHaveLength(1);
  await assertCounts(); await assertCounts(later);
});
test('cross-service overlap is serialized by the shared User document', async () => {
  const otherOwner = await makeUser('organizer');
  const other = await newSlot(await newService({}, otherOwner), { startTime: slot.startTime, endTime: slot.endTime });
  const user = await makeUser();
  const results = await Promise.all([book(user), book(user, other, secondApp)]);
  expect(results.filter(r => r.status === 201)).toHaveLength(1);
  expect(results.filter(r => r.body.error?.code === 'TIME_CONFLICT')).toHaveLength(1);
  await assertCounts(); await assertCounts(other);
});
test('adjacent bookings are permitted', async () => {
  const other = await newSlot(service, { startTime: slot.endTime, endTime: new Date(+slot.endTime + 3600000) });
  const user = await makeUser();
  await book(user).expect(201);
  await book(user, other).expect(201);
});
test('a held user write forces a fresh eligibility snapshot before the competing booking commits', async () => {
  const account = await makeUser();
  const otherOwner = await makeUser('organizer');
  const other = await newSlot(await newService({}, otherOwner), { startTime: slot.startTime, endTime: slot.endTime });
  const session = await mongoose.startSession();
  const client = mongoose.connection.getClient();
  let listener, timeout;
  try {
    session.startTransaction();
    await Service.updateOne({ _id: other.service }, { $inc: { revision: 1 } }, { session });
    await Slot.updateOne({ _id: other._id }, { $inc: { version: 1, bookedCount: 1 } }, { session });
    await User.updateOne({ _id: account.user._id }, { $inc: { bookingRevision: 1 } }, { session });
    await Booking.create([{ user: account.user._id, slot: other._id, service: other.service }], { session });
    const attempted = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Contender never attempted its user guard')), 5000);
      listener = event => {
        if (event.commandName === 'findAndModify' && event.command.findAndModify === 'users' && String(event.command.query._id) === String(account.user._id)) { clearTimeout(timeout); resolve(); }
      };
      client.on('commandStarted', listener);
    });
    const contender = book(account).then(response => response);
    await attempted;
    await session.commitTransaction();
    const response = await contender;
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TIME_CONFLICT');
    await assertCounts(); await assertCounts(other);
  } finally {
    clearTimeout(timeout);
    if (listener) client.off('commandStarted', listener);
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
  }
});
test('FIFO promotion skips conflicting users with a reason', async () => {
  await Slot.updateOne({ _id: slot._id }, { capacity: 1 });
  const [holder, first, second] = await Promise.all([makeUser(), makeUser(), makeUser()]);
  const booking = await book(holder).expect(201);
  expect((await join(first).expect(201)).body.data.position).toBe(1);
  expect((await join(second).expect(201)).body.data.position).toBe(2);
  const otherOwner = await makeUser('organizer');
  const other = await newSlot(await newService({}, otherOwner));
  await book(first, other).expect(201);
  await cancel(holder, booking.body.data._id).expect(200);
  expect(await WaitlistEntry.findOne({ slot: slot._id, user: first.user._id }).lean()).toMatchObject({ status: 'skipped', skipReason: 'TIME_CONFLICT' });
  expect(await Booking.findOne({ slot: slot._id, user: second.user._id }).lean()).toMatchObject({ status: 'confirmed', source: 'waitlist_promotion' });
  await assertCounts();
});
test('capacity increase promotes two; lowering below booked count is rejected', async () => {
  await Slot.updateOne({ _id: slot._id }, { capacity: 1 });
  const [holder, first, second] = await Promise.all([makeUser(), makeUser(), makeUser()]);
  await book(holder).expect(201); await join(first).expect(201); await join(second).expect(201);
  await request(app).patch('/api/slots/' + slot._id).set('Authorization', as(owner)).send({ capacity: 3 }).expect(200);
  expect(await Booking.countDocuments({ slot: slot._id, source: 'waitlist_promotion' })).toBe(2);
  await request(app).patch('/api/slots/' + slot._id).set('Authorization', as(owner)).send({ capacity: 2 }).expect(409);
  await assertCounts();
});
test('simultaneous cancellation and direct booking cannot bypass an eligible waiter', async () => {
  await Slot.updateOne({ _id: slot._id }, { capacity: 1 });
  const [holder, waiter, newcomer] = await Promise.all([makeUser(), makeUser(), makeUser()]);
  const booking = await book(holder).expect(201);
  await join(waiter).expect(201);
  const results = await Promise.all([cancel(holder, booking.body.data._id), book(newcomer)]);
  expect(results[0].status).toBe(200);
  expect(results[1].body.error.code).toBe('SLOT_FULL');
  expect(await Booking.countDocuments({ slot: slot._id, user: waiter.user._id, status: 'confirmed' })).toBe(1);
  await assertCounts();
});
test('double cancellation decrements and promotes only once', async () => {
  const holder = await makeUser();
  const booking = await book(holder).expect(201);
  const results = await Promise.all([cancel(holder, booking.body.data._id), cancel(holder, booking.body.data._id)]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  await assertCounts();
});
test('simultaneous promotions into overlapping slots cannot double-book a user', async () => {
  await Slot.updateOne({ _id: slot._id }, { capacity: 1 });
  const otherOwner = await makeUser('organizer');
  const other = await newSlot(await newService({}, otherOwner), { startTime: slot.startTime, endTime: slot.endTime, capacity: 1 });
  const [holder1, holder2, waiter] = await Promise.all([makeUser(), makeUser(), makeUser()]);
  const b1 = await book(holder1).expect(201), b2 = await book(holder2, other).expect(201);
  await join(waiter).expect(201); await join(waiter, other).expect(201);
  await Promise.all([cancel(holder1, b1.body.data._id).expect(200), cancel(holder2, b2.body.data._id).expect(200)]);
  expect(await Booking.countDocuments({ user: waiter.user._id, status: 'confirmed' })).toBe(1);
  expect(await WaitlistEntry.countDocuments({ user: waiter.user._id, status: 'skipped', skipReason: 'TIME_CONFLICT' })).toBe(1);
  await assertCounts(); await assertCounts(other);
});
test('waitlist joins, departures and inactive-user skips preserve counts', async () => {
  const [holder, waiter, next] = await Promise.all([makeUser(), makeUser(), makeUser()]);
  await join(waiter).expect(409);
  await Slot.updateOne({ _id: slot._id }, { capacity: 1 });
  const booking = await book(holder).expect(201);
  const joins = await Promise.all([join(waiter), join(waiter)]);
  expect(joins.map(r => r.status).sort()).toEqual([201, 409]);
  await join(next).expect(201);
  await User.updateOne({ _id: waiter.user._id }, { isActive: false, $inc: { authVersion: 1 } });
  await cancel(holder, booking.body.data._id).expect(200);
  expect(await WaitlistEntry.findOne({ user: waiter.user._id }).lean()).toMatchObject({ status: 'skipped', skipReason: 'INACTIVE_USER' });
  await assertCounts();
});
test('organizer restrictions, cancellation window and cancellation statuses follow the spec', async () => {
  await book(owner).expect(403); await join(owner).expect(403);
  const otherOrganizer = await makeUser('organizer'), stranger = await makeUser();
  const near = await newSlot(service, { startTime: new Date(Date.now() + 10 * 60000), endTime: new Date(Date.now() + 30 * 60000) });
  const booking = await book(otherOrganizer, near).expect(201);
  await cancel(stranger, booking.body.data._id).expect(403);
  await cancel(otherOrganizer, booking.body.data._id).expect(409);
  expect((await cancel(owner, booking.body.data._id).expect(200)).body.data.status).toBe('cancelled');
});
test('slot cancellation cascades atomically and keeps ownership restrictions', async () => {
  await Slot.updateOne({ _id: slot._id }, { capacity: 1 });
  const [holder, waiter, otherOwner] = await Promise.all([makeUser(), makeUser(), makeUser('organizer')]);
  await book(holder).expect(201); await join(waiter).expect(201);
  const url = '/api/slots/' + slot._id + '/cancel';
  await request(app).post(url).set('Authorization', as(otherOwner)).send({}).expect(403);
  await request(app).post(url).set('Authorization', as(owner)).send({ reason: 'Session postponed' }).expect(200);
  expect(await Booking.findOne({ slot: slot._id }).lean()).toMatchObject({ status: 'cancelled_by_organizer' });
  expect(await WaitlistEntry.findOne({ slot: slot._id }).lean()).toMatchObject({ status: 'expired' });
  await assertCounts();
});
test('archived services block new entrants while honoring existing waitlists', async () => {
  await Slot.updateOne({ _id: slot._id }, { capacity: 1 });
  const [holder, waiter, stranger] = await Promise.all([makeUser(), makeUser(), makeUser()]);
  const booking = await book(holder).expect(201); await join(waiter).expect(201);
  await request(app).delete('/api/services/' + service._id).set('Authorization', as(owner)).send({}).expect(200);
  await book(stranger).expect(409); await join(stranger).expect(409);
  await cancel(holder, booking.body.data._id).expect(200);
  expect(await Booking.countDocuments({ slot: slot._id, user: waiter.user._id, status: 'confirmed' })).toBe(1);
  await assertCounts();
});
