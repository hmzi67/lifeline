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

// Request interceptor: Add access token from localStorage
api.interceptors.request.use(
  (config) => {
    // Always send the token when we have one: public GETs ignore it, but
    // authenticated writes under a public prefix (e.g. POST /blogs/:id/comments) need it.
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
        if (!refreshPromise) {
          // Call your refresh endpoint mapping correctly to backend
          refreshPromise = api
            .post('/auth/refresh-token')
            .then((res) => {
              // Backend returns: { success: true, data: { accessToken: "..." } }
              const newAccessToken = res.data?.data?.accessToken;
              if (!newAccessToken) {
                throw new Error('Invalid token refresh response from server.');
              }
              // Save new access token using the uniform "token" key
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
        // Logout user and cleanly redirect them if refresh token expires or fails
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;