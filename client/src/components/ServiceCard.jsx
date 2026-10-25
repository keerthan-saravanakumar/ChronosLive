import { Link } from 'react-router-dom';
import { Avatar, Badge, Icon } from './ui';
export default function ServiceCard({ service }) {
  const tone = service.category === 'Labs' ? 'sand' : service.category === 'Consultations' ? 'peach' : 'sage';
  return <Link to={'/services/' + service._id} className="service-card">
    <div className={'service-cover ' + tone}>{service.coverImageUrl ? <img src={service.coverImageUrl} alt=""/> : <><span className="cover-orbit one"/><span className="cover-orbit two"/><span className="cover-symbol"><Icon name={tone === 'sand' ? 'spark' : tone === 'peach' ? 'users' : 'calendar'} size={44}/></span></>}<span className="cover-tag">{service.category}</span></div>
    <div className="service-card-body"><div className="service-card-title"><h3>{service.title}</h3><Icon name="arrow" size={19}/></div><p className="clamp-two">{service.description}</p><div className="card-organizer"><Avatar user={service.organizer} size="small"/><span>{service.organizer?.name || 'Organizer'}</span></div><div className="card-bottom"><span><Icon name="location" size={15}/>{service.location}</span>{!service.isActive && <Badge tone="gray">Archived</Badge>}</div></div>
  </Link>;
}
