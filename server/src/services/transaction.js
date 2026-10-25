const mongoose = require('mongoose');
let afterCommit;
function setAfterCommit(callback) { afterCommit = callback; }
async function transaction(work) {
  const session = await mongoose.startSession();
  try {
    // The driver retries the entire callback on a write conflict. Never emit here.
    const result = await session.withTransaction(() => work(session), {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 10000,
    });
    if (afterCommit) queueMicrotask(() => Promise.resolve(afterCommit()).catch(() => {}));
    return result;
  } finally { await session.endSession(); }
}
module.exports = { transaction, setAfterCommit };
