const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { readEnv } = require('../src/config/env');
const User = require('../src/models/User');
const { issueToken } = require('../src/services/authService');
let replSet;
const env = readEnv({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://localhost/chronoslive-test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), JWT_EXPIRES_IN: '15m', CLIENT_URL: 'http://localhost:5173' });
async function setupDB() {
  replSet = await MongoMemoryReplSet.create({ binary: { version: '7.0.24', downloadDir: path.resolve(__dirname, '../../.cache/mongodb') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri(), { monitorCommands: true });
  for (const model of Object.values(mongoose.models)) await model.syncIndexes();
}
async function clearDB() { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); }
async function closeDB() { await mongoose.disconnect(); await replSet?.stop(); }
let serial = 0;
async function makeUser(role = 'attendee', extra = {}) {
  const user = await User.create({ name: `Test ${++serial}`, email: `test${serial}@example.test`, role, passwordHash: 'not-used-for-login-in-fixtures', ...extra });
  return { user, token: issueToken(user, env) };
}
module.exports = { env, setupDB, clearDB, closeDB, makeUser };
