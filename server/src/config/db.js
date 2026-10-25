const mongoose = require('mongoose');

async function connectDB(uri, { syncIndexes = false } = {}) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must support transactions (replica set required)');
  // Never serve bookings before their unique indexes exist. Production only adds indexes.
  for (const model of Object.values(mongoose.models)) {
    if (syncIndexes) await model.syncIndexes();
    else await model.createIndexes();
  }
}
module.exports = { connectDB };
