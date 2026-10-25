const { OutboxEvent, Slot, Notification } = require('../models');
const AppError = require('../utils/AppError');
async function enqueue(id, kind, payload, session, recipient) {
  await OutboxEvent.create([{ _id: id, kind, payload, recipient }], { session });
}
async function notify(user, type, message, slot, key, session) {
  await enqueue(type + ':' + key + ':' + user, 'notification', { type, message, slot }, session, user);
}
async function slotChanged(id, session, cancelled = false) {
  const slot = await Slot.findById(id).session(session).lean();
  const key = String(id) + ':' + slot.version;
  const payload = { slotId: String(id), serviceId: String(slot.service), bookedCount: slot.bookedCount, capacity: slot.capacity, waitlistCount: slot.waitlistCount, status: slot.status, version: slot.version };
  await enqueue('slot:' + key, 'slot:updated', payload, session);
  await enqueue('queue:' + key, 'waitlist:changed', { slotId: String(id), serviceId: String(slot.service), version: slot.version }, session);
  if (cancelled) await enqueue('cancelled:' + key, 'slot:cancelled', { slotId: String(id), serviceId: String(slot.service), version: slot.version }, session);
  return slot;
}
async function list(userId, { page, limit }) {
  const query = { user: userId };
  const [data, total, unread] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(query), Notification.countDocuments({ ...query, read: false }),
  ]);
  return { data, meta: { page, limit, total, unread, pages: Math.ceil(total / limit) } };
}
async function markRead(userId, id) {
  if (!id) { await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } }); return { message: 'All notifications marked as read.' }; }
  const notification = await Notification.findOneAndUpdate({ _id: id, user: userId }, { $set: { read: true } }, { new: true });
  if (!notification) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  return notification;
}
module.exports = { enqueue, notify, slotChanged, list, markRead };
