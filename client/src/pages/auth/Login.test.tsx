// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { api, setAccessToken } = vi.hoisted(() => ({
  api: { post: vi.fn(), get: vi.fn() },
  setAccessToken: vi.fn(),
}));
vi.mock('@/lib/axios', () => ({
  default: api,
  setAccessToken,
  getAccessToken: vi.fn(),
  refreshAccessToken: vi.fn().mockRejectedValue(new Error('no session')),
}));

import { AuthProvider } from '@/contexts/AuthContext';
import Login from './Login';

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/questions" element={<p>questionnaire page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

const signIn = (email: string, password: string) => {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Login page', () => {
  it('signs in, keeps the token in memory only, and continues onboarding', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { user: { id: 'u1', email: 'a@example.test' }, accessToken: 'access-1' } } });
    api.get.mockResolvedValue({ data: { data: {} } });
    renderLogin();

    signIn('a@example.test', 'correct horse battery');

    expect(await screen.findByText('questionnaire page')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@example.test', password: 'correct horse battery' });
    expect(setAccessToken).toHaveBeenCalledWith('access-1');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('shows the server message when the credentials are wrong', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
    renderLogin();

    signIn('a@example.test', 'wrong');

    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(setAccessToken).not.toHaveBeenCalledWith(expect.any(String));
  });
});
