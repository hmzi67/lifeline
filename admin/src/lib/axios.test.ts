import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

// lib/axios touches localStorage and window at import time, so stub them first.
const storage = new Map<string, string>([['token', 'stale-persisted-token'], ['admin-auth-store', '{}']]);
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});
vi.stubGlobal('window', { location: { pathname: '/users', href: '/users', origin: 'http://localhost' } });

const { default: api, getAccessToken, setAccessToken } = await import('./axios');

type Reply = { status: number; data?: unknown };
const calls: InternalAxiosRequestConfig[] = [];
let route: (config: InternalAxiosRequestConfig) => Reply;
const adapter: AxiosAdapter = async (config) => {
  calls.push(config);
  const reply = route(config);
  const response = { data: reply.data ?? {}, status: reply.status, statusText: '', headers: {}, config };
  if (reply.status >= 400) throw Object.assign(new Error(`HTTP ${reply.status}`), { config, response, isAxiosError: true });
  return response;
};
const refreshCalls = () => calls.filter((c) => c.url === '/auth/refresh-token').length;

beforeEach(() => {
  api.defaults.adapter = adapter;
  calls.length = 0;
  setAccessToken(null);
  window.location.href = '/users';
});

describe('admin access token', () => {
  it('drops a token persisted by an older build', () => {
    expect(storage.has('token')).toBe(false);
  });

  it('refreshes once for concurrent 401s after a reload and retries with the new token', async () => {
    route = (c) => {
      if (c.url === '/auth/refresh-token') return { status: 200, data: { data: { accessToken: 'renewed' } } };
      return c.headers?.Authorization === 'Bearer renewed' ? { status: 200 } : { status: 401 };
    };
    await Promise.all([api.get('/roles'), api.get('/user/admin/users')]);
    expect(refreshCalls()).toBe(1);
    expect(getAccessToken()).toBe('renewed');
    expect(storage.has('token')).toBe(false);
  });

  it('signs out to /login without looping when the refresh cookie is gone', async () => {
    route = () => ({ status: 401 });
    await expect(api.get('/roles')).rejects.toBeTruthy();
    expect(refreshCalls()).toBe(1);
    expect(window.location.href).toBe('/login');
    expect(storage.has('admin-auth-store')).toBe(false);
  });

  it('does not treat a wrong password as an expired session', async () => {
    route = () => ({ status: 401 });
    await expect(api.post('/auth/login', {})).rejects.toThrow('HTTP 401');
    expect(refreshCalls()).toBe(0);
  });
});
