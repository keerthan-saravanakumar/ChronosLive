import axios from 'axios';
export const TOKEN_KEY = 'chronoslive:token';
export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api', timeout: 15000 });
http.interceptors.request.use(config => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});
http.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !/\/auth\/(login|register)$/.test(error.config?.url || '')) {
    window.dispatchEvent(new CustomEvent('chronos:session-ended'));
  }
  return Promise.reject(error);
});
export const payload = promise => promise.then(response => response.data);
