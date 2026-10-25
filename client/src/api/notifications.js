import { http, payload } from './http';
export const notificationsApi = {
  list: (params = {}, signal) => payload(http.get('/notifications', { params, signal })),
  read: id => payload(http.patch('/notifications/' + id + '/read', {})),
  readAll: () => payload(http.patch('/notifications/read-all', {})),
};
