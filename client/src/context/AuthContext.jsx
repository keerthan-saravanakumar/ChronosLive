import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../api/auth';
import { TOKEN_KEY } from '../api/http';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const navigate = useNavigate(), location = useLocation();
  function clear() { sessionStorage.removeItem(TOKEN_KEY); setToken(null); setUser(null); setLoading(false); }
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let active = true;
    authApi.me().then(result => { if (active) setUser(result.data); }).catch(error => { if (active && error.response?.status === 401) clear(); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    const ended = () => {
      if (!sessionStorage.getItem(TOKEN_KEY)) return;
      clear();
      toast.error('Your session has ended. Please sign in again.');
      if (location.pathname !== '/login') navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
    };
    window.addEventListener('chronos:session-ended', ended);
    return () => window.removeEventListener('chronos:session-ended', ended);
  }, [navigate, location.pathname, location.search]);
  useEffect(() => {
    if (!token) return;
    let expires;
    try { expires = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch { clear(); return; }
    const timer = setTimeout(() => window.dispatchEvent(new CustomEvent('chronos:session-ended')), Math.max(0, expires - Date.now()));
    return () => clearTimeout(timer);
  }, [token]);
  async function signIn(data, register = false) {
    const result = await (register ? authApi.register(data) : authApi.login(data));
    sessionStorage.setItem(TOKEN_KEY, result.data.token);
    setToken(result.data.token); setUser(result.data.user); setLoading(false);
    return result.data.user;
  }
  async function signOut() {
    try { await authApi.logout(); toast.success('Signed out of all sessions.'); }
    catch { toast('Signed out here. Other sessions expire automatically if the server could not be reached.'); }
    finally { clear(); navigate('/login'); }
  }
  return <AuthContext.Provider value={{ user, token, loading, signIn, signOut, setUser }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
