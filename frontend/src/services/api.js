import axios from "axios";

/**
 * Dynamically resolves the Backend API URL:
 * 1. Checks custom backend URL saved in localStorage ('LIVE_BACKEND_URL')
 * 2. Checks VITE_BACKEND_URL environment variable
 * 3. Fallbacks to localhost:5000/api
 */
export const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("LIVE_BACKEND_URL");
    if (custom && custom.trim()) {
      const clean = custom.trim().replace(/\/+$/, "");
      return clean.endsWith("/api") ? clean : `${clean}/api`;
    }
  }

  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && envUrl.trim()) {
    const clean = envUrl.trim().replace(/\/+$/, "");
    return clean.endsWith("/api") ? clean : `${clean}/api`;
  }

  return "http://localhost:5000/api";
};

const api = axios.create({
  timeout: 60000 // 60s timeout to gracefully allow Render free tier cold-start wakeups
});

// Dynamic baseURL interceptor so backend URL updates without app reload
api.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  return config;
});

export default api;
