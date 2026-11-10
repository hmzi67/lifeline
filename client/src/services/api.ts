// Re-exports the app's single axios instance (lib/axios), which holds the in-memory
// access token and refreshes it on 401, so services importing from here share it.
import api from '../lib/axios';

// API Endpoints Configuration
export const ENDPOINTS = {
  // Auth endpoints
  AUTH_LOGIN: '/auth/login',
  AUTH_SIGNUP: '/auth/signup',
  AUTH_LOGOUT: '/auth/logout',
  
  // Progress endpoints
  PROGRESS_SUMMARY: '/progress/summary',
  PROGRESS_CALORIES_INTAKE: '/progress/calories-intake',
  PROGRESS_EXERCISE_ACTIVE_DAYS: '/progress/exercise-active-days',
  PROGRESS_MEDICATION_STATS: '/progress/medication-stats',
  PROGRESS_CHALLENGES: '/progress/challenges',
  
  // App Settings endpoints
  APP_SETTINGS_LIST: '/app-settings',
  APP_SETTINGS_CREATE: '/app-settings',
  APP_SETTINGS_GET: '/app-settings/:id',
  APP_SETTINGS_UPDATE: '/app-settings/:id',
  APP_SETTINGS_DELETE: '/app-settings/:id',
  APP_SETTINGS_BY_KEY: '/app-settings/key/:key',
  APP_SETTINGS_BY_SCOPE: '/app-settings/scope/:scope',
  APP_SETTINGS_BULK_UPSERT: '/app-settings/bulk-upsert',
  
  // Add other existing endpoints as needed
};

export { api };
