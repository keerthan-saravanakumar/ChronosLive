import { http, payload } from './http';
export const bookingsApi = {
  list: (status, signal) => payload(http.get('/bookings/me', { params: { status }, signal })),
  waitlist: signal => payload(http.get('/waitlist/me', { signal })),
  book: id => payload(http.post('/slots/' + id + '/book', {})),
  cancel: id => payload(http.delete('/bookings/' + id)),
  join: id => payload(http.post('/slots/' + id + '/waitlist', {})),
  leave: id => payload(http.delete('/slots/' + id + '/waitlist')),
};
