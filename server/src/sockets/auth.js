const { authenticateToken } = require('../services/authService');
async function authenticateSocket(socket, env) {
  const result = await authenticateToken(socket.handshake.auth?.token, env);
  socket.data.userId = String(result.user._id);
  socket.data.authVersion = result.claims.ver;
  socket.data.expiresAt = result.claims.exp * 1000;
  return result;
}
function endSession(socket, code = 'SESSION_REVOKED') {
  socket.emit('session:ended', { code });
  socket.disconnect(true);
}
module.exports = { authenticateSocket, endSession };
