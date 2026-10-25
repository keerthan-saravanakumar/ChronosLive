const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { startServer } = require('../src/server');
const { readEnv } = require('../src/config/env');
const { seed } = require('./seed');
const directory = path.resolve(__dirname, '../../.local');
function localSecret(name) {
  const file = path.join(directory, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(24).toString('hex'), { flag: 'wx' });
  return fs.readFileSync(file, 'utf8').trim();
}
(async () => {
  fs.mkdirSync(path.join(directory, 'mongodb'), { recursive: true });
  const replSet = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24', downloadDir: path.resolve(__dirname, '../../.cache/mongodb') },
    instanceOpts: [{ port: 27018, dbPath: path.join(directory, 'mongodb') }],
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const env = readEnv({ ...process.env, NODE_ENV: 'development', MONGODB_URI: replSet.getUri('chronoslive'), JWT_SECRET: process.env.JWT_SECRET || localSecret('jwt-secret'), CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173' });
  const runtime = await startServer(env);
  try {
    const result = await seed(process.env.DEMO_PASSWORD || localSecret('demo-password'));
    console.log('Persistent local replica set ready; ' + result.createdServices + ' demo services added.');
    console.log('Demo account emails are documented; the local demo password is in .local/demo-password (ignored by Git).');
  } catch (error) { console.error('Local seed failed:', error.name, error.code || 'Check the seed configuration'); }
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.close(); await replSet.stop({ doCleanup: false }); process.exit(0); });
})().catch(error => { console.error('Local startup failed:', error.name, error.code || 'Check ports 27018 and 4000'); process.exitCode = 1; });
