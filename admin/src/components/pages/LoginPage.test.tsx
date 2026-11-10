// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { authService } = vi.hoisted(() => ({
  authService: { login: vi.fn(), logout: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@/services/authService', () => ({ authService }));

import LoginPage from './LoginPage';
import { useAuthStore } from '@/store/useAuthStore';
import { getAccessToken, setAccessToken } from '@/lib/axios';

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );

const signIn = () => {
  fireEvent.change(screen.getByPlaceholderText('admin@example.com'), { target: { value: 'admin@example.test' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'correct horse battery' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

const loginReply = (role: string) => ({
  success: true,
  data: { user: { id: 'u1', email: 'admin@example.test', role: { name: role } }, accessToken: `${role}-token`, refreshToken: 'r' },
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setAccessToken(null);
  useAuthStore.setState({ user: null, isAuthenticated: false, loading: false, error: null });
  localStorage.clear();
});

describe('admin login', () => {
  it('lets an admin in and keeps the token in memory, never in storage', async () => {
    authService.login.mockResolvedValue(loginReply('admin'));
    renderLogin();

    signIn();

    expect(await screen.findByText('dashboard')).toBeTruthy();
    expect(getAccessToken()).toBe('admin-token');
    expect(localStorage.getItem('admin-auth-store') ?? '').not.toContain('admin-token');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('turns away an account that is not an admin and ends its session', async () => {
    authService.login.mockResolvedValue(loginReply('user'));
    renderLogin();

    signIn();

    expect(await screen.findByText(/restricted to admin accounts/)).toBeTruthy();
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });
});
