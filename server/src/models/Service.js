const { Schema, model } = require('mongoose');
const schema = new Schema({
  organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 3000 },
  category: { type: String, required: true, trim: true, maxlength: 40 },
  location: { type: String, required: true, trim: true, maxlength: 300 },
  coverImageUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  policy: {
    maxActiveBookingsPerUser: { type: Number, default: 2, min: 1, max: 100 },
    cancellationCutoffMinutes: { type: Number, default: 30, min: 0, max: 10080 },
  },
  revision: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ title: 'text', description: 'text' });
schema.index({ organizer: 1, isActive: 1 });
module.exports = model('Service', schema);
