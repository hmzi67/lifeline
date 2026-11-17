export {};

const mockPrisma: any = {
  role: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/config/index', () => ({ config: { jwt: { secret: 'test-secret' } } }));

import jwt from 'jsonwebtoken';
import authenticate from '../src/middleware/authenticate';
import { isAdminOnMobile, isMobileAppRequest, resetAdminRoleCache } from '../src/utils/adminRole';

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const token = jwt.sign({ userId: 'u1', email: 'a@b.c', roleId: 'role-admin' }, 'test-secret');
const request = (fromApp: boolean) =>
  ({ headers: { authorization: `Bearer ${token}`, ...(fromApp ? { 'x-requested-with': 'ReactNative' } : {}) } }) as any;

const userWithRole = (role: string) => ({
  id: 'u1',
  email: 'a@b.c',
  role: { name: role },
  isEmailVerified: true,
  status: 'active',
});

beforeEach(() => {
  jest.clearAllMocks();
  resetAdminRoleCache();
  mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-admin' });
});

describe('telling the mobile app apart', () => {
  it('recognises the header the app sends on every request', () => {
    expect(isMobileAppRequest(request(true))).toBe(true);
    expect(isMobileAppRequest(request(false))).toBe(false);
  });

  it('flags only an admin role coming from the app', async () => {
    expect(await isAdminOnMobile(request(true), 'role-admin')).toBe(true);
    expect(await isAdminOnMobile(request(true), 'role-user')).toBe(false);
    expect(await isAdminOnMobile(request(false), 'role-admin')).toBe(false);
    expect(await isAdminOnMobile(request(true), null)).toBe(false);
  });
});

describe('authenticated requests', () => {
  it('refuses an admin account in the mobile app', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userWithRole('admin'));
    const res = mockResponse();
    const next = jest.fn();

    await authenticate(request(true), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ADMIN_NOT_ALLOWED_ON_MOBILE' }));
  });

  it('still lets an admin use the admin panel, and users use the app', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userWithRole('admin'));
    const adminNext = jest.fn();
    await authenticate(request(false), mockResponse(), adminNext);
    expect(adminNext).toHaveBeenCalled();

    mockPrisma.user.findUnique.mockResolvedValue(userWithRole('user'));
    const userNext = jest.fn();
    await authenticate(request(true), mockResponse(), userNext);
    expect(userNext).toHaveBeenCalled();
  });
});
