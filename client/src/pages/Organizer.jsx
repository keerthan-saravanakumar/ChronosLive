import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { servicesApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useSlotLive } from '../hooks/useSlotLive';
import { dateLabel, timeLabel } from '../utils/format';
import { Badge, EmptyState, ErrorState, Icon, Skeletons } from '../components/ui';

function Subscription({ id }) { useSlotLive(id); return null; }

export default function Organizer() {
  const { user } = useAuth();
  const summary = useResource(signal => usersApi.stats(signal));
  const services = useResource(signal => servicesApi.list({ organizer: user._id, includeInactive: true, limit: 100 }, signal), [user._id]);
  const stats = summary.data?.data;
  return (
    <div className="organizer-page">
      {services.data?.data.map(service => <Subscription key={service._id} id={service._id} />)}
      <div className="page-heading"><div><h1>Overview</h1><p>Manage your services, slots and bookings.</p></div><Link to="/organizer/services/new" className="btn btn-primary"><Icon name="plus" size={16} />Create service</Link></div>
      {summary.error ? <ErrorState error={summary.error} retry={summary.refresh} /> : !stats ? <Skeletons count={4} /> : (
        <>
          <div className="stats-grid">
            {[
              ['Active services', stats.activeServices, 'Your published services'],
              ['Upcoming sessions', stats.upcomingSlots, 'Available and booked sessions'],
              ['In waitlist', stats.waitlistDemand, 'People waiting for a seat'],
              ['Seat utilization', stats.fillRate + '%', stats.bookedSeats + ' of ' + stats.totalSeats + ' upcoming seats'],
            ].map(([label, value, hint]) => <div className="stat-card" key={label}><strong>{value}</strong><span>{label}</span><small>{hint}</small></div>)}
          </div>
          <section className="dashboard-panel">
            <div className="dashboard-panel-heading"><h2>Upcoming sessions</h2><Link to="/organizer/services" className="text-link">View services<Icon name="arrow" size={16} /></Link></div>
            {stats.nextSlots.length ? <div className="table-wrap"><table><thead><tr><th>Service</th><th>Date & time</th><th>Bookings</th><th>Waitlist</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{stats.nextSlots.map(slot => <tr key={slot._id}><td><strong>{slot.service.title}</strong></td><td>{dateLabel(slot.startTime)}<small>{timeLabel(slot.startTime)} – {timeLabel(slot.endTime)}</small></td><td>{slot.bookedCount} / {slot.capacity}</td><td>{slot.waitlistCount}</td><td><Badge tone={slot.bookedCount >= slot.capacity ? 'amber' : 'green'}>{slot.bookedCount >= slot.capacity ? 'Full' : 'Available'}</Badge></td><td><Link to={'/organizer/slots/' + slot._id} className="table-action" aria-label={'View roster for ' + slot.service.title + ', ' + dateLabel(slot.startTime) + ', ' + timeLabel(slot.startTime)}>View roster<Icon name="arrow" size={14} /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="No upcoming sessions" description="Create a service or add session times to an existing service." to="/organizer/services" action="Manage services" />}
          </section>
          <div className="dashboard-secondary">
            <section className="dashboard-panel">
              <div className="dashboard-panel-heading"><h2>The week ahead</h2><span className="muted">IST</span></div>
              {stats.daily.length ? <div className="occupancy-chart" aria-label="Booked seats by day">{stats.daily.map(day => <div className="chart-day" key={day._id} title={day.booked + ' of ' + day.capacity + ' seats booked'}><span>{day.booked}/{day.capacity}</span><div className="chart-track"><i style={{ height: day.capacity ? day.booked / day.capacity * 100 + '%' : '0%' }} /></div><small>{format(new Date(day._id + 'T12:00:00'), 'EEE')}</small></div>)}</div> : <p className="panel-empty">Your schedule will appear here when you add session times.</p>}
            </section>
            <section className="dashboard-panel waitlist-summary"><div className="dashboard-panel-heading"><h2>Waitlist activity</h2><Icon name="waitlist" size={19} /></div><div><strong>{stats.promotions}</strong><span>automatic promotions</span></div><p>{stats.cancellations} cancellations recorded. Released seats are offered to the next eligible person in line.</p><Link className="text-link" to="/organizer/services">Manage session rosters<Icon name="arrow" size={15} /></Link></section>
          </div>
        </>
      )}
      {services.error && <ErrorState error={services.error} retry={services.refresh} />}
    </div>
  );
}
