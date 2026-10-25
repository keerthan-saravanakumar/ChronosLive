import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar, Button, Icon } from '../components/ui';
import NotificationBell from '../components/NotificationBell';
export function Brand() { return <Link to="/" className="brand" aria-label="ChronosLive home"><span className="brand-mark"><Icon name="clock" size={25}/></span><span>chronos<span className="brand-live">live</span><small>MAKE ROOM FOR WHAT MATTERS</small></span></Link>; }
export default function AppLayout() {
  const { user, signOut } = useAuth(), { status } = useSocket();
  const [open, setOpen] = useState(false), [leaving, setLeaving] = useState(false);
  const location = useLocation();
  const nav = [{ to: '/browse', label: 'Explore services', icon: 'grid' }, { to: '/bookings', label: 'My bookings', icon: 'calendar' }];
  if (user) nav.push({ to: '/notifications', label: 'Notifications', icon: 'bell' }, { to: '/profile', label: 'My profile', icon: 'user' });
  if (user?.role === 'organizer') nav.push({ to: '/organizer', label: 'Organizer dashboard', icon: 'users' });
  if (user?.role === 'admin') nav.push({ to: '/admin', label: 'Manage accounts', icon: 'shield' });
  return <div className="app-shell">
    {open && <button className="nav-backdrop" aria-label="Close menu" onClick={() => setOpen(false)}/>}
    <aside className={'sidebar ' + (open ? 'is-open' : '')}><Brand/><div className="sidebar-section">YOUR SPACE</div><nav>{nav.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')} onClick={() => setOpen(false)}><Icon name={item.icon}/>{item.label}</NavLink>)}</nav><div className="sidebar-note"><Icon name="spark"/><p>Good things happen<br/>when there’s room.</p><span>Find your next session.</span></div><div className="sidebar-bottom">{user ? <><div className="user-summary"><Avatar user={user}/><span><strong>{user.name}</strong><small>{user.role}</small></span></div><button className="nav-link signout" disabled={leaving} onClick={async () => { setLeaving(true); await signOut(); setLeaving(false); }}><Icon name="logout"/>Sign out</button></> : <Link className="btn btn-primary full-width" to="/login">Sign in<Icon name="arrow"/></Link>}</div></aside>
    <div className="workspace"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Icon name="menu"/></button><span className="breadcrumb">Your time, thoughtfully planned <span>/</span> {location.pathname.startsWith('/organizer') ? 'Organizer' : location.pathname.startsWith('/bookings') ? 'My bookings' : 'Your space'}</span></div><div className="topbar-right">{user ? <><span className={'connection ' + (status === 'live' ? 'connected' : '')}><i/>{status === 'live' ? 'Live' : 'Reconnecting'}</span><NotificationBell/><Link to="/profile" aria-label="My profile"><Avatar user={user}/></Link></> : <Link className="text-link" to="/login">Sign in for live updates<Icon name="arrow" size={16}/></Link>}</div></header><main className="page"><Outlet/></main><footer className="app-footer"><span>© {new Date().getFullYear()} ChronosLive</span><span>A little less coordinating. A lot more possibility.</span></footer></div>
  </div>;
}
