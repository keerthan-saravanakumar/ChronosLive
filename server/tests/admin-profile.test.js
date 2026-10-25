const request = require('supertest');
const { createApp } = require('../src/app');
const { env, setupDB, clearDB, closeDB, makeUser } = require('./helpers');
const { Service, Slot, Booking, Notification, User } = require('../src/models');
const app = createApp(env);
const as = account => 'Bearer ' + account.token;
beforeAll(setupDB);
beforeEach(clearDB);
afterAll(closeDB);
test('profile updates whitelist fields and never expose hashes or auth versions', async () => {
  const account = await makeUser();
  const response = await request(app).patch('/api/users/me').set('Authorization', as(account)).send({ name: 'Updated name' }).expect(200);
  expect(response.body.data.name).toBe('Updated name');
  expect(response.body.data.passwordHash).toBeUndefined();
  expect(response.body.data.authVersion).toBeUndefined();
  await request(app).patch('/api/users/me').set('Authorization', as(account)).send({ role: 'admin' }).expect(400);
});
test('admin deactivation and reactivation do not revive previously issued tokens', async () => {
  const admin = await makeUser('admin'), user = await makeUser(), other = await makeUser();
  const url = '/api/admin/users/' + user.user._id + '/status';
  await request(app).patch(url).set('Authorization', as(other)).send({ isActive: false }).expect(403);
  await request(app).patch(url).set('Authorization', as(admin)).send({ isActive: false }).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', as(user)).expect(401);
  await request(app).patch(url).set('Authorization', as(admin)).send({ isActive: true }).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', as(user)).expect(401);
  await request(app).patch('/api/admin/users/' + admin.user._id + '/status').set('Authorization', as(admin)).send({ isActive: false }).expect(409);
  const list = await request(app).get('/api/admin/users').set('Authorization', as(admin)).expect(200);
  expect(list.body.data.every(u => !u.passwordHash && u.authVersion === undefined)).toBe(true);
});
test('image validation rejects disguised files, unsupported formats and oversized uploads', async () => {
  const account = await makeUser();
  const url = '/api/users/me';
  await request(app).patch(url).set('Authorization', as(account)).attach('avatar', Buffer.from('<svg/>'), { filename: 'a.svg', contentType: 'image/svg+xml' }).expect(400);
  await request(app).patch(url).set('Authorization', as(account)).attach('avatar', Buffer.from('not an image'), { filename: 'a.png', contentType: 'image/png' }).expect(400);
  await request(app).patch(url).set('Authorization', as(account)).attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), { filename: 'a.png', contentType: 'image/png' }).expect(400);
});
test('valid image requests report missing Cloudinary configuration honestly', async () => {
  const account = await makeUser();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrXkAAAAASUVORK5CYII=', 'base64');
  const response = await request(app).patch('/api/users/me').set('Authorization', as(account)).attach('avatar', png, { filename: 'one.png', contentType: 'image/png' }).expect(503);
  expect(response.body.error.code).toBe('UPLOAD_UNAVAILABLE');
  expect((await User.findById(account.user._id)).avatarUrl).toBe('');
});
test('notifications can only be read by their recipient', async () => {
  const owner = await makeUser(), other = await makeUser();
  const notification = await Notification.create({ user: owner.user._id, eventId: 'private', type: 'reminder', message: 'Private notification' });
  await request(app).patch('/api/notifications/' + notification._id + '/read').set('Authorization', as(other)).send({}).expect(404);
  await request(app).patch('/api/notifications/' + notification._id + '/read').set('Authorization', as(owner)).send({}).expect(200);
  expect((await Notification.findById(notification._id)).read).toBe(true);
});
test('organizer statistics aggregate only the owner’s sessions', async () => {
  const organizer = await makeUser('organizer'), other = await makeUser('organizer'), attendee = await makeUser();
  const service = await Service.create({ organizer: organizer.user._id, title: 'Stats service', description: 'Aggregate real reservations', category: 'Labs', location: 'Room' });
  const slot = await Slot.create({ service: service._id, organizer: organizer.user._id, startTime: new Date(Date.now() + 86400000), endTime: new Date(Date.now() + 90000000), capacity: 4, bookedCount: 1 });
  await Booking.create({ slot: slot._id, service: service._id, user: attendee.user._id, source: 'waitlist_promotion' });
  const stats = await request(app).get('/api/organizer/stats').set('Authorization', as(organizer)).expect(200);
  expect(stats.body.data).toMatchObject({ upcomingSlots: 1, bookedSeats: 1, totalSeats: 4, fillRate: 25, promotions: 1, activeServices: 1 });
  expect((await request(app).get('/api/organizer/stats').set('Authorization', as(other)).expect(200)).body.data.upcomingSlots).toBe(0);
  await request(app).get('/api/organizer/stats').set('Authorization', as(attendee)).expect(403);
});
