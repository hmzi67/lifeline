import axios from 'axios';
import { config } from '../config';

// Create axios instance
const api = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true, // Needed to send refresh token cookie
});

// Public routes that don't require authentication
// 401s from these endpoints are not an expired session, so they skip the refresh retry.
const PUBLIC_ROUTES = [
  // Login failures return 401 by design — never treat them as an expired
  // session, or a wrong password would trigger a refresh and a hard redirect.
  '/auth/login',
  // A rejected sign-in code is not an expired session either.
  '/auth/oauth/exchange',
];

// Helper function to check if route is public
const isPublicRoute = (url: string): boolean => {
  return PUBLIC_ROUTES.some(route => url?.includes(route));
};

// The access token is kept in memory only, out of reach of anything reading storage.
// After a reload it is restored from the HttpOnly refresh cookie (refreshAccessToken).
let accessToken: string | null = null;
// Earlier versions persisted the token; drop any copy left in the browser.
localStorage.removeItem('token');

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Request interceptor: attach the in-memory access token
api.interceptors.request.use(
  (config) => {
    // Always send the token when we have one: public GETs ignore it, but
    // authenticated writes under a public prefix (e.g. POST /blogs/:id/comments) need it.
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Dedupe concurrent refresh attempts: when several requests 401 at once,
// only issue one /auth/refresh-token call and let the rest await it.
let refreshPromise: Promise<string> | null = null;

/** Gets a new access token from the refresh cookie; rejects when there is no valid session. */
export const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh-token')
      .then((res) => {
        // Backend returns: { success: true, data: { accessToken: "..." } }
        const newAccessToken = res.data?.data?.accessToken;
        if (!newAccessToken) {
          throw new Error('Invalid token refresh response from server.');
        }
        accessToken = newAccessToken;
        return newAccessToken as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const redirectToLogin = () => {
  accessToken = null;
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

// Response interceptor: Handle 401, try refresh, retry original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't try to refresh token for public routes
    if (isPublicRoute(originalRequest.url || '')) {
      return Promise.reject(error);
    }

    // Prevent infinite loops from the refresh endpoint itself
    if (originalRequest.url === '/auth/refresh-token') {
      return Promise.reject(error);
    }

    // Automatically try to refresh token on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();

        // Update Authorization header and retry original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Logout user and cleanly redirect them if refresh token expires or fails
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;