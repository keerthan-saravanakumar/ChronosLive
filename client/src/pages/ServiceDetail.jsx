import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { servicesApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useSlotLive } from '../hooks/useSlotLive';
import { dateLabel, localDate, dayStart, dayEnd, timezone } from '../utils/format';
import SlotCard from '../components/SlotCard';
import { Avatar, Badge, EmptyState, ErrorState, Icon, Pagination, Skeletons } from '../components/ui';
export default function ServiceDetail() {
  const { id } = useParams();
  const [filters, setFilters] = useState({ from: localDate(), to: '', timeFrom: '', timeTo: '', availableOnly: false, page: 1 });
  const detail = useResource(signal => servicesApi.get(id, signal), [id]);
  const invalid = (filters.to && filters.to < filters.from) || (filters.timeFrom && filters.timeTo && filters.timeFrom >= filters.timeTo);
  const query = { from: dayStart(filters.from || localDate()), to: filters.to ? dayEnd(filters.to) : undefined, timeFrom: filters.timeFrom || undefined, timeTo: filters.timeTo || undefined, availableOnly: filters.availableOnly, page: filters.page, limit: 12 };
  const sessions = useResource(signal => invalid ? Promise.resolve({ data: [], meta: { total: 0 } }) : servicesApi.slots(id, query, signal), [id, JSON.stringify(filters)]);
  useSlotLive(id);
  function change(key, value) { setFilters(v => ({ ...v, [key]: value, page: key === 'page' ? value : 1 })); }
  if (detail.error) return <ErrorState error={detail.error} retry={detail.refresh}/>;
  if (!detail.data) return <Skeletons/>;
  const service = detail.data.data;
  const groups = Object.groupBy(sessions.data?.data || [], slot => dateLabel(slot.startTime));
  return <><Link className="text-link back-link" to="/browse"><Icon name="back" size={16}/>All services</Link><section className="service-heading"><div><Badge>{service.category}</Badge>{!service.isActive && <Badge tone="gray">Archived · existing bookings continue</Badge>}<h1>{service.title}</h1><p>{service.description}</p><div className="service-meta"><Link className="organizer-link" to={'/browse?organizer=' + service.organizer._id}><Avatar user={service.organizer} size="small"/>{service.organizer.name}</Link><span><Icon name="location" size={17}/>{service.location}</span></div></div><div className="service-heading-symbol" aria-hidden="true"><Icon name="calendar" size={56}/></div></section><div className="policy-strip"><span><Icon name="check" size={16}/>Up to {service.policy.maxActiveBookingsPerUser} upcoming bookings</span><span><Icon name="clock" size={16}/>Cancel up to {service.policy.cancellationCutoffMinutes} min before</span><span><Icon name="users" size={16}/>First in line, next eligible seat</span></div><div className="section-heading compact"><div><h2>A time that works for you.</h2><p>Session times shown in {timezone}.</p></div></div><div className="slot-filters"><label>From<input aria-label="From date" type="date" value={filters.from} onChange={e => change('from', e.target.value)}/></label><label>Through<input aria-label="Through date" type="date" min={filters.from} value={filters.to} onChange={e => change('to', e.target.value)}/></label><label>After (IST)<input aria-label="Time from IST" type="time" value={filters.timeFrom} onChange={e => change('timeFrom', e.target.value)}/></label><label>Before (IST)<input aria-label="Time to IST" type="time" value={filters.timeTo} onChange={e => change('timeTo', e.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={filters.availableOnly} onChange={e => change('availableOnly', e.target.checked)}/>Available seats only</label></div>{invalid && <p className="inline-error" role="alert">Choose an end date/time after the start.</p>}{sessions.error ? <ErrorState error={sessions.error} retry={sessions.refresh}/> : sessions.loading ? <Skeletons/> : Object.keys(groups).length ? Object.entries(groups).map(([date, slots]) => <section key={date} className="slot-day"><h3 className="date-divider"><Icon name="calendar" size={16}/>{date}<span>{slots.length} sessions</span></h3><div className="cards-grid">{slots.map(slot => <SlotCard key={slot._id} slot={slot} service={service}/>)}</div></section>) : <EmptyState title="A little quiet in this date range" description="Try a different day or turn off the available-seats filter to see waitlists."/>}<Pagination meta={sessions.data?.meta} onPage={page => change('page', page)}/></>;
}
