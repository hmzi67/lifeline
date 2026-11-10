export {};

const mockLogError = jest.fn();
jest.mock('../src/utils/logger', () => ({ logger: { error: (...args: unknown[]) => mockLogError(...args) } }));

const hideInternalErrors = require('../src/middleware/hideInternalErrors').default as typeof import('../src/middleware/hideInternalErrors').default;

const respond = (status: number, body: unknown) => {
  const sent: unknown[] = [];
  const res: any = { statusCode: status, json: (payload: unknown) => { sent.push(payload); return res; } };
  hideInternalErrors({ method: 'GET', path: '/api/things' } as any, res, () => undefined);
  res.json(body);
  return sent[0];
};

describe('hideInternalErrors', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    mockLogError.mockClear();
  });

  it('drops the raw error string from 5xx bodies in production and logs it instead', () => {
    process.env.NODE_ENV = 'production';
    expect(respond(500, { success: false, message: 'Internal server error', error: 'Invalid `prisma.user.findMany()` invocation' }))
      .toEqual({ success: false, message: 'Internal server error' });
    expect(mockLogError.mock.calls[0][1]).toMatchObject({ error: 'Invalid `prisma.user.findMany()` invocation' });
  });

  it.each([undefined, 'staging'])('also scrubs when NODE_ENV is %s', (env) => {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    expect(respond(503, { message: 'Down', error: 'connect ECONNREFUSED 10.0.0.5:5432' })).toEqual({ message: 'Down' });
  });

  it('drops details and stacks from 5xx bodies', () => {
    process.env.NODE_ENV = 'production';
    expect(respond(500, { message: 'x', details: { table: 'users' }, stack: 'Error: at db.ts:1' })).toEqual({ message: 'x' });
  });

  it('keeps client errors and structured error objects', () => {
    process.env.NODE_ENV = 'production';
    expect(respond(400, { success: false, error: 'Bad date' })).toEqual({ success: false, error: 'Bad date' });
    const structured = { success: false, error: { message: 'Something went wrong!', code: 'INTERNAL_SERVER_ERROR' } };
    expect(respond(500, structured)).toEqual(structured);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('leaves responses untouched in development and test', () => {
    process.env.NODE_ENV = 'development';
    expect(respond(500, { message: 'x', error: 'details' })).toEqual({ message: 'x', error: 'details' });
  });
});
