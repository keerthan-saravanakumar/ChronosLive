import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { refreshData } from '../utils/format';
const SocketContext = createContext(null);
export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null), [status, setStatus] = useState('offline');
  const revisions = useRef(new Map());
  useEffect(() => {
    if (!token || !user) { setSocket(null); setStatus('offline'); return; }
    const connection = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', { auth: { token } });
    setSocket(connection); setStatus('connecting'); revisions.current.clear();
    const key = 'chronos:events:' + user._id;
    let seen;
    try { seen = new Set(JSON.parse(sessionStorage.getItem(key) || '[]')); } catch { seen = new Set(); }
    function remember(id) {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      seen = new Set([...seen].slice(-200));
      sessionStorage.setItem(key, JSON.stringify([...seen]));
      return true;
    }
    connection.on('connect', () => { setStatus('live'); refreshData(); });
    connection.on('disconnect', () => setStatus('reconnecting'));
    connection.on('connect_error', error => {
      setStatus('reconnecting');
      if (['SESSION_EXPIRED', 'SESSION_REVOKED', 'INVALID_TOKEN', 'UNAUTHENTICATED'].includes(error.data?.code)) window.dispatchEvent(new CustomEvent('chronos:session-ended'));
    });
    connection.on('session:ended', () => window.dispatchEvent(new CustomEvent('chronos:session-ended')));
    connection.on('slot:updated', event => {
      if (event.version <= (revisions.current.get(event.slotId) ?? -1)) return;
      revisions.current.set(event.slotId, event.version);
      refreshData();
    });
    for (const name of ['waitlist:changed', 'notification:new', 'slot:cancelled']) connection.on(name, refreshData);
    connection.on('booking:promoted', event => {
      if (remember(event.eventId)) toast.success('A seat is yours! You have been promoted from the waitlist.', { duration: 7000 });
      refreshData();
    });
    return () => connection.disconnect();
  }, [token, user?._id]);
  return <SocketContext.Provider value={{ socket, status }}>{children}</SocketContext.Provider>;
}
export const useSocket = () => useContext(SocketContext);
