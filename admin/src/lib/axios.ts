import axios from 'axios';
import { config } from '../config';

// Create axios instance
const api = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true, // Needed to send refresh token cookie
});

// Request interceptor: Add access token from localStorage. Always sent: the
// admin writes to routes such as /blogs and /blogs/categories that are public
// only for reads, and public endpoints ignore the header.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Dedupe concurrent refresh attempts: when several requests 401 at once,
// only issue one /auth/refresh-token call and let the rest await it.
let refreshPromise: Promise<string> | null = null;

const redirectToLogin = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('admin-auth-store'); // ponytail: clear zustand persist to prevent infinite reload loop
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

// Response interceptor: Handle 401, try refresh, retry original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops; a 401 from login/logout is a wrong password or an
    // already-ended session, not an expired token, so the caller shows it as is.
    if (['/auth/refresh-token', '/auth/login', '/auth/logout'].includes(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = api
            .post('/auth/refresh-token')
            .then((res) => {
              const newAccessToken = res.data?.data?.accessToken;
              if (!newAccessToken) {
                throw new Error('Invalid token refresh response from server.');
              }
              localStorage.setItem('token', newAccessToken);
              return newAccessToken as string;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;

        // Update Authorization header and retry original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;