import { useState } from 'react';
import toast from 'react-hot-toast';
import { servicesApi } from '../api/services';
import { previewSlots } from '../utils/slotPreview';
import { errorMessage, refreshData } from '../utils/format';
import { Button, Field, Icon } from './ui';
const istFormat = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
const istDate = days => new Date(Date.now() + 330 * 60000 + days * 86400000).toISOString().slice(0, 10);
export default function SlotCreation({ service }) {
  const [bulk, setBulk] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const [form, setForm] = useState({ fromDate: istDate(1), toDate: istDate(14), startTime: '15:00', endTime: '16:00', slotMinutes: 20, capacity: 3, daysOfWeek: [1, 3] });
  const preview = previewSlots(form, bulk);
  const change = (key, value) => { setForm(v => ({ ...v, [key]: value })); setError(null); };
  async function create(event) {
    event.preventDefault();
    if (preview.error) return;
    setBusy(true); setError(null);
    try {
      if (bulk) await servicesApi.createBulk(service._id, { ...form, slotMinutes: Number(form.slotMinutes), capacity: Number(form.capacity) });
      else await servicesApi.createSlot(service._id, preview.slots[0]);
      toast.success(preview.slots.length + (preview.slots.length === 1 ? ' session created.' : ' sessions created.'));
      refreshData();
    } catch (error) { setError(error); toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <section className="form-panel"><div className="panel-heading"><div><h2>Make some room.</h2><p>Add one session or a regular rhythm. All entry times are IST.</p></div><Icon name="calendar" size={25}/></div><div className="segmented"><button type="button" className={!bulk ? 'active' : ''} onClick={() => setBulk(false)}>Single session</button><button type="button" className={bulk ? 'active' : ''} onClick={() => setBulk(true)}>Recurring sessions</button></div><form onSubmit={create}><fieldset disabled={!service.isActive || busy} className="unstyled-fieldset"><div className="form-grid"><Field label={bulk ? 'From date (inclusive)' : 'Session date'} type="date" value={form.fromDate} onChange={e => change('fromDate', e.target.value)} required/>{bulk && <Field label="Through date (inclusive)" type="date" min={form.fromDate} value={form.toDate} onChange={e => change('toDate', e.target.value)} required/>}<Field label="Start time (IST)" type="time" value={form.startTime} onChange={e => change('startTime', e.target.value)} required/><Field label="End time (IST)" type="time" value={form.endTime} onChange={e => change('endTime', e.target.value)} required/>{bulk && <Field label="Minutes per slot" type="number" min={5} max={240} step={1} value={form.slotMinutes} onChange={e => change('slotMinutes', e.target.value)} required/>}<Field label="Seats per slot" type="number" min={1} max={100} step={1} value={form.capacity} onChange={e => change('capacity', e.target.value)} required/></div>{bulk && <fieldset className="weekday-picker"><legend>Repeat on</legend>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <label key={day}><input type="checkbox" checked={form.daysOfWeek.includes(index)} onChange={e => change('daysOfWeek', e.target.checked ? [...form.daysOfWeek, index].sort() : form.daysOfWeek.filter(d => d !== index))}/>{day}</label>)}</fieldset>}</fieldset><div className="slot-preview"><strong>{preview.error ? 'Adjust your dates and times' : preview.slots.length + ' sessions ready to create'}</strong><p>{preview.error || 'Preview in Asia/Kolkata. No slots are added if any requested time overlaps.'}</p>{!preview.error && <ul>{preview.slots.slice(0, 5).map(slot => <li key={slot.startTime}><Icon name="clock" size={13}/>{istFormat.format(new Date(slot.startTime))} · {slot.capacity} seats</li>)}{preview.slots.length > 5 && <li>And {preview.slots.length - 5} more sessions.</li>}</ul>}</div>{error && <div className="inline-error" role="alert">{errorMessage(error)}{error.response?.data?.error?.details?.conflicts && <ul>{error.response.data.error.details.conflicts.slice(0, 8).map((conflict, index) => <li key={index}>Requested slot {conflict.index + 1}: conflicts with {conflict.otherIndex === undefined ? 'an existing slot' : 'requested slot ' + (conflict.otherIndex + 1)} at {istFormat.format(new Date(conflict.startTime))}.</li>)}</ul>}</div>}{!service.isActive && <p className="inline-error">Reactivate this service to publish new sessions.</p>}<Button type="submit" loading={busy} disabled={Boolean(preview.error) || !service.isActive} className="form-submit">Create {bulk ? preview.slots.length + ' sessions' : 'session'}<Icon name="plus" size={17}/></Button></form></section>;
}
