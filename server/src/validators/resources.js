const { z, route, empty, idParams, objectId, pagination } = require('./common');
const instant = z.iso.datetime({ offset: true });
const date = z.iso.date();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const booleanQuery = z.enum(['true', 'false']).transform(v => v === 'true');
const policy = z.object({
  maxActiveBookingsPerUser: z.number().int().min(1).max(100).optional(),
  cancellationCutoffMinutes: z.number().int().min(0).max(10080).optional(),
}).strict();
const serviceFields = {
  title: z.string().trim().min(3).max(120), description: z.string().trim().min(10).max(3000),
  category: z.string().trim().min(2).max(40), location: z.string().trim().min(2).max(300), policy: policy.optional(),
};
const slotFields = { startTime: instant, endTime: instant, capacity: z.number().int().min(1).max(100) };
const filters = z.object({
  ...pagination, from: instant.optional(), to: instant.optional(),
  availableOnly: booleanQuery.optional().default(false), timeFrom: clock.optional(), timeTo: clock.optional(),
}).strict().refine(v => !v.from || !v.to || v.from < v.to, { message: 'from must be before to' })
  .refine(v => !v.timeFrom || !v.timeTo || v.timeFrom < v.timeTo, { message: 'timeFrom must be before timeTo' });
module.exports = {
  id: route(empty, idParams),
  createService: route(z.object(serviceFields).strict()),
  updateService: route(z.object({ ...Object.fromEntries(Object.entries(serviceFields).map(([k, v]) => [k, v.optional()])), isActive: z.boolean().optional() }).strict().refine(v => Object.keys(v).length > 0, 'Supply at least one field'), idParams),
  serviceList: route(empty, empty, z.object({ ...pagination, search: z.string().trim().max(100).optional(), category: z.string().max(40).optional(), organizer: objectId.optional(), includeInactive: booleanQuery.optional().default(false) }).strict()),
  slotList: route(empty, idParams, filters),
  createSlot: route(z.object(slotFields).strict(), idParams),
  createBulk: route(z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(v => new Set(v).size === v.length, 'Weekdays must be unique'),
    startTime: clock, endTime: clock, slotMinutes: z.number().int().min(5).max(240),
    capacity: slotFields.capacity, fromDate: date, toDate: date,
  }).strict(), idParams),
  capacity: route(z.object({ capacity: slotFields.capacity }).strict(), idParams),
  cancel: route(z.object({ reason: z.string().trim().max(300).optional() }).strict(), idParams),
  booleanQuery, filters,
};
