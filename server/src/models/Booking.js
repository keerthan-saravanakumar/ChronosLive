const { Schema, model } = require('mongoose');
const schema = new Schema({
  slot: { type: Schema.Types.ObjectId, ref: 'Slot', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  status: { type: String, enum: ['confirmed', 'cancelled', 'cancelled_by_organizer'], default: 'confirmed' },
  source: { type: String, enum: ['direct', 'waitlist_promotion'], default: 'direct' },
  cancelledAt: Date,
  cancelReason: { type: String, maxlength: 300 },
  reminderSent: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ slot: 1, user: 1 }, { unique: true, partialFilterExpression: { status: 'confirmed' } });
schema.index({ user: 1, status: 1, service: 1 });
module.exports = model('Booking', schema);
