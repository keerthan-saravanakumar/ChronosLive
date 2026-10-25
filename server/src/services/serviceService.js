const { Service } = require('../models');
const { transaction } = require('./transaction');
const { guardActor, guardService, requireOwner, sameId } = require('./guards');
const AppError = require('../utils/AppError');
async function create(data, context) {
  return transaction(async session => {
    const actor = await guardActor(context, session);
    if (actor.role !== 'organizer') throw new AppError(403, 'FORBIDDEN', 'Only organizers can publish services.');
    const [service] = await Service.create([{ ...data, organizer: actor._id }], { session });
    return service;
  });
}
async function update(id, data, context) {
  return transaction(async session => {
    const service = await guardService(id, session);
    requireOwner(service, await guardActor(context, session));
    const changes = { ...data };
    if (data.policy) { delete changes.policy; for (const [key, value] of Object.entries(data.policy)) changes['policy.' + key] = value; }
    return Service.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true, session });
  });
}
async function get(id) {
  const service = await Service.findById(id).populate('organizer', 'name avatarUrl').lean();
  if (!service) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  return service;
}
async function list(filters, viewer) {
  const { page, limit, search, category, organizer, includeInactive } = filters;
  if (includeInactive && !(viewer?.role === 'organizer' && sameId(viewer._id, organizer))) throw new AppError(403, 'FORBIDDEN', 'Archived services are available to their organizer.');
  const query = includeInactive ? {} : { isActive: true };
  if (organizer) query.organizer = organizer;
  if (category) query.category = category;
  if (search) query.$text = { $search: search.replace(/"/g, '') };
  const [data, total] = await Promise.all([
    Service.find(query).populate('organizer', 'name avatarUrl').sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Service.countDocuments(query),
  ]);
  return { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}
module.exports = { create, update, get, list };
