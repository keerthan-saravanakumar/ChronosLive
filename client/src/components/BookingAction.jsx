import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { bookingsApi } from '../api/bookings';
import { errorMessage, errorCode, refreshData, idOf, localDate } from '../utils/format';
import { isUpcomingSlot } from '../utils/schedule';
import { Button, ConfirmDialog, Icon } from './ui';

export default function BookingAction({ slot, service, compact = false }) {
  const { user } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState(null);
  const booking = slot?.myBooking;
  const waiting = slot?.myWaitlist;
  const owns = user && slot && idOf(slot.organizer) === user._id;
  const closed = slot && !isUpcomingSlot(slot);
  const full = slot && slot.bookedCount >= slot.capacity;
  const archived = service?.isActive === false;
  const buttonClass = compact ? 'btn-small' : 'full-width';
  const returnParams = new URLSearchParams(location.search);
  if (slot && location.pathname.startsWith('/services/')) {
    returnParams.set('slot', slot._id);
    returnParams.set('day', localDate(slot.startTime));
  }
  const returnTo = location.pathname + (returnParams.size ? '?' + returnParams.toString() : '');

  async function act(action) {
    setBusy(true);
    setError(null);
    try {
      if (action === 'book') await bookingsApi.book(slot._id);
      if (action === 'join') await bookingsApi.join(slot._id);
      if (action === 'cancel') await bookingsApi.cancel(booking._id);
      if (action === 'leave') await bookingsApi.leave(slot._id);
      toast.success({
        book: 'Your booking is confirmed.',
        join: 'You’re on the waitlist. We’ll notify you when a seat opens.',
        cancel: 'Booking cancelled. The next eligible person can take your place.',
        leave: 'You have left the waitlist.',
      }[action]);
      setConfirm(null);
      refreshData();
    } catch (error) {
      setError(error);
      toast.error(errorMessage(error));
      refreshData();
    } finally {
      setBusy(false);
    }
  }

  let action;
  if (!slot) action = <Button disabled className={buttonClass}>Select a session</Button>;
  else if (owns) action = <Link to={'/organizer/slots/' + slot._id} className={'btn btn-secondary ' + buttonClass}>Manage session<Icon name="arrow" size={16} /></Link>;
  else if (closed) action = <Button variant="secondary" disabled className={buttonClass}>Session {slot.status === 'cancelled' ? 'cancelled' : 'closed'}</Button>;
  else if (!user) action = <Link to="/login" state={{ from: returnTo }} className={'btn btn-primary ' + buttonClass}>Sign in to book<Icon name="arrow" size={16} /></Link>;
  else if (booking) action = <Button variant="secondary" className={buttonClass + ' cancel-booking'} loading={busy} onClick={() => setConfirm('cancel')}>Cancel booking</Button>;
  else if (waiting) action = <Button variant="secondary" className={buttonClass} loading={busy} onClick={() => setConfirm('leave')}>Leave waitlist</Button>;
  else action = <Button className={buttonClass} loading={busy} disabled={archived} onClick={() => act(full ? 'join' : 'book')}>{archived ? 'Service archived' : full ? 'Join waitlist' : 'Book session'}<Icon name={full ? 'plus' : 'arrow'} size={16} /></Button>;

  return (
    <div className="booking-action">
      {action}
      {error && <div className="inline-error" role="alert">{errorMessage(error)}{errorCode(error) === 'SLOT_FULL' && !waiting && <button disabled={busy} className="text-link" onClick={() => act('join')}>Join the waitlist<Icon name="arrow" size={14} /></button>}</div>}
      <ConfirmDialog open={Boolean(confirm)} title={confirm === 'cancel' ? 'Cancel this booking?' : 'Leave this waitlist?'} busy={busy} onClose={() => setConfirm(null)} onConfirm={() => act(confirm)} confirmLabel={confirm === 'cancel' ? 'Cancel booking' : 'Leave waitlist'} cancelLabel={confirm === 'cancel' ? 'Keep booking' : 'Stay on waitlist'} danger>
        <p>{confirm === 'cancel' ? 'Your seat will be offered to the next eligible person waiting. You can book again if a seat is available.' : 'You’ll lose your current position. Joining again puts you at the end of the queue.'}</p>
      </ConfirmDialog>
    </div>
  );
}
