// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { authService } = vi.hoisted(() => ({
  authService: { getCurrentUser: vi.fn(), logout: vi.fn().mockResolvedValue({}), login: vi.fn() },
}));
vi.mock('@/services/authService', () => ({ authService }));
vi.mock('@/components/layout', () => ({ Sidebar: () => <nav>admin sidebar</nav>, Header: () => null }));
vi.mock('@/components/dashboard', () => ({ DashboardComponent: () => <p>dashboard data</p> }));

import App from './App';
import { useAuthStore } from '@/store/useAuthStore';

const meReply = (role: string) => ({ success: true, data: { user: { id: 'u1', role: { name: role } } } });
const renderApp = () => render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
  // As if an earlier visit left the persisted "signed in" flag behind.
  useAuthStore.setState({ user: { id: 'u1' } as any, isAuthenticated: true, loading: false, error: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('admin route guard', () => {
  it('shows nothing of the panel until the server confirms an admin', async () => {
    let answer!: (value: unknown) => void;
    authService.getCurrentUser.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    renderApp();

    expect(screen.queryByText('admin sidebar')).toBeNull();

    answer(meReply('admin'));
    expect(await screen.findByText('admin sidebar')).toBeTruthy();
    expect(await screen.findByText('dashboard data')).toBeTruthy();
  });

  it('signs out a stored session whose account is not an admin', async () => {
    authService.getCurrentUser.mockResolvedValue(meReply('user'));
    renderApp();

    expect(await screen.findByPlaceholderText('admin@example.com')).toBeTruthy();
    expect(screen.queryByText('admin sidebar')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('signs out when the server cannot confirm the session', async () => {
    authService.getCurrentUser.mockRejectedValue(new Error('401'));
    renderApp();

    expect(await screen.findByPlaceholderText('admin@example.com')).toBeTruthy();
    expect(screen.queryByText('dashboard data')).toBeNull();
  });
});
