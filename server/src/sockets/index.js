const { Server } = require('socket.io');
const { z, objectId } = require('../validators/common');
const { Slot, Service } = require('../models');
const { authenticateSocket, endSession } = require('./auth');
const { createEmitters } = require('./emitters');
const roomSchema = z.object({ kind: z.enum(['slot', 'service']), id: objectId }).strict();
function createRealtime(server, env) {
  const io = new Server(server, {
    cors: { origin: env.CLIENT_URL, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || req.headers.origin === env.CLIENT_URL),
    maxHttpBufferSize: 16384,
  });
  io.use(async (socket, next) => {
    try { await authenticateSocket(socket, env); next(); }
    catch (error) { const failure = new Error('Authentication required'); failure.data = { code: error.code || 'UNAUTHENTICATED' }; next(failure); }
  });
  io.on('connection', socket => {
    socket.join('user:' + socket.data.userId);
    const expiry = setTimeout(() => endSession(socket, 'SESSION_EXPIRED'), Math.max(0, socket.data.expiresAt - Date.now()));
    expiry.unref();
    const recheck = setInterval(() => authenticateSocket(socket, env).catch(() => endSession(socket)), 30000);
    recheck.unref();
    let windowStart = Date.now(), requests = 0;
    for (const action of ['join', 'leave']) socket.on('room:' + action, async (payload, acknowledge) => {
      const reply = value => { if (typeof acknowledge === 'function') acknowledge(value); };
      try {
        if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requests = 0; }
        if (++requests > 60) return reply({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many subscription changes.' } });
        await authenticateSocket(socket, env);
        const parsed = roomSchema.safeParse(payload);
        if (!parsed.success) return reply({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Choose a valid slot or service room.' } });
        const { kind, id } = parsed.data;
        const model = kind === 'slot' ? Slot : Service;
        if (!await model.exists({ _id: id })) return reply({ success: false, error: { code: 'NOT_FOUND', message: 'This resource does not exist.' } });
        await socket[action](kind + ':' + id);
        reply({ success: true });
      } catch (error) { reply({ success: false, error: { code: error.code || 'SUBSCRIPTION_FAILED', message: 'Unable to update subscription.' } }); if (error.status === 401) endSession(socket); }
    });
    socket.on('disconnect', () => { clearTimeout(expiry); clearInterval(recheck); });
  });
  return { io, ...createEmitters(io), close: () => new Promise(resolve => io.close(resolve)) };
}
module.exports = { createRealtime };
