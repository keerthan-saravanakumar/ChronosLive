const http = require('node:http');
const { createApp } = require('../src/app');
const { createRealtime } = require('../src/sockets');
const { createOutboxWorker } = require('../src/services/outboxService');
const { setAfterCommit } = require('../src/services/transaction');
const { Service, Slot, Booking, WaitlistEntry } = require('../src/models');
const { env, setupDB, closeDB, makeUser } = require('./helpers');
const { createApi, createChecks, ensure, verifyApi } = require('../../scripts/smoke-deployment.cjs');
const { runWorkflows } = require('../../scripts/smoke-workflows.cjs');

const production = { ...env, NODE_ENV: 'production', CLIENT_URL: 'https://chronos.example' };
const app = createApp(production);
let server, realtime, worker, apiOrigin;
beforeAll(async () => {
  await setupDB();
  server = http.createServer(app);
  realtime = createRealtime(server, production);
  worker = createOutboxWorker({ emit: realtime.emit });
  app.locals.revokeSockets = realtime.revokeUser;
  setAfterCommit(() => worker.drain());
  worker.start();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  apiOrigin = 'http://127.0.0.1:' + server.address().port;
});
afterAll(async () => {
  setAfterCommit(undefined);
  await worker?.stop();
  await realtime?.close();
  await closeDB();
});

test('deployment smoke verifies real HTTP/WebSocket workflows and preserves existing schedules', async () => {
  const owner = await makeUser('organizer');
  const existingService = await Service.create({ organizer: owner.user._id, title: 'Existing service', description: 'Existing data must remain unchanged.', category: 'Labs', location: 'Room 204' });
  const existingSlot = await Slot.create({ service: existingService._id, organizer: owner.user._id, startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 90000000), capacity: 3 });
  const api = createApi(apiOrigin, production.CLIENT_URL);
  const { checks, step } = createChecks();
  const resources = {};
  await verifyApi({ apiOrigin, appOrigin: production.CLIENT_URL, api, step });
  await runWorkflows({ apiOrigin, appOrigin: production.CLIENT_URL, api, step, resources, ensure });
  expect(checks.every(check => check.status === 'passed')).toBe(true);
  expect(resources.cleanupComplete).toBe(true);
  expect(resources.accounts).toHaveLength(5);
  expect(resources.slotIds).toHaveLength(4);
  expect(await Service.findById(resources.serviceId)).toMatchObject({ isActive: false });
  expect(await Slot.countDocuments({ _id: { $in: resources.slotIds }, status: 'cancelled', bookedCount: 0, waitlistCount: 0 })).toBe(4);
  expect(await Booking.countDocuments({ slot: { $in: resources.slotIds }, status: 'confirmed' })).toBe(0);
  expect(await WaitlistEntry.countDocuments({ slot: { $in: resources.slotIds }, status: 'waiting' })).toBe(0);
  expect(await Service.findById(existingService._id)).toMatchObject({ isActive: true });
  expect(await Slot.findById(existingSlot._id)).toMatchObject({ status: 'open', capacity: 3, bookedCount: 0, waitlistCount: 0 });
  expect(JSON.stringify(resources)).not.toMatch(/password|token/i);
});
