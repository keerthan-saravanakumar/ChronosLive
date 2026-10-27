const { randomBytes } = require('node:crypto');
const { io } = require('socket.io-client');

async function runWorkflows({ apiOrigin, appOrigin, api, step, resources, ensure }) {
  const run = Date.now().toString(36) + '-' + randomBytes(4).toString('hex');
  const password = randomBytes(24).toString('base64url');
  const accounts = [],
    clients = [],
    slots = [];

  Object.assign(resources, { run, accounts: [], serviceId: null, slotIds: [] });
  let organizer, outsider, attendee, first, second, service, slot, booking, firstClient, secondClient;
  let failure;

  const write = (route, account, body = {}, method = 'POST', status = 200, code) =>
    api(route, { account, body, method, status, code });

  const getSlot = (account) => api('/slots/' + slot._id, { account }).then((result) => result.data);
  const rememberSlot = (item) => {
    slots.push(item);
    resources.slotIds.push(item._id);
    return item;
  };

  async function connect(account) {
    const socket = io(apiOrigin, {
      auth: { token: account.token },
      transports: ['websocket'],
      extraHeaders: { Origin: appOrigin },
      reconnection: false,
      forceNew: true,
      autoConnect: false,
      timeout: 15000,
    });
    const client = { socket, events: [] };
    clients.push(client);
    socket.onAny((name, data) => client.events.push({ name, data }));

    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', () => reject(new Error('Authenticated WebSocket connection failed.')));
      socket.connect();
    });

    return client;
  }

  async function subscribe(client) {
    const result = await new Promise((resolve, reject) =>
      client.socket.timeout(15000).emit('room:join', { kind: 'slot', id: slot._id }, (error, value) =>
        error ? reject(new Error('Slot room subscription timed out.')) : resolve(value)
      )
    );
    ensure(result?.success, 'Slot room subscription was rejected.');
  }

  async function event(client, name, predicate = () => true, since = 0) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const found = client.events.slice(since).find((item) => item.name === name && predicate(item.data));
      if (found) return found.data;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Missing WebSocket event: ' + name);
  }

  try {
    await step('W1 registration, login and role protection', async () => {
      for (const [alias, role] of [
        ['organizer', 'organizer'],
        ['outsider', 'organizer'],
        ['attendee', 'attendee'],
        ['first', 'attendee'],
        ['second', 'attendee'],
      ]) {
        const result = await write(
          '/auth/register',
          null,
          { name: 'Smoke ' + alias, email: 'smoke-' + run + '-' + alias + '@chronos.example', password, role },
          'POST',
          201
        );
        accounts.push(result.data);
        resources.accounts.push({ id: result.data.user._id, role });
        ensure(result.data.user.role === role && !result.data.user.passwordHash, 'Registration returned an incorrect or unsafe user record.');
      }

      [organizer, outsider, attendee, first, second] = accounts;

      const login = await write('/auth/login', null, { email: attendee.user.email, password });
      ensure(login.data.user._id === attendee.user._id, 'Login returned the wrong account.');
      ensure((await api('/auth/me', { account: attendee })).data._id === attendee.user._id, 'Authenticated profile lookup failed.');
      await write('/services', attendee, {}, 'POST', 403);
    });

    await step('W2 slots, recurring batch rollback and ownership', async () => {
      service = (
        await write(
          '/services',
          organizer,
          {
            title: 'Deployment smoke ' + run,
            description: 'Isolated deployment verification; automatically archived after the run.',
            category: 'Verification',
            location: 'Deployment verification',
            policy: { maxActiveBookingsPerUser: 2, cancellationCutoffMinutes: 0 },
          },
          'POST',
          201
        )
      ).data;
      resources.serviceId = service._id;

      const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      slot = rememberSlot(
        (
          await write(
            '/services/' + service._id + '/slots',
            organizer,
            { startTime: date + 'T10:00:00Z', endTime: date + 'T10:20:00Z', capacity: 1 },
            'POST',
            201
          )
        ).data
      );

      const bulk = {
        fromDate: date,
        toDate: date,
        daysOfWeek: [new Date(date + 'T00:00:00Z').getUTCDay()],
        startTime: '12:00',
        endTime: '13:00',
        slotMinutes: 20,
        capacity: 1,
      };

      const created = await write('/services/' + service._id + '/slots/bulk', organizer, bulk, 'POST', 201);
      for (const item of created.data.slots) rememberSlot(item);
      ensure(created.data.count === 3, 'Recurring slot count is incorrect.');

      await write('/services/' + service._id + '/slots/bulk', organizer, { ...bulk, endTime: '13:20' }, 'POST', 409, 'SLOT_OVERLAP');
      ensure((await api('/services/' + service._id + '/slots')).meta.total === 4, 'A rejected recurring batch partially changed the schedule.');

      await api('/slots/' + slot._id + '/roster', { account: outsider, status: 403 });
      await api('/slots/' + slot._id + '/roster', { account: attendee, status: 403 });
      await write('/slots/' + slot._id, outsider, { capacity: 2 }, 'PATCH', 403);
    });

    await step('W3 last-seat booking updates another WebSocket client', async () => {
      firstClient = await connect(first);
      secondClient = await connect(second);
      await subscribe(firstClient);
      await subscribe(secondClient);

      booking = (await write('/slots/' + slot._id + '/book', attendee, {}, 'POST', 201)).data;

      await event(firstClient, 'slot:updated', (value) => value.slotId === slot._id && value.bookedCount === 1);
      await event(secondClient, 'slot:updated', (value) => value.slotId === slot._id && value.bookedCount === 1);

      await write('/slots/' + slot._id + '/book', attendee, {}, 'POST', 409, 'ALREADY_BOOKED');
      await write('/slots/' + slot._id + '/book', first, {}, 'POST', 409, 'SLOT_FULL');
    });

    await step('W5 FIFO positions, duplicate joins and waitlist departure', async () => {
      ensure((await write('/slots/' + slot._id + '/waitlist', first, {}, 'POST', 201)).data.position === 1, 'First waiter has the wrong position.');
      ensure((await write('/slots/' + slot._id + '/waitlist', second, {}, 'POST', 201)).data.position === 2, 'Second waiter has the wrong position.');

      await write('/slots/' + slot._id + '/waitlist', second, {}, 'POST', 409, 'ALREADY_ON_WAITLIST');
      await write('/slots/' + slot._id + '/waitlist', second, {}, 'DELETE');

      ensure((await getSlot(second)).myWaitlist === null, 'Leaving did not clear the personal waitlist state.');
      ensure((await write('/slots/' + slot._id + '/waitlist', second, {}, 'POST', 201)).data.position === 2, 'Rejoining did not go to the end of the queue.');
    });

    await step('W4 cancellation promotes FIFO with a private persisted notification', async () => {
      await write('/bookings/' + booking._id, attendee, {}, 'DELETE');

      await event(firstClient, 'booking:promoted', (value) => value.slotId === slot._id);
      await event(firstClient, 'notification:new', (value) => value.notification.type === 'promoted' && value.notification.slot === slot._id);

      const current = await getSlot(first);
      ensure(
        current.bookedCount === 1 && current.waitlistCount === 1 && current.myBooking?.source === 'waitlist_promotion',
        'Promotion did not persist a consistent booking and counter snapshot.'
      );
      ensure((await getSlot(second)).myWaitlist?.position === 1, 'The remaining waiter did not advance.');

      const notifications = await api('/notifications', { account: first });
      ensure(notifications.data.some((item) => item.type === 'promoted' && item.slot === slot._id), 'Promotion notification was not persisted.');
      ensure(!secondClient.events.some((item) => item.name === 'notification:new' && item.data.notification.user !== second.user._id), 'A private notification reached another account.');

      await write('/bookings/' + booking._id, attendee, {}, 'DELETE', 409, 'ALREADY_CANCELLED');
    });

    await step('W2 capacity increase promotes the next waiter and rejects under-capacity', async () => {
      await write('/slots/' + slot._id, organizer, { capacity: 2 }, 'PATCH');

      await event(secondClient, 'booking:promoted', (value) => value.slotId === slot._id);

      const current = await getSlot(second);
      ensure(
        current.bookedCount === 2 && current.waitlistCount === 0 && current.myBooking?.source === 'waitlist_promotion',
        'Capacity promotion did not persist.'
      );

      await write('/slots/' + slot._id, organizer, { capacity: 1 }, 'PATCH', 409, 'CAPACITY_BELOW_BOOKED');

      const roster = (await api('/slots/' + slot._id + '/roster', { account: organizer })).data;
      ensure(roster.attendees.length === 2 && roster.waitlist.length === 0, 'The organizer roster disagrees with the slot counters.');

      await event(firstClient, 'notification:new', (value) => value.notification.type === 'slot_updated' && value.notification.slot === slot._id);
    });

    await step('W5 reconnect reconciles personal booking and notification state', async () => {
      firstClient.socket.disconnect();
      firstClient = await connect(first);
      await subscribe(firstClient);

      ensure((await getSlot(first)).myBooking?.status === 'confirmed', 'Reconnected account lost its confirmed booking.');
      ensure((await api('/bookings/me', { account: first })).data.some((item) => item.slot._id === slot._id), 'My Bookings does not include the promoted reservation.');

      await write('/notifications/read-all', first, {}, 'PATCH');
      ensure((await api('/notifications', { account: first })).meta.unread === 0, 'Notification read state was not saved.');
      ensure((await write('/users/me', first, { name: 'Smoke verified attendee' }, 'PATCH')).data.name === 'Smoke verified attendee', 'Profile update failed.');
    });

    await step('W2 slot cancellation clears confirmed bookings and waiting entries', async () => {
      await write('/slots/' + slot._id + '/waitlist', attendee, {}, 'POST', 201);
      const since = firstClient.events.length;

      await write('/slots/' + slot._id + '/cancel', organizer);
      await event(firstClient, 'slot:cancelled', (value) => value.slotId === slot._id, since);

      const current = await getSlot(first);
      ensure(
        current.status === 'cancelled' && current.bookedCount === 0 && current.waitlistCount === 0 && current.myBooking === null,
        'Slot cancellation left inconsistent counters or bookings.'
      );
      ensure((await getSlot(attendee)).myWaitlist === null, 'Slot cancellation did not expire the waitlist.');
      ensure(
        (await api('/bookings/me?status=cancelled', { account: first })).data.some(
          (item) => item.slot._id === slot._id && item.status === 'cancelled_by_organizer'
        ),
        'Cancelled reservations are absent from booking history.'
      );
    });

    await step('W1 logout revokes REST and connected WebSocket sessions', async () => {
      const since = firstClient.events.length;
      await write('/auth/logout', first);
      await event(firstClient, 'session:ended', (value) => value.code === 'SESSION_REVOKED', since);
      await api('/auth/me', { account: first, status: 401, code: 'SESSION_REVOKED' });
    });
  } catch (error) {
    failure = error;
  } finally {
    for (const client of clients) client.socket.disconnect();

    await step('Cleanup only this smoke run and revoke its sessions', async () => {
      const errors = [];
      const cleanup = async (action) => {
        try {
          await action();
        } catch (error) {
          errors.push(error.message);
        }
      };

      if (organizer) {
        for (const created of slots) {
          await cleanup(async () => {
            const result = await write(
              '/slots/' + created._id + '/cancel',
              organizer,
              { reason: 'Deployment smoke verification complete' },
              'POST',
              [200, 409]
            );
            ensure(result.success || result.error?.code === 'SLOT_CLOSED', 'Could not close a smoke slot.');
          });
        }
        if (service) {
          await cleanup(() => write('/services/' + service._id, organizer, {}, 'DELETE'));
        }
      }

      for (const account of accounts) {
        await cleanup(() => write('/auth/logout', account, {}, 'POST', [200, 401]));
      }

      resources.cleanupComplete = errors.length === 0;
      ensure(!errors.length, 'Some smoke resources need cleanup; retain the report. ' + errors.join(' '));
    }).catch((error) => {
      failure ||= error;
    });
  }

  if (failure) throw failure;
}

module.exports = { runWorkflows };
