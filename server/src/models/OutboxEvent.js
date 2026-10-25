const { Schema, model } = require('mongoose');
const schema = new Schema({
  _id: String,
  kind: { type: String, required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User' },
  payload: { type: Schema.Types.Mixed, required: true },
  processedAt: { type: Date, default: null },
  leaseUntil: { type: Date, default: () => new Date(0) },
  leaseToken: { type: String, default: '' },
  nextAttemptAt: { type: Date, default: Date.now },
  attempts: { type: Number, default: 0 },
  lastError: String,
}, { timestamps: true });
schema.index({ processedAt: 1, nextAttemptAt: 1, leaseUntil: 1 });
module.exports = model('OutboxEvent', schema);
