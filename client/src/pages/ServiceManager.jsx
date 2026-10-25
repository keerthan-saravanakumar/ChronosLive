import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { servicesApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { useSlotLive } from '../hooks/useSlotLive';
import SlotCreation from '../components/SlotCreation';
import { dateLabel, timeLabel, errorMessage, refreshData } from '../utils/format';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Icon, Pagination, Skeletons } from '../components/ui';

function ServiceEditor({ service }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: service?.title || '', description: service?.description || '', category: service?.category || 'Office hours', location: service?.location || '', maxActiveBookingsPerUser: service?.policy.maxActiveBookingsPerUser || 2, cancellationCutoffMinutes: service?.policy.cancellationCutoffMinutes ?? 30 });
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [archive, setArchive] = useState(false), [file, setFile] = useState(null), [uploading, setUploading] = useState(false);
  const change = (key, value) => setForm(v => ({ ...v, [key]: value }));
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(null);
    const data = { title: form.title.trim(), description: form.description.trim(), category: form.category.trim(), location: form.location.trim(), policy: { maxActiveBookingsPerUser: Number(form.maxActiveBookingsPerUser), cancellationCutoffMinutes: Number(form.cancellationCutoffMinutes) } };
    try {
      const result = service ? await servicesApi.update(service._id, data) : await servicesApi.create(data);
      toast.success(service ? 'Service updated.' : 'Your service is ready. Add a few sessions.');
      if (!service) navigate('/organizer/services/' + result.data._id, { replace: true });
      refreshData();
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  }
  async function toggleActive() {
    setBusy(true);
    try { await (service.isActive ? servicesApi.archive(service._id) : servicesApi.update(service._id, { isActive: true })); toast.success(service.isActive ? 'Service archived. Existing plans are preserved.' : 'Service reactivated.'); setArchive(false); refreshData(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function upload(event) {
    event.preventDefault();
    if (!file || file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Choose a JPEG, PNG or WebP image up to 2 MB.'); return; }
    setUploading(true);
    try { await servicesApi.cover(service._id, file); setFile(null); toast.success('Cover image updated.'); refreshData(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setUploading(false); }
  }
  return <><section className="form-panel"><div className="panel-heading"><div><h2>The essentials.</h2><p>Tell people what they can make time for.</p></div>{service && <Badge tone={service.isActive ? 'green' : 'gray'}>{service.isActive ? 'Published' : 'Archived'}</Badge>}</div><form onSubmit={save} className="stack-form"><Field label="Service title" value={form.title} onChange={e => change('title', e.target.value)} required minLength={3} maxLength={120}/><Field label="Description"><textarea value={form.description} onChange={e => change('description', e.target.value)} required minLength={10} maxLength={3000}/></Field><div className="form-grid"><Field label="Category"><select value={form.category} onChange={e => change('category', e.target.value)}>{['Office hours', 'Labs', 'Consultations', 'Workshops', ...(!['Office hours', 'Labs', 'Consultations', 'Workshops'].includes(form.category) ? [form.category] : [])].map(value => <option key={value}>{value}</option>)}</select></Field><Field label="Location or meeting link" value={form.location} onChange={e => change('location', e.target.value)} required minLength={2} maxLength={300}/><Field label="Upcoming bookings per person" type="number" min={1} max={100} step={1} value={form.maxActiveBookingsPerUser} onChange={e => change('maxActiveBookingsPerUser', e.target.value)} required/><Field label="Cancellation cutoff (minutes)" type="number" min={0} max={10080} step={1} value={form.cancellationCutoffMinutes} onChange={e => change('cancellationCutoffMinutes', e.target.value)} required/></div>{error && <p className="inline-error" role="alert">{errorMessage(error)}</p>}<div className="form-actions"><Button type="submit" loading={busy}>{service ? 'Save service' : 'Create service'}<Icon name="check" size={16}/></Button>{service && <Button type="button" variant="secondary" onClick={() => setArchive(true)} disabled={busy}>{service.isActive ? 'Archive service' : 'Reactivate service'}</Button>}</div></form></section>{service && <section className="form-panel cover-panel"><div><h3>A face for your service.</h3><p>Optional cover image · JPEG, PNG or WebP, up to 2 MB.</p>{service.coverImageUrl && <img className="cover-preview" src={service.coverImageUrl} alt="Current service cover"/>}</div><form onSubmit={upload}><Field label="Service cover image" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)}/><Button type="submit" variant="secondary" disabled={!file} loading={uploading}>Upload cover</Button></form></section>}<ConfirmDialog open={archive} title={service?.isActive ? 'Archive this service?' : 'Bring this service back?'} onClose={() => setArchive(false)} onConfirm={toggleActive} busy={busy} confirmLabel={service?.isActive ? 'Archive service' : 'Reactivate service'} danger={service?.isActive}><p>{service?.isActive ? 'New bookings and waitlist joins will stop. Existing bookings and waiting lists continue, including promotions. Cancel individual sessions if you need to end those plans.' : 'People will be able to discover the service and reserve new seats again.'}</p></ConfirmDialog></>;
}
function Sessions({ id }) {
  const [page, setPage] = useState(1);
  const resource = useResource(signal => servicesApi.slots(id, { page, limit: 12 }, signal), [id, page]);
  return <><div className="section-heading compact"><div><h2>Your sessions</h2><p>Open a roster to manage people and availability.</p></div></div>{resource.error ? <ErrorState error={resource.error} retry={resource.refresh}/> : !resource.data ? <Skeletons/> : !resource.data.data.length ? <EmptyState title="Make the first opening" description="Add a single session or a recurring schedule above."/> : <div className="table-wrap"><table><thead><tr><th>When</th><th>Seats booked</th><th>Waitlist</th><th>Status</th><th>Manage</th></tr></thead><tbody>{resource.data.data.map(slot => <tr key={slot._id}><td><strong>{dateLabel(slot.startTime)}</strong><small>{timeLabel(slot.startTime)} – {timeLabel(slot.endTime)}</small></td><td>{slot.bookedCount}/{slot.capacity}</td><td>{slot.waitlistCount} waiting</td><td><Badge tone={slot.status === 'open' ? 'green' : 'gray'}>{slot.status}</Badge></td><td><Link className="text-link" to={'/organizer/slots/' + slot._id}>View roster<Icon name="arrow" size={15}/></Link></td></tr>)}</tbody></table></div>}<Pagination meta={resource.data?.meta} onPage={setPage}/></>;
}
export default function ServiceManager() {
  const { id } = useParams(), { user } = useAuth();
  const isNew = !id || id === 'new';
  const resource = useResource(signal => isNew ? Promise.resolve({ data: null }) : servicesApi.get(id, signal), [id]);
  useSlotLive(isNew ? null : id);
  if (resource.error) return <ErrorState error={resource.error} retry={resource.refresh}/>;
  if (!isNew && !resource.data?.data) return <Skeletons/>;
  const service = isNew ? null : resource.data.data;
  if (service && service.organizer._id !== user._id) return <EmptyState title="This belongs to another organizer" description="You can manage your own services from the dashboard." to="/organizer" action="Your dashboard"/>;
  return <><Link className="text-link back-link" to="/organizer"><Icon name="back" size={16}/>Organizer dashboard</Link><div className="page-heading"><div><span className="eyebrow">{isNew ? 'SOMETHING WORTH MAKING TIME FOR' : 'YOUR SERVICE, THOUGHTFULLY PLANNED'}</span><h1>{isNew ? 'Create a little possibility.' : service.title}</h1><p>{isNew ? 'Start with a service. Then give it a time and a place.' : 'Edit the details, publish sessions, and keep things running smoothly.'}</p></div>{service && <Link className="btn btn-secondary" to={'/services/' + id}>View public page<Icon name="arrow" size={16}/></Link>}</div><ServiceEditor key={id || 'new'} service={service}/>{service && <><SlotCreation service={service}/><Sessions id={id}/></>}</>;
}
