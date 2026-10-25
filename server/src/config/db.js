const mongoose = require('mongoose');

async function connectDB(uri, { syncIndexes = false } = {}) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must support transactions (replica set required)');
  if (syncIndexes) for (const model of Object.values(mongoose.models)) await model.syncIndexes();
}
module.exports = { connectDB };
