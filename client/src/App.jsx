import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import AppLayout from './layouts/AppLayout';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { Skeletons } from './components/ui';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const Browse = lazy(() => import('./pages/Browse'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Organizer = lazy(() => import('./pages/Organizer'));
const ServiceManager = lazy(() => import('./pages/ServiceManager'));
const SlotRoster = lazy(() => import('./pages/SlotRoster'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
export default function App() {
  return <ErrorBoundary><AuthProvider><SocketProvider>
    <Suspense fallback={<div className="page"><Skeletons/></div>}>
      <Routes>
        <Route path="/" element={<Landing/>}/>
        <Route path="/login" element={<Auth/>}/>
        <Route path="/register" element={<Auth register/>}/>
        <Route element={<AppLayout/>}>
          <Route path="/browse" element={<Browse/>}/>
          <Route path="/services/:id" element={<ServiceDetail/>}/>
          <Route element={<ProtectedRoute/>}>
            <Route path="/bookings" element={<MyBookings/>}/>
            <Route path="/notifications" element={<Notifications/>}/>
            <Route path="/profile" element={<Profile/>}/>
            <Route element={<RoleRoute roles={['organizer']}/>}>
              <Route path="/organizer" element={<Organizer/>}/>
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
    <Toaster position="top-right" toastOptions={{ duration: 4500, style: { borderRadius: '12px', fontFamily: 'inherit', fontSize: '14px', maxWidth: '420px' } }}/>
  </SocketProvider></AuthProvider></ErrorBoundary>;
}
