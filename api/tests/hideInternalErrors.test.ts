export {};

const hideInternalErrors = require('../src/middleware/hideInternalErrors').default as typeof import('../src/middleware/hideInternalErrors').default;

const respond = (status: number, body: unknown) => {
  const sent: unknown[] = [];
  const res: any = { statusCode: status, json: (payload: unknown) => { sent.push(payload); return res; } };
  hideInternalErrors({} as any, res, () => undefined);
  res.json(body);
  return sent[0];
};

describe('hideInternalErrors', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('drops the raw error string from 5xx bodies in production', () => {
    process.env.NODE_ENV = 'production';
    expect(respond(500, { success: false, message: 'Internal server error', error: 'Invalid `prisma.user.findMany()` invocation' }))
      .toEqual({ success: false, message: 'Internal server error' });
  });

  it('keeps client errors and structured error objects', () => {
    process.env.NODE_ENV = 'production';
    expect(respond(400, { success: false, error: 'Bad date' })).toEqual({ success: false, error: 'Bad date' });
    const structured = { success: false, error: { message: 'Something went wrong!', code: 'INTERNAL_SERVER_ERROR' } };
    expect(respond(500, structured)).toEqual(structured);
  });

  it('leaves responses untouched outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(respond(500, { message: 'x', error: 'details' })).toEqual({ message: 'x', error: 'details' });
  });
});
