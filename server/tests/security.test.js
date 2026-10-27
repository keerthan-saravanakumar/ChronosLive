const request = require('supertest');
const { createApp } = require('../src/app');
const { env } = require('./helpers');

test('production API sends security headers and only the configured CORS origin', async () => {
  const app = createApp({ ...env, NODE_ENV: 'production', CLIENT_URL: 'https://chronos.example' });
  const response = await request(app).get('/api/health').set('Origin', 'https://untrusted.example').expect(503);
  expect(response.headers['access-control-allow-origin']).toBe('https://chronos.example');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-powered-by']).toBeUndefined();
  expect(response.headers['content-security-policy']).toContain("default-src 'self'");
});

test('production auth throttling rejects request eleven and leaves health available', async () => {
  const app = createApp({ ...env, NODE_ENV: 'production' });
  for (let i = 0; i < 10; i++) await request(app).post('/api/auth/login').send({ email: 'invalid' }).expect(400);
  const response = await request(app).post('/api/auth/login').send({ email: 'invalid' }).expect(429);
  expect(response.body.error.code).toBe('RATE_LIMITED');
  await request(app).get('/api/health').expect(503);
});

test('database outage makes hosting probes fail without consuming the API request quota', async () => {
  const app = createApp({ ...env, NODE_ENV: 'production' });
  const health = await request(app).get('/api/health').expect(503);
  expect(health.body).toMatchObject({ success: false, data: { status: 'degraded', database: 'disconnected' }, error: { code: 'DATABASE_UNAVAILABLE' } });
  expect(health.headers['cache-control']).toBe('no-store');
  expect(health.headers.ratelimit).toBeUndefined();
  let server;
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const client = request('http://127.0.0.1:' + server.address().port);
  try {
    for (let batch = 0; batch < 6; batch++) {
      await Promise.all(Array.from({ length: 50 }, () => client.get('/api/missing').expect(404)));
    }
    await client.get('/api/missing').expect(429);
    await client.get('/api/health').expect(503);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('malformed JSON, oversized bodies and invalid object IDs have safe API errors', async () => {
  const app = createApp(env);
  const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad').expect(400);
  expect(malformed.body.error.code).toBe('INVALID_JSON');
  const oversized = await request(app).post('/api/auth/login').send({ text: 'x'.repeat(40 * 1024) }).expect(413);
  expect(oversized.body.error.code).toBe('BODY_TOO_LARGE');
  const invalidId = await request(app).get('/api/slots/not-a-valid-id').expect(400);
  expect(invalidId.body.error.code).toBe('VALIDATION_ERROR');
  for (const response of [malformed, oversized, invalidId]) expect(response.body.error.stack).toBeUndefined();
});
