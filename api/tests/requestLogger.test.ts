import { EventEmitter } from 'node:events';

const mockLog = { info: jest.fn(), error: jest.fn() };
const noop = () => ({});
jest.mock('winston', () => ({
  createLogger: () => mockLog,
  format: { combine: noop, timestamp: noop, errors: noop, json: noop, colorize: noop, simple: noop },
  transports: { Console: jest.fn(), File: jest.fn() },
}));

const requestLogger = require('../src/middleware/requestLogger').default as typeof import('../src/middleware/requestLogger').default;
const notFound = require('../src/middleware/notFound').default as typeof import('../src/middleware/notFound').default;

const secretQuery = '/api/auth/oauth/callback?code=one-time-code&email=eve@example.test';

it('logs the request path without its query string', () => {
  const res: any = Object.assign(new EventEmitter(), { statusCode: 200 });
  const req: any = { method: 'GET', url: secretQuery, originalUrl: secretQuery, path: '/api/auth/oauth/callback', get: () => 'ua', ip: '127.0.0.1' };

  requestLogger(req, res, () => undefined);
  res.emit('finish');

  const logged = JSON.stringify([...mockLog.info.mock.calls, ...mockLog.error.mock.calls]);
  expect(logged).toContain('/api/auth/oauth/callback');
  expect(logged).not.toContain('one-time-code');
  expect(logged).not.toContain('eve@example.test');
});

it('names an unknown route without its query string', () => {
  const next = jest.fn();
  notFound({ originalUrl: '/api/nope?token=abc', baseUrl: '', path: '/api/nope' } as any, {} as any, next);
  expect(next.mock.calls[0][0].message).toBe('Route /api/nope not found');
});
