import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { bookingsApi } from '../api/bookings';
import { timeLabel, errorMessage, errorCode, refreshData, idOf } from '../utils/format';
import { Badge, Button, ConfirmDialog, Icon } from './ui';
export default function SlotCard({ slot, service, showService = false }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(null), [error, setError] = useState(null);
  const booking = slot.myBooking, waiting = slot.myWaitlist;
  const closed = slot.status !== 'open' || new Date(slot.startTime) <= new Date();
  const full = slot.bookedCount >= slot.capacity;
  const owns = user && idOf(slot.organizer) === user._id;
  const archived = service?.isActive === false;
  async function act(action) {
    setBusy(true); setError(null);
    try {
      if (action === 'book') await bookingsApi.book(slot._id);
      if (action === 'join') await bookingsApi.join(slot._id);
      if (action === 'cancel') await bookingsApi.cancel(booking._id);
      if (action === 'leave') await bookingsApi.leave(slot._id);
      toast.success({ book: 'Your seat is confirmed.', join: 'You’re on the waitlist. We’ll keep you updated.', cancel: 'Booking cancelled. The next person can take your place.', leave: 'You have left the waitlist.' }[action]);
      setConfirm(null); refreshData();
    } catch (error) { setError(error); toast.error(errorMessage(error)); refreshData(); }
    finally { setBusy(false); }
  }
  return <article className={'slot-card ' + (booking ? 'is-booked' : '')}>
    {showService && <Link className="slot-service-title" to={'/services/' + idOf(service)}>{service?.title}<Icon name="arrow" size={16}/></Link>}
    <div className="slot-top"><div><span className="eyebrow">SESSION TIME</span><h3>{timeLabel(slot.startTime)} <span>– {timeLabel(slot.endTime)}</span></h3></div><span className="slot-clock"><Icon name="clock"/></span></div>
    <div className="slot-badges">{booking ? <Badge><Icon name="check" size={13}/>You’re booked</Badge> : waiting ? <Badge tone="amber">Waitlist · #{waiting.position}</Badge> : closed ? <Badge tone="gray">{slot.status === 'cancelled' ? 'Cancelled' : 'Closed'}</Badge> : <Badge tone={full ? 'amber' : 'green'}>{full ? 'Full · waitlist open' : (slot.capacity - slot.bookedCount) + ' seats available'}</Badge>}</div>
    <div className="seat-count"><span><Icon name="users" size={16}/>{slot.bookedCount}/{slot.capacity} booked</span><span>{slot.waitlistCount} waiting</span></div><div className={'capacity-track ' + (full ? 'full' : '')}><div style={{ width: Math.min(100, slot.bookedCount / slot.capacity * 100) + '%' }}/></div>
    {owns ? <span className="slot-footnote">You organize this session.</span> : !user ? <Link to="/login" className="btn btn-secondary full-width">Sign in to book<Icon name="arrow" size={16}/></Link> : closed ? <Button variant="secondary" disabled className="full-width">Session {slot.status === 'cancelled' ? 'cancelled' : 'closed'}</Button> : booking ? <Button variant="secondary" className="full-width" loading={busy} onClick={() => setConfirm('cancel')}>Cancel booking</Button> : waiting ? <Button variant="secondary" className="full-width" loading={busy} onClick={() => setConfirm('leave')}>Leave waitlist</Button> : <Button variant={full ? 'secondary' : 'primary'} className="full-width" loading={busy} disabled={archived} onClick={() => act(full ? 'join' : 'book')}>{archived ? 'Service archived' : full ? 'Join waitlist' : 'Book this session'}<Icon name={full ? 'plus' : 'arrow'} size={16}/></Button>}
    {error && <div className="inline-error" role="alert">{errorMessage(error)}{errorCode(error) === 'SLOT_FULL' && !waiting && <button disabled={busy} className="text-link" onClick={() => act('join')}>Join the waitlist<Icon name="arrow" size={15}/></button>}</div>}
    <ConfirmDialog open={Boolean(confirm)} title={confirm === 'cancel' ? 'Release your seat?' : 'Leave this waitlist?'} busy={busy} onClose={() => setConfirm(null)} onConfirm={() => act(confirm)} confirmLabel={confirm === 'cancel' ? 'Cancel booking' : 'Leave waitlist'} danger><p>{confirm === 'cancel' ? 'Your place will be offered to the next eligible person waiting. You can book again if a seat is available.' : 'You’ll lose your current position. Joining again puts you at the end of the queue.'}</p></ConfirmDialog>
  </article>;
}
