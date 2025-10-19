// src/api.js
import axios from 'axios';

const RAW = (process.env.REACT_APP_API_BASE || '/api').trim();
const BASE = RAW.replace(/\/+$/, '');

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
