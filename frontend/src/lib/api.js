  import axios from 'axios';

  // Prefer env; fallback to backend URL so you never hit /api 404s.
  const base = import.meta.env.VITE_API_URL || 'https://geniusgrid-auth-starter.onrender.com/api';

  export const api = axios.create({
    baseURL: base,
    withCredentials: true,
  });
