const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User, Service } = require('../src/models');
const services = require('../src/services/serviceService');
const slots = require('../src/services/slotService');
const bookings = require('../src/services/bookingService');
const waitlist = require('../src/services/waitlistService');
const { readEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const context = user => ({ user, claims: { ver: user.authVersion } });
const DEMO_USERS = [
  ['Admin Demo', 'admin', 'admin'],
  ['Dr. Maya Rao', 'maya', 'organizer'],
  ['Prof. Arjun Mehta', 'arjun', 'organizer'],
  ['Aditi Sharma', 'aditi', 'attendee'], ['Rohan Patel', 'rohan', 'attendee'],
  ['Sara Khan', 'sara', 'attendee'], ['Vikram Rao', 'vikram', 'attendee'],
  ['Neha Iyer', 'neha', 'attendee'], ['Kabir Sen', 'kabir', 'attendee'],
];
async function seed(password) {
  if (!password || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new Error('Set DEMO_PASSWORD to a dedicated demo password of 12–72 bytes.');
  const hash = await bcrypt.hash(password, 12);
  const users = [];
  for (const [name, alias, role] of DEMO_USERS) users.push(await User.findOneAndUpdate(
    { email: alias + '@chronos.example' },
    { $setOnInsert: { name, role, passwordHash: hash } }, { upsert: true, new: true, runValidators: true },
  ));
  const definitions = [
    { title: 'Database design clinic', description: 'Bring your schema, queries, or a tricky transaction. Work through database design and concurrency with individual guidance.', category: 'Office hours', location: 'Learning Centre · Room 204', owner: users[1], hour: '10' },
    { title: 'Build together: web development lab', description: 'A hands-on session for debugging, code reviews, and shipping your next feature. Bring your laptop and a concrete question.', category: 'Labs', location: 'Innovation Lab · First floor', owner: users[2], hour: '13' },
    { title: 'Project feedback studio', description: 'Get thoughtful feedback on your end-term project, architecture, and demo. Leave with clear next steps for your submission.', category: 'Consultations', location: 'Learning Centre · Room 208', owner: users[1], hour: '16' },
  ];
  let created = 0;
  const tomorrow = new Date(Date.now() + 86400000 + 330 * 60000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(tomorrow + 'T00:00:00Z') + 13 * 86400000).toISOString().slice(0, 10);
  for (const definition of definitions) {
    if (await Service.exists({ title: definition.title, organizer: definition.owner._id })) continue;
    const { owner, hour, ...fields } = definition;
    const service = await services.create(fields, context(owner));
    const generated = slots.generateSlots({ daysOfWeek: [1, 2, 3, 4, 5], fromDate: tomorrow, toDate: end, startTime: hour + ':00', endTime: String(Number(hour) + 2) + ':00', slotMinutes: 30, capacity: 2 });
    const createdSlots = await slots.createSlots(service._id, generated, context(owner));
    // Use the same guarded engine as the API; no fabricated counters or UI-only fixtures.
    for (const slot of createdSlots.slice(0, 2)) {
      await bookings.book(slot._id, context(users[3]));
      await bookings.book(slot._id, context(users[4]));
      await waitlist.join(slot._id, context(users[5]));
      await waitlist.join(slot._id, context(users[6]));
    }
    created++;
  }
  return { createdServices: created, accounts: DEMO_USERS.map(([, alias, role]) => ({ email: alias + '@chronos.example', role })) };
}
if (require.main === module) (async () => {
  const env = readEnv();
  await connectDB(env.MONGODB_URI);
  console.log(JSON.stringify(await seed(process.env.DEMO_PASSWORD), null, 2));
  console.log('Demo passwords come from DEMO_PASSWORD and are never printed.');
  await mongoose.disconnect();
})().catch(error => { console.error('Seed failed:', error.name, 'Check configuration and the documented demo password requirements.'); process.exitCode = 1; });
module.exports = { seed, DEMO_USERS };
