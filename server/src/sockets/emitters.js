const { User } = require('../models');
const { endSession } = require('./auth');
function createEmitters(io) {
  async function authorizedSockets(userId) {
    const user = await User.findById(userId).select('isActive authVersion').lean();
    const sockets = await io.in('user:' + userId).fetchSockets();
    return sockets.filter(socket => {
      const valid = user?.isActive && socket.data.authVersion === user.authVersion && socket.data.expiresAt > Date.now();
      if (!valid) endSession(socket);
      return valid;
    });
  }
  async function revokeUser(userId) { await authorizedSockets(userId); }
  async function emit(event) {
    if (event.kind === 'auth:revoked') return revokeUser(String(event.recipient));
    if (event.recipient) {
      for (const socket of await authorizedSockets(String(event.recipient))) socket.emit(event.kind, event.payload);
    } else if (event.payload.slotId) {
      io.to('slot:' + event.payload.slotId).to('service:' + event.payload.serviceId).emit(event.kind, event.payload);
    }
  }
  return { emit, revokeUser };
}
module.exports = { createEmitters };
