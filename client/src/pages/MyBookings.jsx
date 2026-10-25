import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi } from '../api/bookings';
import { useResource } from '../hooks/useResource';
import { dateLabel, idOf } from '../utils/format';
import SlotCard from '../components/SlotCard';
import { Badge, EmptyState, ErrorState, Icon, Skeletons } from '../components/ui';
export default function MyBookings() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('tab') || 'upcoming';
  const tab = ['upcoming', 'waitlisted', 'past', 'cancelled'].includes(selected) ? selected : 'upcoming';
  const resource = useResource(signal => tab === 'waitlisted' ? bookingsApi.waitlist(signal) : bookingsApi.list(tab, signal), [tab]);
  const items = resource.data?.data || [];
  return <><div className="page-heading"><div><span className="eyebrow">ALL YOUR GOOD PLANS, TOGETHER</span><h1>Your time, at a glance.</h1><p>Keep track of the sessions you’re looking forward to.</p></div><Link className="btn btn-primary" to="/browse">Find another session<Icon name="plus" size={17}/></Link></div><nav className="tabs" aria-label="Booking views">{[['upcoming', 'Upcoming'], ['waitlisted', 'Waitlisted'], ['past', 'Past / started'], ['cancelled', 'Cancelled']].map(([value, label]) => <button key={value} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => setParams({ tab: value })}>{label}</button>)}</nav>{resource.error ? <ErrorState error={resource.error} retry={resource.refresh}/> : resource.loading ? <Skeletons/> : !items.length ? <EmptyState title={tab === 'upcoming' ? 'Your next good thing is waiting' : tab === 'waitlisted' ? 'No waiting around right now' : 'Nothing to show here yet'} description={tab === 'upcoming' ? 'Find a session that sparks your interest and save yourself a seat.' : 'Your sessions will appear here as your plans take shape.'} to="/browse"/> : <div className="booking-grid">{items.map(item => {
    const slot = item.slot, service = item.service || slot.service;
    return <div key={item._id}><div className="booking-date"><Icon name="calendar" size={15}/>{dateLabel(slot.startTime)}{tab === 'cancelled' && <Badge tone="gray">{item.status === 'cancelled_by_organizer' ? 'Cancelled by organizer' : 'Cancelled'}</Badge>}</div>{tab === 'cancelled' ? <article className="cancelled-card"><h3><Link to={'/services/' + idOf(service)}>{service.title}</Link></h3><p>{item.cancelReason || 'This booking was cancelled.'}</p><Link className="text-link" to={'/services/' + idOf(service)}>Find another time<Icon name="arrow" size={16}/></Link></article> : <SlotCard slot={{ ...slot, myBooking: tab === 'waitlisted' ? null : item, myWaitlist: tab === 'waitlisted' ? item : null }} service={service} showService/>}</div>;
  })}</div>}</>;
}
