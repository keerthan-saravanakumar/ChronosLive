const { Schema, model } = require('mongoose');
const schema = new Schema({
  slot: { type: Schema.Types.ObjectId, ref: 'Slot', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['waiting', 'promoted', 'left', 'skipped', 'expired'], default: 'waiting' },
  skipReason: { type: String, enum: ['TIME_CONFLICT', 'BOOKING_LIMIT_REACHED', 'INACTIVE_USER'] },
  promotedAt: Date,
}, { timestamps: true });
schema.index({ slot: 1, user: 1 }, { unique: true, partialFilterExpression: { status: 'waiting' } });
schema.index({ slot: 1, status: 1, createdAt: 1, _id: 1 });
schema.index({ user: 1, status: 1 });
module.exports = model('WaitlistEntry', schema);
