import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { errorMessage } from '../utils/format';
import { Avatar, Badge, Button, Field, Icon } from '../components/ui';
export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name), [file, setFile] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); setError('');
    if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { setError('Choose a JPEG, PNG or WebP image up to 2 MB.'); return; }
    setBusy(true);
    try { const result = await usersApi.profile(name.trim(), file); setUser(result.data); setFile(null); toast.success('Your profile has been updated.'); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><span className="eyebrow">A SPACE THAT’S YOURS</span><h1>A little about you.</h1><p>Help your organizer put a name to a face.</p></div></div><section className="form-panel profile-panel"><div className="profile-summary"><Avatar user={user} size="large"/><div><h2>{user.name}</h2><Badge>{user.role}</Badge></div></div><form className="stack-form" onSubmit={save}><Field label="Full name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required autoComplete="name"/><Field label="Email address" type="email" value={user.email} readOnly hint="Your sign-in email stays the same."/><Field label="Profile photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} hint="JPEG, PNG or WebP · up to 2 MB"/>{error && <p className="inline-error" role="alert">{error}</p>}<Button type="submit" loading={busy}>Save changes<Icon name="check" size={17}/></Button></form></section></>;
}
