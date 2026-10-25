const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['attendee', 'organizer', 'admin'], default: 'attendee' },
  avatarUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  authVersion: { type: Number, default: 0 },
  bookingRevision: { type: Number, default: 0 },
  scheduleRevision: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.model('User', schema);
