export {};

jest.mock('../src/config/database', () => ({ prisma: {} }));

import { correctTags } from '../src/services/aiGenerator/exerciseTools';

const label = (position: 'standing' | 'seated' | 'floor', equipment: string[] = []) => ({ position, impact: 'low' as const, equipment });

// The AI labelled these wrongly in Nov 2026 testing, which let them into "no floor" and "no equipment" plans.
describe('exercise labels from the name', () => {
  it('puts floor exercises on the floor', () => {
    expect(correctTags('Hip Thrusts', label('standing'))?.position).toBe('floor');
    expect(correctTags('Russian Twists', label('seated'))?.position).toBe('floor');
    expect(correctTags('Incline Push-Ups', label('standing'))?.position).toBe('standing');
  });

  it('adds the weight an exercise needs', () => {
    expect(correctTags('Goblet Squats', label('standing'))?.equipment).toEqual(['dumbbells']);
    expect(correctTags('Farmer Carry', label('standing'))?.equipment).toEqual(['dumbbells']);
    expect(correctTags('Romanian Deadlifts', label('standing'))?.equipment.length).toBeGreaterThan(0);
    expect(correctTags('Dumbbell Rows', label('standing', ['dumbbells']))?.equipment).toEqual(['dumbbells']);
  });

  it('seats machine exercises and leaves good labels alone', () => {
    expect(correctTags('Lat Pulldowns', label('standing'))?.position).toBe('seated');
    expect(correctTags('March in Place', label('standing'))).toEqual(label('standing'));
    expect(correctTags('March in Place', null)).toBeNull();
  });
});
