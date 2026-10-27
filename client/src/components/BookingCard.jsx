import { Link } from 'react-router-dom';
import { dateLabel, timeLabel, localDate, idOf } from '../utils/format';
import { bookingStatus, isUpcomingSlot } from '../utils/schedule';
import { Badge, Icon } from './ui';
import ServiceCover from './ServiceCover';
import BookingAction from './BookingAction';

export default function BookingCard({ item, waitlist = false, cancelled = false }) {
  const slot = item.slot;
  const service = item.service || slot?.service;
  if (!slot || !service) return null;
  const status = bookingStatus(item, waitlist);
  const date = localDate(slot.startTime);
  const detail = '/services/' + idOf(service) + '?from=' + date + '&to=' + date + '&slot=' + slot._id;
  const actionable = !cancelled && isUpcomingSlot(slot);
  return (
    <article className={'booking-card ' + (waitlist ? 'waitlist-card' : '')}>
      <Link to={detail} className="booking-cover" aria-label={'View ' + service.title}><ServiceCover service={service} /></Link>
      <div className="booking-card-main">
        <div className="booking-card-heading">
          <div><h2><Link to={detail}>{service.title}</Link></h2><p>{service.organizer?.name ? 'By ' + service.organizer.name : service.category}</p></div>
          <div className="booking-status"><Badge tone={status.tone}><Icon name={waitlist ? 'waitlist' : status.tone === 'green' ? 'check' : 'calendar'} size={12} />{status.label}</Badge>{waitlist && <small>#{item.position} in queue</small>}</div>
        </div>
        <div className="booking-card-details">
          <span><Icon name="calendar" size={15} />{dateLabel(slot.startTime)}<i>·</i>{timeLabel(slot.startTime)} – {timeLabel(slot.endTime)}</span>
          <span><Icon name="location" size={15} />{service.location}</span>
        </div>
        {cancelled && <p className="booking-cancel-reason">{item.cancelReason || (item.status === 'cancelled_by_organizer' ? 'Cancelled by the organizer.' : 'This booking was cancelled.')}</p>}
        <div className="booking-card-actions">
          <Link className="btn btn-secondary btn-small" to={cancelled ? '/services/' + idOf(service) : detail}>{cancelled ? 'Find another time' : 'View details'}</Link>
          {actionable && <BookingAction slot={{ ...slot, myBooking: waitlist ? null : item, myWaitlist: waitlist ? item : null }} service={service} compact />}
        </div>
      </div>
    </article>
  );
}
