const http = require('node:http');
const mongoose = require('mongoose');
const { createApp } = require('./app');
const { readEnv } = require('./config/env');
const { connectDB } = require('./config/db');

async function startServer(env = readEnv()) {
  const app = createApp(env);
  await connectDB(env.MONGODB_URI, { syncIndexes: env.NODE_ENV === 'development' });
  const server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(env.PORT, resolve); });
  console.log(`ChronosLive API listening on port ${env.PORT}`);
  return { app, server, close: async () => { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); } };
}
if (require.main === module) startServer().then(runtime => {
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => runtime.close().then(() => process.exit(0)));
}).catch(error => { console.error('Startup failed:', error.name, error.message.startsWith('Invalid environment') ? error.message : 'Check database connectivity and environment configuration.'); process.exitCode = 1; });
module.exports = { startServer };
