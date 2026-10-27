import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { servicesApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useSlotLive } from '../hooks/useSlotLive';
import { timeLabel } from '../utils/format';
import { Icon } from './ui';
import ServiceCover from './ServiceCover';

export default function ServiceCard({ service, priority = false }) {
  const schedule = useResource(signal => servicesApi.slots(service._id, { from: new Date().toISOString(), availableOnly: true, limit: 1 }, signal), [service._id]);
  useSlotLive(service._id);
  const next = schedule.data?.data?.[0];
  const seats = next ? Math.max(0, next.capacity - next.bookedCount) : 0;
  return (
    <Link to={'/services/' + service._id} className="service-card">
      <div className="service-cover"><ServiceCover service={service} priority={priority} /></div>
      <div className="service-card-body">
        <h2>{service.title}</h2>
        <p className="service-card-organizer">{service.organizer?.name || 'Organizer'}</p>
        <div className="service-card-details">
          <div><Icon name="calendar" size={15} /><span>{next ? format(new Date(next.startTime), 'EEE, d MMM') + ' · ' + timeLabel(next.startTime) : schedule.loading && !schedule.data ? 'Checking session times…' : schedule.error ? 'View session times' : 'View dates & waitlists'}</span></div>
          <div><Icon name={next && !seats ? 'waitlist' : 'users'} size={15} /><span>{next ? seats ? seats + (seats === 1 ? ' seat available' : ' seats available') : 'Full · waitlist available' : service.category}</span></div>
        </div>
        <div className="service-card-bottom"><span>{service.category}</span><span className="circle-arrow" aria-hidden="true"><Icon name="arrow" size={17} /></span></div>
      </div>
    </Link>
  );
}
