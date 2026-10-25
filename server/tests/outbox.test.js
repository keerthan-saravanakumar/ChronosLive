const { setupDB, clearDB, closeDB, makeUser } = require('./helpers');
const { OutboxEvent, Notification } = require('../src/models');
const { transaction } = require('../src/services/transaction');
const { notify } = require('../src/services/notificationService');
const { createOutboxWorker } = require('../src/services/outboxService');
beforeAll(setupDB);
beforeEach(clearDB);
afterAll(closeDB);
async function intent() {
  const { user } = await makeUser();
  await transaction(session => notify(user._id, 'reminder', 'Your session starts soon.', undefined, 'test-booking', session));
  return user;
}
test('aborted transactions leave neither notifications nor outbox intent', async () => {
  const { user } = await makeUser();
  await expect(transaction(async session => { await notify(user._id, 'reminder', 'Rollback', undefined, 'rollback', session); throw new Error('abort'); })).rejects.toThrow('abort');
  expect(await OutboxEvent.countDocuments()).toBe(0);
  expect(await Notification.countDocuments()).toBe(0);
});
test.each(['afterClaim', 'afterMaterialize', 'afterEmit'])('worker crash at %s recovers without duplicating notification records', async boundary => {
  await intent();
  expect(await Notification.countDocuments()).toBe(0);
  const emit = jest.fn(async () => {});
  const now = Date.now() + 1000;
  const crash = () => { const error = new Error('process lost'); error.simulatedCrash = true; throw error; };
  const failed = createOutboxWorker({ emit, clock: () => new Date(now), hooks: { [boundary]: crash } });
  await failed.processOne();
  expect(await OutboxEvent.countDocuments({ processedAt: null })).toBe(1);
  const recovered = createOutboxWorker({ emit, clock: () => new Date(now + 31000) });
  await recovered.drain();
  expect(await Notification.countDocuments()).toBe(1);
  expect(await OutboxEvent.countDocuments({ processedAt: null })).toBe(0);
  expect(emit).toHaveBeenCalledTimes(boundary === 'afterEmit' ? 2 : 1);
  if (boundary === 'afterEmit') expect(emit.mock.calls[0][0].payload.eventId).toBe(emit.mock.calls[1][0].payload.eventId);
});
test('competing workers lease the event once and never overwrite a read notification', async () => {
  await intent();
  const emit = jest.fn(async () => {});
  const workers = [createOutboxWorker({ emit }), createOutboxWorker({ emit })];
  await Promise.all(workers.map(w => w.drain()));
  expect(await Notification.countDocuments()).toBe(1);
  expect(emit).toHaveBeenCalledTimes(1);
  await Notification.updateOne({}, { read: true });
  await OutboxEvent.updateOne({}, { processedAt: null, leaseUntil: new Date(0) });
  await workers[0].drain();
  expect((await Notification.findOne()).read).toBe(true);
  expect(await Notification.countDocuments()).toBe(1);
});
