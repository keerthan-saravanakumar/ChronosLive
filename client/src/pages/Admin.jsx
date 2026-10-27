import { useState } from 'react';
import toast from 'react-hot-toast';
import { usersApi } from '../api/users';
import { useResource } from '../hooks/useResource';
import { errorMessage, refreshData } from '../utils/format';
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Icon, Pagination, Skeletons } from '../components/ui';
export default function Admin() {
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [target, setTarget] = useState(null), [busy, setBusy] = useState(false);
  const resource = useResource(signal => usersApi.list({ page, limit: 20, search: search || undefined }, signal), [page, search]);
  async function changeStatus() {
    setBusy(true);
    try { await usersApi.status(target._id, !target.isActive); toast.success(target.isActive ? 'Account deactivated.' : 'Account reactivated.'); setTarget(null); refreshData(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>Manage Accounts</h1><p>Manage account access while preserving people’s existing reservations.</p></div><Badge tone="gray">Admin</Badge></div><form className="search-panel" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setPage(1); }}><div className="search-input"><Icon name="search"/><input aria-label="Search users" placeholder="Find someone by name or email" value={query} onChange={e => setQuery(e.target.value)} maxLength={100}/></div><Button type="submit">Search</Button></form>{resource.error ? <ErrorState error={resource.error} retry={resource.refresh}/> : resource.loading ? <Skeletons/> : !resource.data?.data.length ? <EmptyState title="No matching accounts" description="Try another name or email." icon="users"/> : <div className="table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>{resource.data.data.map(user => <tr key={user._id}><td><div className="person-cell"><Avatar user={user}/><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td><Badge tone="gray">{user.role}</Badge></td><td><Badge tone={user.isActive ? 'green' : 'amber'}>{user.isActive ? 'Active' : 'Inactive'}</Badge></td><td>{user.role === 'admin' ? <span className="muted">Protected account</span> : <Button variant="secondary" className="btn-small" onClick={() => setTarget(user)}>{user.isActive ? 'Deactivate' : 'Reactivate'}</Button>}</td></tr>)}</tbody></table></div>}<Pagination meta={resource.data?.meta} onPage={setPage}/><ConfirmDialog open={Boolean(target)} title={(target?.isActive ? 'Deactivate ' : 'Reactivate ') + (target?.name || 'account') + '?'} onClose={() => setTarget(null)} onConfirm={changeStatus} busy={busy} confirmLabel={target?.isActive ? 'Deactivate account' : 'Reactivate account'} danger={target?.isActive}><p>{target?.isActive ? 'All sessions will end. Existing bookings remain, and waiting entries become ineligible for promotion. Owned services are unchanged.' : 'This person can sign in again. Previously revoked sessions will stay revoked.'}</p></ConfirmDialog></>;
}
