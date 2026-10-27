const path = require('node:path');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { startServer } = require('../src/server');
const { env } = require('./helpers');

let replSet, runtime;
afterAll(async () => {
  try {
    if (runtime) await runtime.close();
    else await mongoose.disconnect();
  } finally {
    await replSet?.stop();
  }
});

test('the local launcher can import, start and close the complete server runtime', async () => {
  // Importing the entry point must not start a database connection or listener.
  expect(mongoose.connection.readyState).toBe(0);
  replSet = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24', downloadDir: path.resolve(__dirname, '../../.cache/mongodb') },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  runtime = await startServer({ ...env, MONGODB_URI: replSet.getUri('startup-test'), PORT: 0 });
  const response = await request(runtime.server).get('/api/health').expect(200);
  expect(response.body).toMatchObject({ success: true, data: { status: 'ok', database: 'connected' } });
  expect(runtime.server.listening).toBe(true);

  const server = runtime.server;
  await runtime.close();
  runtime = null;
  expect(server.listening).toBe(false);
  expect(mongoose.connection.readyState).toBe(0);
});
