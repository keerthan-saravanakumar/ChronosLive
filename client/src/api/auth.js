import { http, payload } from './http';
export const authApi = {
  login: data => payload(http.post('/auth/login', data)),
  register: data => payload(http.post('/auth/register', data)),
  me: () => payload(http.get('/auth/me')),
  logout: () => payload(http.post('/auth/logout', {})),
};
