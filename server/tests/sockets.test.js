const http = require('node:http');
const request = require('supertest');
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { createRealtime } = require('../src/sockets');
const { createOutboxWorker } = require('../src/services/outboxService');
const { setAfterCommit } = require('../src/services/transaction');
const { Service, Slot, Notification } = require('../src/models');
const { env, setupDB, clearDB, closeDB, makeUser } = require('./helpers');
const app = createApp(env);
let server, realtime, worker, url;
let clients = [];
async function connect(token) {
  const socket = io(url, { auth: { token }, transports: ['websocket'], reconnection: false, autoConnect: false });
  clients.push(socket);
  return new Promise((resolve, reject) => { socket.once('connect', () => resolve(socket)); socket.once('connect_error', reject); socket.connect(); });
}
function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Missing socket event: ' + name)), 5000);
    socket.once(name, payload => { clearTimeout(timeout); resolve(payload); });
  });
}
const subscribe = (socket, kind, id) => new Promise(resolve => socket.emit('room:join', { kind, id: String(id) }, resolve));
beforeAll(async () => {
  await setupDB();
  server = http.createServer(app);
  realtime = createRealtime(server, env);
  worker = createOutboxWorker({ emit: realtime.emit });
  app.locals.revokeSockets = realtime.revokeUser;
  setAfterCommit(() => worker.drain());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = 'http://127.0.0.1:' + server.address().port;
});
beforeEach(async () => { await worker.drain(); await clearDB(); });
afterEach(async () => { for (const client of clients) client.disconnect(); clients = []; await worker.drain(); });
afterAll(async () => { setAfterCommit(undefined); await worker.stop(); await realtime.close(); await closeDB(); });
test('rejects invalid JWTs and arbitrary user-room subscriptions', async () => {
  await expect(connect('invalid')).rejects.toThrow('Authentication required');
  const account = await makeUser();
  const socket = await connect(account.token);
  expect((await subscribe(socket, 'user', account.user._id)).success).toBe(false);
  expect((await subscribe(socket, 'slot', '000000000000000000000001')).error.code).toBe('NOT_FOUND');
});
test('post-commit slot snapshots and private notifications reach only authorized clients', async () => {
  const organizer = await makeUser('organizer'), attendee = await makeUser(), other = await makeUser();
  const service = await Service.create({ organizer: organizer.user._id, title: 'Realtime clinic', description: 'Test live committed updates', category: 'Labs', location: 'Room 204' });
  const slot = await Slot.create({ service: service._id, organizer: organizer.user._id, startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 90000000), capacity: 2 });
  const socket = await connect(attendee.token), observer = await connect(other.token);
  expect((await subscribe(socket, 'slot', slot._id)).success).toBe(true);
  const stolen = jest.fn();
  observer.on('notification:new', stolen);
  const updated = event(socket, 'slot:updated'), notified = event(socket, 'notification:new');
  await request(app).post('/api/slots/' + slot._id + '/book').set('Authorization', 'Bearer ' + attendee.token).send({}).expect(201);
  expect(await updated).toMatchObject({ slotId: String(slot._id), bookedCount: 1, version: 1 });
  expect((await notified).notification.type).toBe('booking_confirmed');
  await worker.drain();
  expect(stolen).not.toHaveBeenCalled();
  expect(await Notification.countDocuments({ user: attendee.user._id })).toBe(1);
  // Disconnected clients recover through authoritative REST state.
  socket.disconnect();
  const current = await request(app).get('/api/slots/' + slot._id).set('Authorization', 'Bearer ' + attendee.token).expect(200);
  expect(current.body.data.myBooking.status).toBe('confirmed');
});
test('logout revokes connected sockets and old tokens', async () => {
  const account = await makeUser();
  const socket = await connect(account.token);
  const ended = event(socket, 'session:ended');
  await request(app).post('/api/auth/logout').set('Authorization', 'Bearer ' + account.token).send({}).expect(200);
  expect((await ended).code).toBe('SESSION_REVOKED');
  await expect(connect(account.token)).rejects.toThrow('Authentication required');
});
test('socket authorization expires without waiting for a reconnect', async () => {
  const account = await makeUser();
  const token = jwt.sign({ ver: 0 }, env.JWT_SECRET, { subject: String(account.user._id), expiresIn: 2 });
  const socket = await connect(token);
  expect((await event(socket, 'session:ended')).code).toBe('SESSION_EXPIRED');
});
