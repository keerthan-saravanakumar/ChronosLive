import { http, payload } from './http';
export const usersApi = {
  stats: signal => payload(http.get('/organizer/stats', { signal })),
  list: (params, signal) => payload(http.get('/admin/users', { params, signal })),
  status: (id, isActive) => payload(http.patch('/admin/users/' + id + '/status', { isActive })),
  profile: (name, file) => {
    if (!file) return payload(http.patch('/users/me', { name }));
    const form = new FormData(); form.append('name', name); form.append('avatar', file);
    return payload(http.patch('/users/me', form));
  },
};
