import api from '@/lib/axios';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUserData {
  id: string;
  email: string;
  username: string;
  roleId: string | null;
  role?: { id: string; name: string } | null;
  isEmailVerified: boolean;
  status: string;
  createdAt: string;
}

export interface LoginResponse {
  user: AuthUserData;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const response = await api.post<{
      success: boolean;
      message: string;
      data: LoginResponse;
    }>('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};
