const { Schema, model } = require('mongoose');
const schema = new Schema({
  service: { type: Schema.Types.ObjectId, ref: 'Service', required: true, immutable: true },
  organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  startTime: { type: Date, required: true, immutable: true },
  endTime: { type: Date, required: true, immutable: true },
  capacity: { type: Number, required: true, min: 1, max: 100 },
  bookedCount: { type: Number, default: 0, min: 0 },
  waitlistCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['open', 'cancelled', 'completed'], default: 'open' },
  version: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ service: 1, startTime: 1 });
schema.index({ organizer: 1, startTime: 1 });
module.exports = model('Slot', schema);
