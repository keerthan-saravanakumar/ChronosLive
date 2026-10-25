import { http, payload } from './http';
export const servicesApi = {
  list: (params, signal) => payload(http.get('/services', { params, signal })),
  get: (id, signal) => payload(http.get('/services/' + id, { signal })),
  slots: (id, params, signal) => payload(http.get('/services/' + id + '/slots', { params, signal })),
  create: data => payload(http.post('/services', data)),
  update: (id, data) => payload(http.patch('/services/' + id, data)),
  archive: id => payload(http.delete('/services/' + id)),
  createSlot: (id, data) => payload(http.post('/services/' + id + '/slots', data)),
  createBulk: (id, data) => payload(http.post('/services/' + id + '/slots/bulk', data)),
  roster: (id, signal) => payload(http.get('/slots/' + id + '/roster', { signal })),
  capacity: (id, capacity) => payload(http.patch('/slots/' + id, { capacity })),
  cancelSlot: (id, reason) => payload(http.post('/slots/' + id + '/cancel', { reason })),
  cover: (id, file) => { const form = new FormData(); form.append('cover', file); return payload(http.post('/services/' + id + '/cover', form)); },
};
