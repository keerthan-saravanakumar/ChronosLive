import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Skeletons } from './ui';
export function ProtectedRoute() {
  const { user, loading } = useAuth(), location = useLocation();
  if (loading) return <div className="page"><Skeletons/></div>;
  return user ? <Outlet/> : <Navigate to="/login" state={{ from: location.pathname + location.search }} replace/>;
}
export function RoleRoute({ roles }) {
  const { user } = useAuth();
  return roles.includes(user?.role) ? <Outlet/> : <EmptyState title="This space belongs to another role" description="Head back to your bookings or explore a session." to="/browse"/>;
}
