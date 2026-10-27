import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { localDate } from '../utils/format';
import { monthCells } from '../utils/schedule';
import { Icon } from './ui';

export default function Calendar({ dates = [], selected, onSelect }) {
  const [month, setMonth] = useState(() => {
    const parsed = selected ? new Date(selected + 'T12:00:00') : new Date();
    const day = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return new Date(day.getFullYear(), day.getMonth(), 1);
  });
  useEffect(() => {
    if (selected) {
      const day = new Date(selected + 'T12:00:00');
      if (!Number.isNaN(day.getTime())) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    }
  }, [selected]);
  const counts = dates.reduce((result, date) => {
    result[date] = (result[date] || 0) + 1;
    return result;
  }, {});
  const today = localDate();
  const cells = monthCells(month.getFullYear(), month.getMonth());
  const move = offset => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <section className="calendar-panel" aria-label="Bookings calendar">
      <div className="calendar-heading">
        <h2 aria-live="polite">{format(month, 'MMMM yyyy')}</h2>
        <div><button className="icon-button" aria-label="Previous month" onClick={() => move(-1)}><Icon name="back" size={15} /></button><button className="icon-button" aria-label="Next month" onClick={() => move(1)}><Icon name="arrow" size={15} /></button></div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={i}>{day}</span>)}</div>
      <div className="calendar-grid">
        {cells.map((day, i) => {
          if (!day) return <span className="calendar-blank" key={'blank-' + i} />;
          const date = localDate(day);
          return <button key={date} className={'calendar-day ' + (selected === date ? 'selected ' : '') + (date === today ? 'today ' : '') + (counts[date] ? 'has-bookings' : '')} aria-label={format(day, 'EEEE, d MMMM yyyy') + (counts[date] ? ', ' + counts[date] + (counts[date] === 1 ? ' booking' : ' bookings') : '')} aria-pressed={selected === date} aria-current={date === today ? 'date' : undefined} onClick={() => onSelect(selected === date ? '' : date)}>{day.getDate()}{counts[date] && <i />}</button>;
        })}
      </div>
      <div className="calendar-caption"><span><i />Scheduled sessions</span>{selected && <button className="text-link" onClick={() => onSelect('')}>Show all dates</button>}</div>
    </section>
  );
}
