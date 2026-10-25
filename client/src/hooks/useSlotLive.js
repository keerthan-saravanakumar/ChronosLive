import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { refreshData } from '../utils/format';
export function useSlotLive(id, kind = 'service') {
  const { socket, status } = useSocket();
  useEffect(() => {
    if (!socket || status !== 'live' || !id) return;
    // Fetch after the join acknowledgement to close the fetch-before-subscribe gap.
    socket.emit('room:join', { kind, id }, response => { if (response?.success) refreshData(); });
    return () => { if (socket.connected) socket.emit('room:leave', { kind, id }); };
  }, [socket, status, id, kind]);
}
