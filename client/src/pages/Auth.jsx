import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Icon } from '../components/ui';
import { errorMessage } from '../utils/format';
import { authDestination } from '../utils/navigation';

export default function Auth({ register = false }) {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(() => new URLSearchParams(location.search).get('role') === 'organizer' ? 'organizer' : 'attendee');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user) return <Navigate to={authDestination(user, location.state?.from)} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (new TextEncoder().encode(values.password).length > 72) { setError('Please use a password of at most 72 bytes.'); return; }
    setBusy(true);
    try {
      const account = await signIn(register ? { name: values.name, email: values.email, password: values.password, role } : values, register);
      navigate(authDestination(account, location.state?.from), { replace: true });
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <header className="auth-mobile-header"><Brand /><Link to="/browse" className="text-link">Explore sessions<Icon name="arrow" size={15} /></Link></header>
      <aside className="auth-aside">
        <Brand />
        <div className="auth-aside-content"><h2>Your sessions,<br />in one place.</h2><p>Manage your bookings, follow your waitlist, and stay up to date with your schedule.</p></div>
        <span className="auth-aside-footer">© {new Date().getFullYear()} ChronosLive</span>
      </aside>
      <main className="auth-main">
        <Link className="text-link auth-back" to="/browse"><Icon name="back" size={16} />Back to explore</Link>
        <div className="auth-form-wrap">
          <h1>{register ? 'Create an account' : 'Welcome back'}</h1>
          <p>{register ? 'Join ChronosLive to book or organize sessions.' : 'Sign in to view your schedule and manage your bookings.'}</p>
          <form onSubmit={submit} className="stack-form">
            {register && <Field label="Full name" name="name" autoComplete="name" required minLength={2} maxLength={80} />}
            <Field label="Email address" name="email" type="email" autoComplete="email" required maxLength={254} />
            <Field label="Password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : 1} maxLength={72} hint={register ? 'At least 8 characters.' : undefined} />
            {register && <fieldset className="role-picker"><legend>I want to</legend>{[
              { value: 'attendee', title: 'Attend sessions', copy: 'Explore services and reserve a seat.', icon: 'calendar' },
              { value: 'organizer', title: 'Organize sessions', copy: 'Publish services and manage your schedule.', icon: 'users' },
            ].map(option => <label key={option.value} className={'role-option ' + (role === option.value ? 'selected' : '')}><input type="radio" name="roleChoice" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} /><Icon name={option.icon} size={19} /><span><strong>{option.title}</strong><small>{option.copy}</small></span></label>)}</fieldset>}
            {error && <p role="alert" className="inline-error">{error}</p>}
            <Button className="full-width btn-large" loading={busy} type="submit">{busy ? register ? 'Creating your account…' : 'Signing in…' : register ? 'Create account' : 'Sign in'}<Icon name="arrow" size={17} /></Button>
          </form>
          <p className="auth-switch">{register ? 'Already have an account?' : 'New to ChronosLive?'} <Link to={register ? '/login' : '/register'} state={location.state}>{register ? 'Sign in' : 'Create an account'}</Link></p>
        </div>
        <span className="auth-bottom"><Icon name="shield" size={14} />Secure access to your bookings and account.</span>
      </main>
    </div>
  );
}
