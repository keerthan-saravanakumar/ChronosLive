import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { servicesApi } from '../api/services';
import { bookingsApi } from '../api/bookings';
import { useResource } from '../hooks/useResource';
import { useSlotLive } from '../hooks/useSlotLive';
import { dateLabel, timeLabel, errorMessage, refreshData } from '../utils/format';
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Icon, Skeletons } from '../components/ui';
export default function SlotRoster() {
  const { id } = useParams();
  const resource = useResource(signal => servicesApi.roster(id, signal), [id]);
  const [capacity, setCapacity] = useState(null), [busy, setBusy] = useState(false), [action, setAction] = useState(null), [reason, setReason] = useState(''), [error, setError] = useState('');
  useSlotLive(id, 'slot');
  async function saveCapacity(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await servicesApi.capacity(id, Number(capacity ?? resource.data.data.slot.capacity)); setCapacity(result.data.capacity); toast.success('Capacity updated. Eligible waiters are promoted automatically.'); refreshData(); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    setBusy(true);
    try {
      if (action.kind === 'remove') await bookingsApi.cancel(action.id);
      else await servicesApi.cancelSlot(id, reason);
      toast.success(action.kind === 'remove' ? 'Attendee removed. The next eligible person gets the seat.' : 'Session cancelled. Everyone affected will be notified.');
      setAction(null); setReason(''); refreshData();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  if (resource.error) return <ErrorState error={resource.error} retry={resource.refresh}/>;
  if (!resource.data) return <Skeletons/>;
  const { slot, attendees, waitlist } = resource.data.data;
  const editable = slot.status === 'open' && new Date(slot.startTime) > new Date();
  return <><Link className="text-link back-link" to={'/organizer/services/' + slot.service._id}><Icon name="back" size={16}/>{slot.service.title}</Link><div className="page-heading"><div><span className="eyebrow">PEOPLE MAKE THE SESSION</span><h1>A room full of possibility.</h1><p>{dateLabel(slot.startTime)} · {timeLabel(slot.startTime)} – {timeLabel(slot.endTime)}</p></div><Badge tone={slot.status === 'open' ? 'green' : 'gray'}>{slot.status}</Badge></div><div className="roster-summary"><div><strong>{slot.bookedCount}<span> / {slot.capacity}</span></strong><p>seats booked</p></div><div><strong>{slot.waitlistCount}</strong><p>people waiting</p></div><form onSubmit={saveCapacity} className="capacity-form"><Field label="Session capacity" type="number" min={1} max={100} step={1} required disabled={!editable || busy} value={capacity ?? slot.capacity} onChange={e => setCapacity(e.target.value)}/><Button type="submit" variant="secondary" loading={busy && !action} disabled={!editable}>Save capacity</Button></form></div>{error && <p className="inline-error" role="alert">{error}</p>}<div className="section-heading compact"><h2>Attendees</h2><span className="muted">{attendees.length} confirmed</span></div>{!attendees.length ? <EmptyState title="There’s room for someone new" description="Confirmed attendees will appear here as people book." icon="users"/> : <div className="table-wrap"><table><thead><tr><th>Attendee</th><th>Joined through</th><th>Manage</th></tr></thead><tbody>{attendees.map(booking => <tr key={booking._id}><td><div className="person-cell"><Avatar user={booking.user}/><span><strong>{booking.user?.name || 'Unavailable account'}</strong><small>{booking.user?.email}</small></span></div></td><td><Badge tone={booking.source === 'waitlist_promotion' ? 'green' : 'gray'}>{booking.source === 'waitlist_promotion' ? 'Waitlist promotion' : 'Direct booking'}</Badge></td><td><Button variant="secondary" className="btn-small" disabled={busy} onClick={() => setAction({ kind: 'remove', id: booking._id, name: booking.user?.name })}>Remove attendee</Button></td></tr>)}</tbody></table></div>}<div className="section-heading compact"><div><h2>A fair place in line.</h2><p>Oldest first. Eligibility is checked when a seat opens.</p></div></div>{!waitlist.length ? <EmptyState title="No one is waiting right now" description="When this session fills up, people can join the waitlist." icon="clock"/> : <div className="queue-list">{waitlist.map(entry => <div className="queue-row" key={entry._id}><span className="queue-position">#{entry.position}</span><Avatar user={entry.user}/><div><strong>{entry.user?.name || 'Unavailable account'}</strong><small>{entry.user?.email}</small></div>{!entry.user?.isActive ? <Badge tone="amber">Inactive account</Badge> : entry.position === 1 && <Badge>Next in line</Badge>}</div>)}</div>}<section className="danger-panel"><div><h3>Plans have changed?</h3><p>Cancelling this session releases all seats and expires the waitlist.</p></div><Button variant="danger" disabled={slot.status !== 'open' || busy} onClick={() => setAction({ kind: 'cancel' })}>Cancel session</Button></section><ConfirmDialog open={Boolean(action)} title={action?.kind === 'remove' ? 'Remove ' + action.name + '?' : 'Cancel this entire session?'} onClose={() => setAction(null)} onConfirm={confirmAction} busy={busy} danger confirmLabel={action?.kind === 'remove' ? 'Remove attendee' : 'Cancel session'}><p>{action?.kind === 'remove' ? 'Their booking will be cancelled and the next eligible person waiting will be offered the seat.' : 'All attendees and waiting users will be notified. This action cannot restore their reservations automatically.'}</p>{action?.kind === 'cancel' && <Field label="Reason (optional)"><textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={300}/></Field>}</ConfirmDialog></>;
}
