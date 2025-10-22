// src/api.js
import axios from 'axios';

function getApiBase() {
  // CRA remplace process.env.REACT_APP_API_BASE au build.
  // Si ce n'est pas le cas (ou variable absente), on fallback proprement.
  let val;
  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.env) {
      // eslint-disable-next-line no-undef
      val = process.env.REACT_APP_API_BASE;
    }
  } catch {
    // ignore
  }
  if (!val || typeof val !== 'string') val = '/api'; // défaut: /api
  return val.trim().replace(/\/+$/, ''); // sans trailing slash
}

export const api = axios.create({
  baseURL: getApiBase(),
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } catch {}
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
