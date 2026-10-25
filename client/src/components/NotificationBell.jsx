import { Link } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import { useResource } from '../hooks/useResource';
import { Icon } from './ui';
export default function NotificationBell() {
  const { data } = useResource(signal => notificationsApi.list({ limit: 1 }, signal));
  const count = data?.meta.unread || 0;
  return <Link to="/notifications" className="icon-button notification-bell" aria-label={'Notifications' + (count ? ', ' + count + ' unread' : '')}><Icon name="bell" size={18}/>{count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}</Link>;
}
