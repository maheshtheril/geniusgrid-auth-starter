import axios from 'axios';
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', // proxy on the same origin
  withCredentials: true,
});
