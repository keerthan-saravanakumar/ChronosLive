import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { servicesApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useSlotLive } from '../hooks/useSlotLive';
import { dateLabel, timeLabel, localDate, dayStart, dayEnd, timezone } from '../utils/format';
import { chooseSlot, groupSlotsByDay, isUpcomingSlot } from '../utils/schedule';
import BookingAction from '../components/BookingAction';
import ServiceCover from '../components/ServiceCover';
import { Badge, EmptyState, ErrorState, Icon, Pagination, Skeletons } from '../components/ui';

export default function ServiceDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = {
    from: params.get('from') || localDate(), to: params.get('to') || '',
    timeFrom: params.get('after') || '', timeTo: params.get('before') || '',
    availableOnly: params.get('available') === '1', page: Number(params.get('page')) || 1,
  };
  const detail = useResource(signal => servicesApi.get(id, signal), [id]);
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + 'T00:00:00').getTime());
  const invalid = !validDate(filters.from) || (filters.to && (!validDate(filters.to) || filters.to < filters.from)) || (filters.timeFrom && filters.timeTo && filters.timeFrom >= filters.timeTo);
  const query = {
    from: !invalid ? dayStart(filters.from) : undefined,
    to: !invalid && filters.to ? dayEnd(filters.to) : undefined,
    timeFrom: filters.timeFrom || undefined, timeTo: filters.timeTo || undefined,
    availableOnly: filters.availableOnly, page: filters.page, limit: 12,
  };
  const sessions = useResource(signal => invalid ? Promise.resolve({ data: [], meta: { total: 0 } }) : servicesApi.slots(id, query, signal), [id, JSON.stringify(filters)]);
  useSlotLive(id);
  useEffect(() => { if (detail.data?.data?.title) document.title = detail.data.data.title + ' · ChronosLive'; }, [detail.data?.data?.title]);

  function change(key, value) {
    const next = new URLSearchParams(params);
    value ? next.set(key, String(value)) : next.delete(key);
    if (key !== 'page') next.delete('page');
    next.delete('slot');
    next.delete('day');
    setParams(next, { replace: true });
  }
  function selectDay(day) {
    const next = new URLSearchParams(params);
    next.set('day', day);
    next.delete('slot');
    setParams(next, { replace: true });
  }
  function selectSlot(slot) {
    const next = new URLSearchParams(params);
    next.set('slot', slot._id);
    next.set('day', localDate(slot.startTime));
    setParams(next, { replace: true });
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('Session link copied.'); }
    catch { toast.error('Could not copy the link. You can copy it from your address bar.'); }
  }

  if (detail.error) return <ErrorState error={detail.error} retry={detail.refresh} />;
  if (!detail.data) return <Skeletons count={2} />;
  const service = detail.data.data;
  const slots = sessions.data?.data || [];
  const groups = groupSlotsByDay(slots);
  const days = Object.keys(groups);
  const preferredSlot = slots.find(slot => slot._id === params.get('slot'));
  const activeDay = groups[params.get('day')] ? params.get('day') : preferredSlot ? localDate(preferredSlot.startTime) : days.find(day => groups[day].some(slot => isUpcomingSlot(slot))) || days[0];
  const daySlots = groups[activeDay] || [];
  const selected = chooseSlot(daySlots, params.get('slot'));
  const seats = selected ? Math.max(0, selected.capacity - selected.bookedCount) : 0;

  return (
    <div className="service-detail-page">
      <div className="detail-toolbar"><Link className="text-link back-link" to="/browse"><Icon name="back" size={16} />Back to explore</Link><button className="text-link" onClick={copyLink}><Icon name="share" size={17} />Share</button></div>
      <div className="service-detail-grid">
        <div className="service-story">
          <div className="detail-cover"><ServiceCover service={service} priority /></div>
          <div className="detail-cover-caption"><span>{service.category}</span><span><Icon name="location" size={14} />{service.location}</span></div>
          <section className="about-session"><h2>About this session</h2><p>{service.description}</p></section>
          <section className="booking-guidelines"><h2>Before you book</h2><ul><li><Icon name="check" size={17} /><span>You can hold up to <strong>{service.policy.maxActiveBookingsPerUser} upcoming bookings</strong> for this service.</span></li><li><Icon name="clock" size={17} /><span>Cancel at least <strong>{service.policy.cancellationCutoffMinutes} minutes</strong> before the session begins.</span></li><li><Icon name="waitlist" size={17} /><span>If a session is full, join its waitlist. The next free seat goes to the first eligible person in line.</span></li></ul></section>
        </div>
        <section className="session-booking-panel" aria-label="Session details and booking">
          <div className="session-intro">
            <h1>{service.title}</h1>
            <Link className="organizer-byline" to={'/browse?organizer=' + service.organizer._id}>By {service.organizer.name}</Link>
            <div className="session-tags"><span>{service.category}</span>{!service.isActive && <Badge tone="gray">Archived</Badge>}</div>
            <ul className="session-facts">
              <li><Icon name="calendar" size={17} /><span>{selected ? dateLabel(selected.startTime) : 'Choose an available date below'}</span></li>
              <li><Icon name="clock" size={17} /><span>{selected ? timeLabel(selected.startTime) + ' – ' + timeLabel(selected.endTime) : 'Session times vary'}</span></li>
              <li><Icon name="location" size={17} /><span>{service.location}</span></li>
              {selected && <li><Icon name="users" size={17} /><span>{selected.capacity} {selected.capacity === 1 ? 'seat' : 'seats'} in this session</span></li>}
            </ul>
          </div>
          <div className="slot-selection">
            <div className="slot-selection-heading"><h2>Select a slot</h2><button className="icon-button" aria-label="Filter session dates and times" aria-controls="slot-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><Icon name="sliders" size={18} /></button></div>
            {filtersOpen && <div className="slot-filters" id="slot-filters">
              <label>From<input aria-label="From date" type="date" value={filters.from} onChange={event => change('from', event.target.value)} /></label>
              <label>Through<input aria-label="Through date" type="date" min={filters.from} value={filters.to} onChange={event => change('to', event.target.value)} /></label>
              <label>After (IST)<input aria-label="Time from IST" type="time" value={filters.timeFrom} onChange={event => change('after', event.target.value)} /></label>
              <label>Before (IST)<input aria-label="Time to IST" type="time" value={filters.timeTo} onChange={event => change('before', event.target.value)} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={filters.availableOnly} onChange={event => change('available', event.target.checked ? '1' : '')} />Available seats only</label>
            </div>}
            {invalid && <p className="inline-error" role="alert">Choose valid dates and an end date/time after the start.</p>}
            {sessions.error ? <ErrorState error={sessions.error} retry={sessions.refresh} /> : sessions.loading && !sessions.data ? <div className="slot-loading" role="status">Loading available sessions…</div> : !days.length ? <EmptyState title="No sessions in this range" description="Choose another date range or include full sessions to see their waitlists." /> : (
              <div aria-busy={sessions.loading}>
                <div className="day-selector" role="group" aria-label="Session dates">{days.map(day => <button key={day} className={activeDay === day ? 'selected' : ''} aria-pressed={activeDay === day} onClick={() => selectDay(day)}><span>{format(new Date(day + 'T12:00:00'), 'EEE')}</span><strong>{format(new Date(day + 'T12:00:00'), 'd MMM')}</strong></button>)}</div>
                <div className="slot-options" role="group" aria-label="Session times">{daySlots.map(slot => {
                  const available = Math.max(0, slot.capacity - slot.bookedCount);
                  const open = isUpcomingSlot(slot);
                  const label = !open ? slot.status === 'cancelled' ? 'Cancelled' : 'Closed' : slot.myBooking ? 'Your booking is confirmed' : slot.myWaitlist ? 'Waitlisted · #' + slot.myWaitlist.position + ' in line' : available ? available + '/' + slot.capacity + ' seats left' : 'Full · join the waitlist';
                  return <button key={slot._id} className={'slot-option ' + (selected?._id === slot._id ? 'selected ' : '') + (!open ? 'closed' : '')} aria-pressed={selected?._id === slot._id} onClick={() => selectSlot(slot)}><span><strong>{timeLabel(slot.startTime)} – {timeLabel(slot.endTime)}</strong><small>{label}</small></span>{selected?._id === slot._id && <Icon name="check" size={18} />}</button>;
                })}</div>
                <Pagination meta={sessions.data?.meta} onPage={page => change('page', page)} />
              </div>
            )}
            {selected && !invalid && !sessions.error && <div className="selected-booking"><BookingAction key={selected._id} slot={selected} service={service} />{isUpcomingSlot(selected) && <p className="selection-note">{selected.myBooking ? 'Your seat is reserved.' : selected.myWaitlist ? 'We’ll notify you if you’re promoted.' : seats ? 'Availability updates in real time.' : 'Seats are offered in waitlist order.'}</p>}</div>}
            <p className="timezone-note">Times shown in {timezone}.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
