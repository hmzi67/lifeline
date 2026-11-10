export {};

jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({})) }));

const { toKg, toMeters } = require('../src/controllers/dietPlanController') as typeof import('../src/controllers/dietPlanController');

describe('body measurements for diet personalisation', () => {
  it('reads app-saved values as kg and cm whatever unit the user picked', () => {
    // Onboarding stores kg/cm plus the display choice ("154lbs", "5.8ft" = 5 ft 8 in).
    expect(toKg(70, '154lbs')).toBe(70);
    expect(toKg(78.6, '79kg')).toBe(78.6);
    expect(toMeters(172.72, '5.8ft')).toBeCloseTo(1.7272);
    expect(toMeters(170, '170cm')).toBeCloseTo(1.7);
  });

  it('still converts values stored with a bare unit', () => {
    expect(toKg(80, 'kg')).toBe(80);
    expect(toKg(154, 'lbs')).toBeCloseTo(69.85, 1);
    expect(toMeters(178, 'cm')).toBeCloseTo(1.78);
  });
});
