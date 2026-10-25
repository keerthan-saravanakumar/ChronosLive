const request = require('supertest');
const { createApp } = require('../src/app');
const { env, setupDB, clearDB, closeDB, makeUser } = require('./helpers');
const { Service, Slot } = require('../src/models');
const slotService = require('../src/services/slotService');
const { generateSlots } = require('../src/utils/time');
const app = createApp(env);
let owner, other, attendee, service;
const future = hours => new Date(Date.now() + hours * 3600000).toISOString();
const interval = (a = 48, b = 49) => ({ startTime: future(a), endTime: future(b), capacity: 3 });
const as = user => 'Bearer ' + user.token;
beforeAll(setupDB);
beforeEach(async () => {
  await clearDB();
  owner = await makeUser('organizer'); other = await makeUser('organizer'); attendee = await makeUser();
  service = await Service.create({ organizer: owner.user._id, title: 'Office hours', description: 'Database questions and mentoring', category: 'Office hours', location: 'Room 204' });
});
afterAll(closeDB);
test('ownership and role checks protect creation, edits and roster', async () => {
  const url = '/api/services/' + service._id + '/slots';
  await request(app).post(url).set('Authorization', as(attendee)).send(interval()).expect(403);
  await request(app).post(url).set('Authorization', as(other)).send(interval()).expect(403);
  const created = await request(app).post(url).set('Authorization', as(owner)).send(interval()).expect(201);
  await request(app).get('/api/slots/' + created.body.data._id + '/roster').set('Authorization', as(other)).expect(403);
  await request(app).patch('/api/services/' + service._id).set('Authorization', as(other)).send({ title: 'Hijacked' }).expect(403);
});
test('single slot boundaries allow adjacency and reject overlap', async () => {
  const url = '/api/services/' + service._id + '/slots';
  const first = interval();
  await request(app).post(url).set('Authorization', as(owner)).send(first).expect(201);
  const conflict = await request(app).post(url).set('Authorization', as(owner)).send(first).expect(409);
  expect(conflict.body.error.details.conflicts).toHaveLength(1);
  await request(app).post(url).set('Authorization', as(owner)).send({ startTime: first.endTime, endTime: future(50), capacity: 3 }).expect(201);
  await request(app).post(url).set('Authorization', as(owner)).send(interval(-2, -1)).expect(400);
  expect(await Slot.countDocuments()).toBe(2);
});
test('concurrent creation across two services of the same organizer cannot overlap', async () => {
  const second = await Service.create({ organizer: owner.user._id, title: 'Second service', description: 'Independent service same organizer', category: 'Labs', location: 'Room 205' });
  const data = interval();
  const results = await Promise.all([service, second].map(s => request(app).post('/api/services/' + s._id + '/slots').set('Authorization', as(owner)).send(data)));
  expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  expect(await Slot.countDocuments()).toBe(1);
});
test('bulk conflict rolls back every slot; internal conflicts also reject the whole batch', async () => {
  const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const data = { daysOfWeek: [new Date(day).getUTCDay()], fromDate: day, toDate: day, startTime: '15:00', endTime: '16:00', slotMinutes: 20, capacity: 3 };
  const generated = generateSlots(data);
  await request(app).post('/api/services/' + service._id + '/slots').set('Authorization', as(owner)).send({ ...generated[1], startTime: generated[1].startTime.toISOString(), endTime: generated[1].endTime.toISOString() }).expect(201);
  await request(app).post('/api/services/' + service._id + '/slots/bulk').set('Authorization', as(owner)).send(data).expect(409);
  expect(await Slot.countDocuments()).toBe(1);
  const context = { user: owner.user, claims: { ver: 0 } };
  await expect(slotService.createSlots(service._id, [generated[0], generated[0]], context)).rejects.toMatchObject({ code: 'SLOT_OVERLAP' });
  expect(await Slot.countDocuments()).toBe(1);
});
test('IST recurrence is inclusive, exact and bounded; clock filtering matches it', async () => {
  const day = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
  const data = { daysOfWeek: [new Date(day).getUTCDay()], fromDate: day, toDate: day, startTime: '15:00', endTime: '16:00', slotMinutes: 20, capacity: 3 };
  const generated = generateSlots(data);
  expect(generated).toHaveLength(3);
  expect(generated[0].startTime.toISOString()).toBe(day + 'T09:30:00.000Z');
  expect(() => generateSlots({ ...data, slotMinutes: 25 })).toThrow('divide exactly');
  expect(() => generateSlots({ ...data, fromDate: '2030-01-01', toDate: '2031-01-01', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })).toThrow('200');
  await request(app).post('/api/services/' + service._id + '/slots/bulk').set('Authorization', as(owner)).send(data).expect(201);
  const result = await request(app).get('/api/services/' + service._id + '/slots?timeFrom=15:20&timeTo=15:40').expect(200);
  expect(result.body.data).toHaveLength(1);
});
