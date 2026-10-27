import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { servicesApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import ServiceCover from '../components/ServiceCover';
import { Badge, EmptyState, ErrorState, Icon, Pagination, Skeletons } from '../components/ui';

export default function OrganizerServices() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const resource = useResource(signal => servicesApi.list({ organizer: user._id, includeInactive: true, limit: 12, page, search: query || undefined }, signal), [user._id, query, page]);
  return (
    <div>
      <div className="page-heading"><div><h1>My Services</h1><p>Publish your schedule and manage the services you offer.</p></div><Link to="/organizer/services/new" className="btn btn-primary"><Icon name="plus" size={16} />Create service</Link></div>
      <form className="search-panel organizer-search" role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(1); }}><Icon name="search" size={19} /><input aria-label="Search your services" placeholder="Search your services…" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} /><button className="icon-button" type="submit" aria-label="Search"><Icon name="arrow" size={18} /></button></form>
      {resource.error ? <ErrorState error={resource.error} retry={resource.refresh} /> : !resource.data ? <Skeletons count={4} /> : !resource.data.data.length ? <EmptyState title={query ? 'No matching services' : 'Create your first service'} description={query ? 'Try another search term.' : 'Add the details, then publish the session times people can book.'} to="/organizer/services/new" action="Create service" /> : (
        <div className="services-grid managed-services-grid" aria-busy={resource.loading}>{resource.data.data.map(service => <article className="managed-service" key={service._id}><Link to={'/organizer/services/' + service._id} className="managed-service-cover" aria-label={'Manage ' + service.title}><ServiceCover service={service} /></Link><div className="managed-service-body"><div className="managed-service-status"><span>{service.category}</span><Badge tone={service.isActive ? 'green' : 'gray'}>{service.isActive ? 'Published' : 'Archived'}</Badge></div><h2>{service.title}</h2><p className="clamp-two">{service.description}</p><Link className="btn btn-secondary full-width" to={'/organizer/services/' + service._id}>Manage service<Icon name="arrow" size={16} /></Link></div></article>)}</div>
      )}
      <Pagination meta={resource.data?.meta} onPage={setPage} />
    </div>
  );
}
