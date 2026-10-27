import { useState } from 'react';

const illustrations = {
  'Office hours': '/images/study.jpg',
  Labs: '/images/study.jpg',
  Consultations: '/images/consultation.jpg',
  Workshops: '/images/workshop.jpg',
};

export default function ServiceCover({ service, className = '', priority = false }) {
  const [failed, setFailed] = useState(null);
  const cover = service?.coverImageUrl;
  const fallback = illustrations[service?.category] || '/images/study.jpg';
  return <img className={'service-image ' + className} src={cover && failed !== cover ? cover : fallback} alt="" width="640" height="560" loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => { if (cover) setFailed(cover); }} />;
}
