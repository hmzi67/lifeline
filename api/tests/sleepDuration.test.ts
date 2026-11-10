export {};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({})) }));

const { minutesSlept } = require('../src/controllers/sleepLogController') as typeof import('../src/controllers/sleepLogController');

describe('sleep length', () => {
  it('counts overnight sleep past midnight', () => {
    expect(minutesSlept('23:00', '07:00')).toBe(480);
    expect(minutesSlept('00:30', '06:00')).toBe(330);
  });

  it('handles same-day naps and seconds in the time', () => {
    expect(minutesSlept('13:15', '14:00:00')).toBe(45);
  });
});
