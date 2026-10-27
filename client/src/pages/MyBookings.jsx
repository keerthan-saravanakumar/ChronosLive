import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi } from '../api/bookings';
import { useResource } from '../hooks/useResource';
import { useSlotLive } from '../hooks/useSlotLive';
import { localDate, idOf, timezone } from '../utils/format';
import BookingCard from '../components/BookingCard';
import Calendar from '../components/Calendar';
import { EmptyState, ErrorState, Icon, Skeletons } from '../components/ui';

function LiveService({ id }) { useSlotLive(id); return null; }

function BookingView({ tab, params, setParams }) {
  const resource = useResource(signal => tab === 'waitlisted' ? bookingsApi.waitlist(signal) : bookingsApi.list(tab, signal), [tab]);
  const items = resource.data?.data || [];
  const selectedDate = params.get('date') || '';
  const visible = selectedDate ? items.filter(item => item.slot && localDate(item.slot.startTime) === selectedDate) : items;
  const serviceIds = [...new Set(items.map(item => idOf(item.service || item.slot?.service)).filter(Boolean))];
  const setDate = date => { const next = new URLSearchParams(params); date ? next.set('date', date) : next.delete('date'); setParams(next, { replace: true }); };
  const waiting = tab === 'waitlisted';
  const views = [['upcoming', 'Upcoming'], ['past', 'Past'], ['waitlisted', 'Waitlist'], ['cancelled', 'Cancelled']];

  return (
    <div className="bookings-page">
      {serviceIds.map(id => <LiveService id={id} key={id} />)}
      <div className="page-heading"><div><h1>{waiting ? 'My Waitlist' : 'My Bookings'}</h1><p>{waiting ? 'Your place in line, with automatic updates when a seat opens.' : 'Your upcoming sessions and booking history, in one place.'}</p></div></div>
      <div className="bookings-layout">
        <div className="bookings-main">
          <nav className="tabs" aria-label="Booking views">{views.map(([value, label]) => <Link key={value} to={value === 'waitlisted' ? '/waitlist' : '/bookings?tab=' + value} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined}>{label}{tab === value && resource.data && <span className="tab-count">{items.length}</span>}</Link>)}</nav>
          <details className="mobile-calendar"><summary>Filter by date<Icon name="calendar" size={17} /></summary><Calendar dates={items.filter(item => item.slot).map(item => localDate(item.slot.startTime))} selected={selectedDate} onSelect={setDate} /></details>
          {selectedDate && <div className="date-filter-notice"><span>Showing {selectedDate}</span><button className="text-link" onClick={() => setDate('')}>Clear date<Icon name="x" size={13} /></button></div>}
          {resource.error ? <ErrorState error={resource.error} retry={resource.refresh} /> : resource.loading && !resource.data ? <Skeletons count={2} /> : !visible.length ? (
            <EmptyState title={selectedDate ? 'No sessions on this date' : waiting ? 'You’re not on a waitlist' : tab === 'upcoming' ? 'No upcoming bookings' : 'No bookings to display'} description={selectedDate ? 'Select another date or clear the calendar filter.' : waiting ? 'When a session is full, join its waitlist to be considered for the next available seat.' : 'Explore the schedule and reserve a session that works for you.'} to="/browse" action="Explore sessions" icon={waiting ? 'waitlist' : 'calendar'} />
          ) : <div className="booking-list" aria-busy={resource.loading}>{visible.map(item => <BookingCard key={item._id} item={item} waitlist={waiting} cancelled={tab === 'cancelled'} />)}</div>}
          <p className="timezone-note">Session times are shown in {timezone}.</p>
        </div>
        <aside className="bookings-rail">
          <div className="desktop-calendar"><Calendar dates={items.filter(item => item.slot).map(item => localDate(item.slot.startTime))} selected={selectedDate} onSelect={setDate} /></div>
          <section className="quick-actions"><h2>Quick Actions</h2><Link to="/browse"><Icon name="search" size={17} /><span>Explore sessions</span><Icon name="chevron" size={15} /></Link><Link to={waiting ? '/bookings' : '/waitlist'}><Icon name={waiting ? 'calendar' : 'waitlist'} size={17} /><span>{waiting ? 'View my bookings' : 'View waitlist'}</span><Icon name="chevron" size={15} /></Link></section>
          {waiting && <p className="rail-note"><Icon name="waitlist" size={18} />Seats are offered to the first eligible person in line. Your position updates automatically.</p>}
        </aside>
      </div>
    </div>
  );
}

export default function MyBookings({ waitlist = false }) {
  const [params, setParams] = useSearchParams();
  const selected = waitlist ? 'waitlisted' : params.get('tab') || 'upcoming';
  const tab = ['upcoming', 'waitlisted', 'past', 'cancelled'].includes(selected) ? selected : 'upcoming';
  return <BookingView key={tab} tab={tab} params={params} setParams={setParams} />;
}
