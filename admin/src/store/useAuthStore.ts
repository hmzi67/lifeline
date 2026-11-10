import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/authService';
import { setAccessToken } from '@/lib/axios';
import type { LoginCredentials, AuthUserData } from '@/services/authService';

type AuthStore = {
  user: AuthUserData | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ loading: true, error: null });
        try {
          const response = await authService.login(credentials);
          if (response.success) {
            const { user, accessToken } = response.data;

            // Enforce admin-only access to this panel
            const roleName = user.role?.name?.toLowerCase();
            if (roleName !== 'admin') {
              // Log out the server-side session so the cookie is cleared
              try { await authService.logout(); } catch { /* ignore */ }
              set({
                loading: false,
                error: 'Access denied. This panel is restricted to admin accounts only.',
              });
              return;
            }

            // Memory only; the persisted store below never sees the token.
            setAccessToken(accessToken);
            set({
              user,
              isAuthenticated: true,
              loading: false,
              error: null,
            });
          } else {
            set({ loading: false, error: response.message || 'Login failed' });
          }
        } catch (err: any) {
          const message =
            err.response?.data?.message || err.message || 'Login failed';
          set({ loading: false, error: message });
        }
      },

      logout: async () => {
        set({ loading: true });
        try {
          await authService.logout();
        } catch {
          // Clear local state even if API call fails
        } finally {
          setAccessToken(null);
          set({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'admin-auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
