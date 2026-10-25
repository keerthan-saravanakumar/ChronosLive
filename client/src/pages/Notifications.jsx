import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { notificationsApi } from '../api/notifications';
import { useResource } from '../hooks/useResource';
import { errorMessage, refreshData } from '../utils/format';
import { Badge, Button, EmptyState, ErrorState, Icon, Pagination, Skeletons } from '../components/ui';
export default function Notifications() {
  const [page, setPage] = useState(1), [busy, setBusy] = useState(null);
  const resource = useResource(signal => notificationsApi.list({ page, limit: 20 }, signal), [page]);
  async function read(id) {
    setBusy(id || 'all');
    try { await (id ? notificationsApi.read(id) : notificationsApi.readAll()); refreshData(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(null); }
  }
  return <><div className="page-heading"><div><span className="eyebrow">THE LITTLE THINGS THAT KEEP YOU IN SYNC</span><h1>You’re in the loop.</h1><p>Updates on your sessions, seats, and place in line.</p></div><Button variant="secondary" loading={busy === 'all'} disabled={!resource.data?.meta.unread} onClick={() => read()}>Mark all as read<Icon name="check" size={17}/></Button></div>{resource.error ? <ErrorState error={resource.error} retry={resource.refresh}/> : resource.loading && !resource.data ? <Skeletons/> : !resource.data?.data.length ? <EmptyState title="All quiet for now" description="Your booking confirmations, reminders and waitlist updates will appear here." icon="bell"/> : <div className="notification-list">{resource.data.data.map(item => <article key={item._id} className={'notification-row ' + (!item.read ? 'unread' : '')}><span className="notification-icon"><Icon name={item.type === 'promoted' ? 'spark' : item.type.includes('cancel') ? 'calendar' : item.type === 'reminder' ? 'clock' : 'bell'}/></span><div className="notification-copy"><div>{item.type === 'promoted' && <Badge>A seat is yours</Badge>}<time dateTime={item.createdAt}>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</time></div><p>{item.message}</p><Link to="/bookings" className="text-link">View my bookings<Icon name="arrow" size={14}/></Link></div>{!item.read && <Button className="btn-small" variant="secondary" loading={busy === item._id} onClick={() => read(item._id)}>Mark read</Button>}</article>)}</div>}<Pagination meta={resource.data?.meta} onPage={setPage}/></>;
}
