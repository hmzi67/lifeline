export {};
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.mock('nodemailer', () => ({ createTransport: (...args: any[]) => (mockCreateTransport as any)(...args) }));
const { sendPasswordResetEmail } = require('../src/services/emailService');

describe('Production email security expectations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    process.env.LOG_OTP_TO_CONSOLE = 'false';
    process.env.EMAIL_HOST = 'smtp.example.test';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_USER = 'synthetic-user';
    process.env.EMAIL_PASS = 'synthetic-password';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  it('SEC-06 validates the SMTP server certificate', async () => {
    mockSendMail.mockResolvedValue({});
    await sendPasswordResetEmail('audit@example.test', 'Audit', '123456');
    expect((mockCreateTransport.mock.calls[0] as any[])[0].tls.rejectUnauthorized).not.toBe(false);
  });
  it('SEC-07 never writes a password reset OTP to production logs after SMTP failure', async () => {
    mockSendMail.mockRejectedValue(new Error('Synthetic SMTP failure'));
    // Delivery failure is reported by rejecting (next test); only the logs matter here.
    await sendPasswordResetEmail('audit@example.test', 'Audit', '123456').catch(() => undefined);
    const logs = (console.log as jest.Mock).mock.calls.map(args => args.join(' ')).join('\n');
    expect(logs).not.toContain('123456');
  });
  it('reports failed delivery to the password reset controller', async () => {
    mockSendMail.mockRejectedValue(new Error('Synthetic SMTP failure'));
    await expect(sendPasswordResetEmail('audit@example.test', 'Audit', '123456')).rejects.toThrow();
  });
});
