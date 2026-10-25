const { Schema, model } = require('mongoose');
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: String, required: true },
  type: { type: String, enum: ['booking_confirmed', 'booking_cancelled', 'promoted', 'skipped', 'slot_cancelled', 'slot_updated', 'reminder'], required: true },
  message: { type: String, required: true },
  slot: { type: Schema.Types.ObjectId, ref: 'Slot' },
  read: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ eventId: 1, user: 1 }, { unique: true });
schema.index({ user: 1, read: 1, createdAt: -1 });
module.exports = model('Notification', schema);
