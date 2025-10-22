// src/api.js
import axios from 'axios';

const RAW = (import.meta.env.VITE_API_BASE || '/api').trim();
const BASE = RAW.replace(/\/+$/, ''); // enlève le trailing slash

export const api = axios.create({
  baseURL: BASE,
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
