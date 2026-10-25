const { randomUUID } = require('node:crypto');
const { OutboxEvent, Notification } = require('../models');

function createOutboxWorker({ emit, clock = () => new Date(), hooks = {}, leaseMs = 30000 }) {
  let timer, running;
  async function processOne() {
    const now = clock(), leaseToken = randomUUID();
    const event = await OutboxEvent.findOneAndUpdate({
      processedAt: null, nextAttemptAt: { $lte: now }, leaseUntil: { $lte: now },
    }, { $set: { leaseToken, leaseUntil: new Date(+now + leaseMs) }, $inc: { attempts: 1 } }, { new: true, sort: { createdAt: 1, _id: 1 } }).lean();
    if (!event) return false;
    try {
      await hooks.afterClaim?.(event);
      let outgoing = { ...event, payload: { ...event.payload, eventId: event._id } };
      if (event.kind === 'notification') {
        const notification = await Notification.findOneAndUpdate({ eventId: event._id, user: event.recipient }, {
          $setOnInsert: { ...event.payload, eventId: event._id, user: event.recipient, read: false, createdAt: event.createdAt, updatedAt: event.createdAt },
        }, { upsert: true, new: true, timestamps: false }).lean();
        outgoing = { ...outgoing, kind: 'notification:new', payload: { notification, eventId: event._id } };
      }
      await hooks.afterMaterialize?.(event);
      await emit(outgoing);
      await hooks.afterEmit?.(event);
      // Only the current lease holder may acknowledge work; stale workers can emit duplicates.
      await OutboxEvent.updateOne({ _id: event._id, leaseToken }, { $set: { processedAt: clock(), leaseToken: '' } });
    } catch (error) {
      // A crash leaves the lease intact. Tests use this boundary to emulate process death.
      if (!error.simulatedCrash) await OutboxEvent.updateOne({ _id: event._id, leaseToken }, {
        $set: { leaseToken: '', leaseUntil: new Date(0), nextAttemptAt: new Date(+clock() + Math.min(60000, 1000 * 2 ** Math.min(event.attempts, 6))), lastError: error.code || error.name || 'DeliveryError' },
      });
    }
    return true;
  }
  async function drain(max = 100) {
    if (running) return running;
    running = (async () => { for (let i = 0; i < max; i++) if (!await processOne()) break; })();
    try { await running; } finally { running = undefined; }
  }
  function start() { timer = setInterval(() => drain().catch(() => console.error('Outbox polling failed')), 1000); timer.unref(); void drain().catch(() => {}); }
  async function stop() { clearInterval(timer); await running; }
  return { processOne, drain, start, stop };
}
module.exports = { createOutboxWorker };
