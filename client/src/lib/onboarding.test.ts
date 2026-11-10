import { afterEach, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({ api: { get: vi.fn() } }));
vi.mock('@/lib/axios', () => ({ default: api }));

import { hasCompletedPayment } from './onboarding';

afterEach(() => vi.clearAllMocks());

describe('subscription status', () => {
  it('reads the API status path and trusts an active subscription', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { active: true, source: 'app_store' } } });

    await expect(hasCompletedPayment('u1')).resolves.toBe(true);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/subscription/status');
  });

  it('falls back to payment history when there is no active subscription', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: { active: false } } })
      .mockResolvedValueOnce({ data: { payments: [{ status: 'FAILED' }, { status: 'COMPLETED' }] } });

    await expect(hasCompletedPayment('u1')).resolves.toBe(true);
    expect(api.get.mock.calls[1][0]).toBe('/subscription-payments/user/u1');
  });

  it('treats an unreachable status endpoint as not subscribed instead of throwing', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    await expect(hasCompletedPayment('u1')).resolves.toBe(false);
  });
});
