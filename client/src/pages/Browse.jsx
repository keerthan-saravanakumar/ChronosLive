import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { servicesApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import ServiceCard from '../components/ServiceCard';
import { Button, EmptyState, ErrorState, Field, Icon, Pagination, Skeletons } from '../components/ui';

const categories = ['', 'Office hours', 'Labs', 'Consultations', 'Workshops'];

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = {
    search: params.get('search') || undefined,
    category: params.get('category') || undefined,
    organizer: params.get('organizer') || undefined,
    page: Number(params.get('page')) || 1,
    limit: 12,
  };
  const resource = useResource(signal => servicesApi.list(query, signal), [params.toString()]);
  const organizers = [...new Map((resource.data?.data || []).filter(service => service.organizer?._id).map(service => [service.organizer._id, service.organizer])).values()];
  useEffect(() => { setSearch(params.get('search') || ''); }, [params]);
  function change(key, value) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }
  const reset = () => { setSearch(''); setParams({}); };
  const filtered = Boolean(query.category || query.search || query.organizer);

  return (
    <div className="explore-page">
      <header className="explore-heading">
        <div><h1>Explore<br />Sessions</h1><p>Book workshops, office hours and experiences.<br className="desktop-break" /> Find a time that works for you.</p></div>
        <nav className="category-tabs" aria-label="Session categories">
          {categories.map(category => <button key={category} className={(query.category || '') === category ? 'active' : ''} aria-pressed={(query.category || '') === category} onClick={() => change('category', category)}>{category || 'All'}</button>)}
        </nav>
      </header>
      <div className="explore-search">
        <form className="search-panel" role="search" onSubmit={event => { event.preventDefault(); change('search', search.trim()); }}>
          <Icon name="search" size={20} />
          <input aria-label="Search sessions" placeholder="Search sessions, organizers, or categories…" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} />
          <button type="submit" className="icon-button search-submit" aria-label="Search"><Icon name="arrow" size={19} /></button>
        </form>
        <button className={'filter-toggle ' + (filtersOpen ? 'active' : '')} aria-label="Filter sessions" aria-expanded={filtersOpen} aria-controls="explore-filters" onClick={() => setFiltersOpen(value => !value)}><Icon name="sliders" size={21} />{filtered && <i />}</button>
      </div>
      {filtersOpen && <section id="explore-filters" className="explore-filters" aria-label="Session filters">
        <Field label="Category"><select value={query.category || ''} onChange={event => change('category', event.target.value)}>{categories.map(category => <option key={category} value={category}>{category || 'All categories'}</option>)}</select></Field>
        <Field label="Organizer"><select value={query.organizer || ''} onChange={event => change('organizer', event.target.value)}><option value="">All organizers</option>{query.organizer && !organizers.some(person => person._id === query.organizer) && <option value={query.organizer}>Selected organizer</option>}{organizers.map(person => <option value={person._id} key={person._id}>{person.name}</option>)}</select></Field>
        <Button variant="secondary" onClick={reset} disabled={!filtered}>Clear filters<Icon name="x" size={15} /></Button>
      </section>}
      <div className="results-line" aria-live="polite"><span>{resource.loading ? 'Updating sessions…' : resource.data ? resource.data.meta.total + (resource.data.meta.total === 1 ? ' service to explore' : ' services to explore') : 'Explore the schedule'}</span>{filtered && <button className="text-link" onClick={reset}>Clear filters<Icon name="x" size={13} /></button>}</div>
      {resource.error ? <ErrorState error={resource.error} retry={resource.refresh} /> : resource.loading && !resource.data ? <Skeletons count={4} /> : resource.data?.data.length ? (
        <div className="services-grid" aria-busy={resource.loading}>{resource.data.data.map((service, index) => <ServiceCard key={service._id} service={service} priority={index < 4} />)}</div>
      ) : <EmptyState title="No sessions found" description="Try a different search or category to find an available service." />}
      <Pagination meta={resource.data?.meta} onPage={page => change('page', String(page))} />
    </div>
  );
}
