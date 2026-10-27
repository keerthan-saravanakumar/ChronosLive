import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar, Icon } from '../components/ui';
import Brand from '../components/Brand';
import NotificationBell from '../components/NotificationBell';

export { default as Brand } from '../components/Brand';

function Navigation({ onNavigate, mobile = false }) {
  const { user, signOut } = useAuth();
  const { status } = useSocket();
  const { pathname, search } = useLocation();
  const [leaving, setLeaving] = useState(false);
  const waitlist = pathname === '/waitlist' || (pathname === '/bookings' && new URLSearchParams(search).get('tab') === 'waitlisted');
  const primary = [
    { to: '/browse', label: 'Explore', icon: 'grid', active: pathname === '/' || pathname === '/browse' || pathname.startsWith('/services/') },
    { to: '/bookings', label: 'My bookings', icon: 'calendar', active: pathname === '/bookings' && !waitlist },
    { to: '/waitlist', label: 'Waitlist', icon: 'waitlist', active: waitlist },
  ];
  const organizer = [
    { to: '/organizer', label: 'Overview', icon: 'overview', active: pathname === '/organizer' },
    { to: '/organizer/services', label: 'My services', icon: 'briefcase', active: (pathname.startsWith('/organizer/services') && !pathname.endsWith('/new')) || pathname.startsWith('/organizer/slots') },
    { to: '/organizer/services/new', label: 'Create service', icon: 'plus', active: pathname === '/organizer/services/new' },
  ];
  const navLink = item => (
    <Link key={item.to} to={item.to} className={'nav-link ' + (item.active ? 'active' : '')} aria-current={item.active ? 'page' : undefined} onClick={onNavigate}>
      <Icon name={item.icon} size={17} /><span>{item.label}</span>
    </Link>
  );

  return (
    <>
      <div className="sidebar-brand">
        <Brand />
        {mobile && <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={onNavigate}><Icon name="x" /></button>}
      </div>
      <nav className="sidebar-nav" aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>
        <div className="nav-group">{primary.map(navLink)}</div>
        {user?.role === 'organizer' && <div className="nav-group"><span className="nav-section-label">For organizers</span>{organizer.map(navLink)}</div>}
        {user?.role === 'admin' && <div className="nav-group"><span className="nav-section-label">Administration</span>{navLink({ to: '/admin', label: 'Manage accounts', icon: 'shield', active: pathname === '/admin' })}</div>}
        {user ? (
          <div className="nav-group">
            <span className="nav-section-label">Your account</span>
            {navLink({ to: '/profile', label: 'Profile', icon: 'user', active: pathname === '/profile' })}
            {navLink({ to: '/notifications', label: 'Notifications', icon: 'bell', active: pathname === '/notifications' })}
          </div>
        ) : (
          <div className="nav-group">
            <span className="nav-section-label">For organizers</span>
            {navLink({ to: '/register?role=organizer', label: 'Offer a session', icon: 'briefcase' })}
          </div>
        )}
      </nav>
      <div className="sidebar-bottom">
        {user ? (
          <>
            <div className={'connection ' + (status === 'live' ? 'connected' : '')} role="status">
              <i />{status === 'live' ? 'Live updates connected' : 'Reconnecting to live updates'}
            </div>
            <div className="sidebar-account">
              <Link to="/profile" className="user-summary" onClick={onNavigate}>
                <Avatar user={user} /><span><strong>{user.name}</strong><small>{user.role}</small></span>
              </Link>
              <button className="icon-button signout" title="Sign out" aria-label="Sign out" disabled={leaving} onClick={async () => {
                setLeaving(true);
                try { await signOut(); onNavigate?.(); } finally { setLeaving(false); }
              }}><Icon name="logout" size={18} /></button>
            </div>
          </>
        ) : (
          <>
            <Link className="btn btn-sidebar full-width" to="/login" onClick={onNavigate}>Sign in<Icon name="arrow" size={17} /></Link>
            <Link className="sidebar-register" to="/register" onClick={onNavigate}>Create an account</Link>
          </>
        )}
      </div>
    </>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      element.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { element.close(); document.body.style.overflow = previousOverflow; };
    }
    element.close();
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 821px)');
    const closeOnDesktop = event => { if (event.matches) setOpen(false); };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="sidebar desktop-sidebar"><Navigation /></aside>
      <dialog ref={dialog} id="mobile-navigation" className="mobile-navigation" aria-label="Navigation" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="sidebar mobile-sidebar">{open && <Navigation mobile onNavigate={() => setOpen(false)} />}</div>
      </dialog>
      <div className="workspace">
        <header className="mobile-topbar">
          <button className="icon-button" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <Brand />
          {user ? <NotificationBell /> : <Link to="/login" className="mobile-signin">Sign in<Icon name="arrow" size={15} /></Link>}
        </header>
        <main id="main-content" className="page" tabIndex={-1}><Outlet /></main>
        <footer className="app-footer"><span>© {new Date().getFullYear()} ChronosLive</span><span>Live availability. Fair waitlists.</span></footer>
      </div>
    </div>
  );
}
