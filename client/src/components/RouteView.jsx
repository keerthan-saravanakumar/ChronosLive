import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteView() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const titles = {
      '/': 'Explore sessions', '/browse': 'Explore sessions', '/bookings': 'My bookings',
      '/waitlist': 'My waitlist', '/organizer': 'Organizer overview',
      '/organizer/services': 'My services', '/organizer/services/new': 'Create service',
      '/login': 'Sign in', '/register': 'Create an account', '/profile': 'My profile',
      '/notifications': 'Notifications', '/admin': 'Manage accounts',
    };
    document.title = `${titles[pathname] || 'Session details'} · ChronosLive`;
  }, [pathname]);
  return null;
}
