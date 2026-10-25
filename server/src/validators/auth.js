const { z, route } = require('./common');
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(72).refine(s => Buffer.byteLength(s, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes');
const name = z.string().trim().min(2).max(80);
module.exports = {
  register: route(z.object({ name, email, password, role: z.enum(['attendee', 'organizer']).default('attendee') }).strict()),
  login: route(z.object({ email, password: z.string().min(1).max(72) }).strict()),
  empty: route(),
  profile: route(z.object({ name: name.optional() }).strict()),
};
