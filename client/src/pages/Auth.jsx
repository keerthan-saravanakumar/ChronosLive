import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../layouts/AppLayout';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Icon } from '../components/ui';
import { errorMessage } from '../utils/format';
export default function Auth({ register = false }) {
  const { user, signIn } = useAuth(), navigate = useNavigate(), location = useLocation();
  const [role, setRole] = useState('attendee'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (user) return <Navigate to="/browse" replace/>;
  async function submit(event) {
    event.preventDefault(); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (new TextEncoder().encode(values.password).length > 72) { setError('Please use a password of at most 72 bytes.'); return; }
    setBusy(true);
    try {
      await signIn(register ? { name: values.name, email: values.email, password: values.password, role } : values, register);
      const target = location.state?.from;
      navigate(target?.startsWith('/') && !target.startsWith('//') ? target : '/browse', { replace: true });
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><section className="auth-aside"><Brand/><div><span className="eyebrow">A LITTLE TIME. A LOT OF POSSIBILITY.</span><h1>Good things<br/>start with<br/><em>showing up.</em></h1><p>Find your people, your moment,<br/>and a little room to grow.</p><span className="auth-flower" aria-hidden="true">✳</span></div><span className="auth-aside-footer">Your time, thoughtfully planned.</span></section><main className="auth-main"><Link className="text-link auth-back" to="/"><Icon name="back" size={16}/>Back to home</Link><div className="auth-form-wrap"><span className="eyebrow">{register ? 'LET’S MAKE SOME ROOM' : 'YOUR NEXT SESSION AWAITS'}</span><h1>{register ? 'Find your place.' : 'Welcome back.'}</h1><p>{register ? 'A few details, and you’re ready to get started.' : 'Sign in to pick up where you left off.'}</p><form onSubmit={submit} className="stack-form">{register && <Field label="Full name" name="name" autoComplete="name" required minLength={2} maxLength={80}/>}<Field label="Email address" name="email" type="email" autoComplete="email" required maxLength={254}/><Field label="Password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : 1} maxLength={72} hint={register ? 'At least 8 characters. Make it something unique.' : undefined}/>{register && <fieldset className="role-picker"><legend>I’m here to…</legend>{[{ value: 'attendee', title: 'Attend sessions', copy: 'Find a time and save a seat.', icon: 'calendar' }, { value: 'organizer', title: 'Organize sessions', copy: 'Share your time with others.', icon: 'users' }].map(option => <label key={option.value} className={'role-option ' + (role === option.value ? 'selected' : '')}><input type="radio" name="roleChoice" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)}/><Icon name={option.icon}/><span><strong>{option.title}</strong><small>{option.copy}</small></span></label>)}</fieldset>}{error && <p role="alert" className="inline-error">{error}</p>}<Button className="full-width btn-large" loading={busy} type="submit">{busy ? (register ? 'Creating your account…' : 'Signing in…') : register ? 'Create your account' : 'Sign in'}<Icon name="arrow" size={18}/></Button></form><p className="auth-switch">{register ? 'Already have an account?' : 'New around here?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p></div><span className="auth-bottom"><Icon name="shield" size={15}/>Your bookings stay yours. Your time stays protected.</span></main></div>;
}
