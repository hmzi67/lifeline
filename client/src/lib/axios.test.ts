import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

// lib/axios touches localStorage and window at import time, so stub them first.
const storage = new Map<string, string>([['token', 'stale-persisted-token']]);
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});
vi.stubGlobal('window', { location: { pathname: '/dashboard', href: '/dashboard', origin: 'http://localhost' } });

const { default: api, getAccessToken, setAccessToken, refreshAccessToken } = await import('./axios');

type Reply = { status: number; data?: unknown };
const calls: InternalAxiosRequestConfig[] = [];
let route: (config: InternalAxiosRequestConfig) => Reply;

const adapter: AxiosAdapter = async (config) => {
  calls.push(config);
  const reply = route(config);
  const response = { data: reply.data ?? {}, status: reply.status, statusText: '', headers: {}, config };
  if (reply.status >= 400) {
    throw Object.assign(new Error(`HTTP ${reply.status}`), { config, response, isAxiosError: true });
  }
  return response;
};

const authHeader = (config: InternalAxiosRequestConfig) => config.headers?.Authorization;
const refreshCalls = () => calls.filter((c) => c.url === '/auth/refresh-token').length;

beforeEach(() => {
  api.defaults.adapter = adapter;
  calls.length = 0;
  setAccessToken(null);
  window.location.href = '/dashboard';
});
afterEach(() => vi.clearAllMocks());

describe('in-memory access token', () => {
  it('drops a token persisted by an older build', () => {
    expect(storage.has('token')).toBe(false);
  });

  it('sends the in-memory token and never writes it to storage', async () => {
    route = () => ({ status: 200 });
    setAccessToken('t1');
    await api.get('/progress/summary');
    expect(authHeader(calls[0])).toBe('Bearer t1');
    expect(storage.has('token')).toBe(false);
  });

  it('restores a session from the refresh cookie', async () => {
    route = (c) => (c.url === '/auth/refresh-token' ? { status: 200, data: { data: { accessToken: 'fresh' } } } : { status: 200 });
    await expect(refreshAccessToken()).resolves.toBe('fresh');
    expect(getAccessToken()).toBe('fresh');
    expect(calls[0].withCredentials).toBe(true);
  });
});

describe('401 handling', () => {
  it('refreshes once for concurrent 401s and retries each request with the new token', async () => {
    setAccessToken('expired');
    route = (c) => {
      if (c.url === '/auth/refresh-token') return { status: 200, data: { data: { accessToken: 'renewed' } } };
      return authHeader(c) === 'Bearer renewed' ? { status: 200, data: { ok: c.url } } : { status: 401 };
    };

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(results.map((r) => r.data.ok)).toEqual(['/a', '/b', '/c']);
    expect(refreshCalls()).toBe(1);
    expect(getAccessToken()).toBe('renewed');
  });

  it('gives up after one retry instead of looping', async () => {
    route = (c) => (c.url === '/auth/refresh-token' ? { status: 200, data: { data: { accessToken: 'still-bad' } } } : { status: 401 });

    await expect(api.get('/a')).rejects.toThrow('HTTP 401');

    expect(refreshCalls()).toBe(1);
    expect(calls.filter((c) => c.url === '/a')).toHaveLength(2);
  });

  it('sends the user to login when the refresh cookie is no longer valid', async () => {
    route = () => ({ status: 401 });

    await expect(api.get('/a')).rejects.toBeTruthy();

    expect(refreshCalls()).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('does not treat a failed login as an expired session', async () => {
    route = () => ({ status: 401 });
    await expect(api.post('/auth/login', {})).rejects.toThrow('HTTP 401');
    expect(refreshCalls()).toBe(0);
  });
});
