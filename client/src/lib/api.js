import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : '/api',
  timeout: 30000,
});

// Attach the Clerk session token. `window.Clerk` is the global Clerk singleton
// populated once <ClerkProvider> mounts; getToken() returns the current session JWT
// (Clerk refreshes it automatically), which the API verifies with @clerk/express.
api.interceptors.request.use(async (config) => {
  try {
    const token = await window.Clerk?.session?.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // no active session — request proceeds unauthenticated
  }
  return config;
});

export default api;
