// src/lib/http.js
import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      window.location.replace("/login");
    }
    return Promise.reject(err);
  }
);
