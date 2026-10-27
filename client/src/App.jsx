import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import AppLayout from './layouts/AppLayout';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { Skeletons } from './components/ui';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import RouteView from './components/RouteView';
const Auth = lazy(() => import('./pages/Auth'));
const Browse = lazy(() => import('./pages/Browse'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Organizer = lazy(() => import('./pages/Organizer'));
const OrganizerServices = lazy(() => import('./pages/OrganizerServices'));
const ServiceManager = lazy(() => import('./pages/ServiceManager'));
const SlotRoster = lazy(() => import('./pages/SlotRoster'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
export default function App() {
  return <ErrorBoundary><AuthProvider><SocketProvider>
    <RouteView/>
    <Suspense fallback={<div className="page"><Skeletons/></div>}>
      <Routes>
        <Route path="/login" element={<Auth/>}/>
        <Route path="/register" element={<Auth register/>}/>
        <Route element={<AppLayout/>}>
          <Route path="/" element={<Browse/>}/>
          <Route path="/browse" element={<Browse/>}/>
          <Route path="/services/:id" element={<ServiceDetail/>}/>
          <Route element={<ProtectedRoute/>}>
            <Route path="/bookings" element={<MyBookings/>}/>
            <Route path="/waitlist" element={<MyBookings waitlist/>}/>
            <Route path="/notifications" element={<Notifications/>}/>
            <Route path="/profile" element={<Profile/>}/>
            <Route element={<RoleRoute roles={['organizer']}/>}>
              <Route path="/organizer" element={<Organizer/>}/>
              <Route path="/organizer/services" element={<OrganizerServices/>}/>
              <Route path="/organizer/services/new" element={<ServiceManager/>}/>
              <Route path="/organizer/services/:id" element={<ServiceManager/>}/>
              <Route path="/organizer/slots/:id" element={<SlotRoster/>}/>
            </Route>
            <Route element={<RoleRoute roles={['admin']}/>}>
              <Route path="/admin" element={<Admin/>}/>
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound/>}/>
      </Routes>
    </Suspense>
    <Toaster position="top-right" toastOptions={{ duration: 4500, style: { borderRadius: '6px', fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", fontSize: '13px', maxWidth: '420px', color: '#151311', background: '#F8F1E8', border: '1px solid rgba(75,38,47,0.18)', boxShadow: '0 8px 24px rgba(21,19,17,0.08)' } }}/>
  </SocketProvider></AuthProvider></ErrorBoundary>;
}
