const { User, Service } = require('../models');
const { transaction } = require('./transaction');
const { guardActor, guardUser, guardService, requireOwner } = require('./guards');
const { publicUser } = require('./authService');
const { enqueue } = require('./notificationService');
const { uploadImage, discardUpload } = require('./uploadService');
const AppError = require('../utils/AppError');
async function profile(data, file, context, env) {
  const uploaded = file ? await uploadImage(file, 'chronoslive/avatars', env) : null;
  try {
    return await transaction(async session => {
      const actor = await guardActor(context, session);
      const updates = { ...data, ...(uploaded ? { avatarUrl: uploaded.secure_url } : {}) };
      return publicUser(await User.findByIdAndUpdate(actor._id, { $set: updates }, { new: true, session, runValidators: true }));
    });
  } catch (error) { if (uploaded) await discardUpload(uploaded.public_id); throw error; }
}
async function cover(id, file, context, env) {
  const existing = await Service.findById(id);
  if (!existing) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  requireOwner(existing, context.user);
  const uploaded = await uploadImage(file, 'chronoslive/services', env);
  try {
    return await transaction(async session => {
      const service = await guardService(id, session);
      requireOwner(service, await guardActor(context, session));
      return Service.findByIdAndUpdate(id, { $set: { coverImageUrl: uploaded.secure_url } }, { new: true, session });
    });
  } catch (error) { await discardUpload(uploaded.public_id); throw error; }
}
async function users({ page, limit, search }) {
  const escaped = search?.split('').map(ch => '\\^$.*+?()[]{}|'.includes(ch) ? '\\' + ch : ch).join('');
  const query = search ? { $or: [{ name: new RegExp(escaped, 'i') }, { email: new RegExp(escaped, 'i') }] } : {};
  const [rows, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(query),
  ]);
  return { data: rows.map(publicUser), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function status(id, isActive, context) {
  return transaction(async session => {
    const actor = await guardActor(context, session);
    if (actor.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'Only administrators can manage accounts.');
    const target = await guardUser(id, session);
    if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    if (target.role === 'admin') throw new AppError(409, 'ADMIN_PROTECTED', 'Administrator accounts cannot be deactivated here.');
    if (target.isActive === isActive) return publicUser(target);
    const updated = await User.findByIdAndUpdate(id, { $set: { isActive }, $inc: { authVersion: 1 } }, { new: true, session });
    await enqueue('revoke:' + id + ':' + updated.authVersion, 'auth:revoked', { userId: String(id), authVersion: updated.authVersion }, session, id);
    return publicUser(updated);
  });
}
module.exports = { profile, cover, users, status };
