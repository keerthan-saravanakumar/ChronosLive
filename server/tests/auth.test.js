const request = require('supertest');
const { createApp } = require('../src/app');
const { env, setupDB, clearDB, closeDB, makeUser } = require('./helpers');
const User = require('../src/models/User');
const { readEnv } = require('../src/config/env');
const app = createApp(env);
beforeAll(setupDB);
beforeEach(clearDB);
afterAll(closeDB);

test('register, login, me and all-session logout; password is never exposed', async () => {
  const account = { name: 'Example Attendee', email: 'ATTENDEE@example.test', password: 'example-passphrase', role: 'attendee' };
  const created = await request(app).post('/api/auth/register').send(account).expect(201);
  expect(created.body.data.user.passwordHash).toBeUndefined();
  expect(created.body.data.user.email).toBe('attendee@example.test');
  const user = await User.findById(created.body.data.user._id).select('+passwordHash');
  expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  const login = await request(app).post('/api/auth/login').send({ email: account.email, password: account.password }).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.token}`).expect(200);
  await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${created.body.data.token}`).send({}).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.token}`).expect(401);
});
test('duplicate email and incorrect passwords have specific errors', async () => {
  const account = { name: 'Test User', email: 'test@example.test', password: 'valid-password' };
  await request(app).post('/api/auth/register').send(account).expect(201);
  const duplicate = await request(app).post('/api/auth/register').send(account).expect(409);
  expect(duplicate.body.error.code).toBe('EMAIL_EXISTS');
  await request(app).post('/api/auth/login').send({ email: account.email, password: 'incorrect' }).expect(401);
});
test('rejects missing tokens, role escalation and invalid fields', async () => {
  await request(app).get('/api/auth/me').expect(401);
  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'a@example.test', password: 'password-value', role: 'admin' }).expect(400);
  await request(app).post('/api/auth/register').send({ name: 'Valid', email: 'a@example.test', password: 'password-value', isActive: false }).expect(400);
  const { token, user } = await makeUser();
  await User.updateOne({ _id: user._id }, { isActive: false, $inc: { authVersion: 1 } });
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
});
test('environment validation fails without exposing supplied secrets', () => {
  expect(() => readEnv({ JWT_SECRET: 'tiny-secret' })).toThrow('Invalid environment variables');
  expect(() => readEnv({ JWT_SECRET: 'tiny-secret' })).not.toThrow('tiny-secret');
});
