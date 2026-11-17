export {};

const mockTx: any = {
  aiGenerationJob: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  aiGenerationBatch: { findUnique: jest.fn(), update: jest.fn() },
};
const mockPrisma: any = {
  $transaction: jest.fn((fn: (tx: any) => unknown) => fn(mockTx)),
  dietPlan: { findUnique: jest.fn() },
  exercisePlan: { findUnique: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

import { reviseJob } from '../src/services/aiGenerator/batchService';
import { loadDietDraft, loadExerciseDraft, revisedSpec, revisionOf, revisionText } from '../src/services/aiGenerator/revise';

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.aiGenerationBatch.findUnique.mockResolvedValue({ id: 'b1', costUsd: 1.2, costCapUsd: 5 });
  mockTx.aiGenerationJob.findFirst.mockResolvedValue({ id: 'j1', position: 0, resultPlanId: 'p1', spec: { kind: 'diet', dietType: 'Traditional', brief: 'No beef' } });
  mockTx.aiGenerationJob.findMany.mockResolvedValue([{ position: 0 }, { position: 1 }, { position: 2 }]);
  mockTx.aiGenerationJob.create.mockResolvedValue({ id: 'j4' });
});

describe('making a new version with picked ideas', () => {
  it('queues a new plan at the end of the batch and leaves the original alone', async () => {
    const result = await reviseJob('b1', 'j1', ['Add raita to Day 2 lunch']);

    expect(result.jobId).toBe('j4');
    const data = mockTx.aiGenerationJob.create.mock.calls[0][0].data;
    expect(data.position).toBe(3);
    expect(data.spec.revision).toEqual({ fromJobId: 'j1', fromPlanId: 'p1', fromPosition: 0, ideas: ['Add raita to Day 2 lunch'] });
    expect(data.spec.dietType).toBe('Traditional');
    expect(mockTx.aiGenerationBatch.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'running', finishedAt: null }) }));
  });

  it('refuses a plan with nothing saved, and a batch over its spending limit', async () => {
    mockTx.aiGenerationJob.findFirst.mockResolvedValueOnce({ id: 'j1', position: 0, resultPlanId: null, spec: {} });
    await expect(reviseJob('b1', 'j1', ['x idea'])).rejects.toMatchObject({ httpStatus: 409 });

    mockTx.aiGenerationBatch.findUnique.mockResolvedValueOnce({ id: 'b1', costUsd: 5, costCapUsd: 5 });
    await expect(reviseJob('b1', 'j1', ['x idea'])).rejects.toMatchObject({ code: 'COST_CAP' });
    // Less than one plan's cost left: it would stop half way, unreviewed.
    mockTx.aiGenerationBatch.findUnique.mockResolvedValueOnce({ id: 'b1', costUsd: 1.89, costCapUsd: 2 });
    await expect(reviseJob('b1', 'j1', ['x idea'])).rejects.toMatchObject({ code: 'COST_CAP', message: expect.stringMatching(/\$0\.11 left/) });
    expect(mockTx.aiGenerationJob.create).not.toHaveBeenCalled();

    // Raising the limit by $1 (what the admin page offers) lets it start.
    mockTx.aiGenerationBatch.findUnique.mockResolvedValueOnce({ id: 'b1', costUsd: 1.89, costCapUsd: 2 });
    await expect(reviseJob('b1', 'j1', ['x idea'], 1)).resolves.toMatchObject({ costCapUsd: 3 });
  });

  it('adds the ideas to the admin notes, so the reviewer holds the plan to them', () => {
    const spec = revisedSpec({ dietType: 'Traditional', brief: 'No beef', revision: { fromJobId: 'j1', fromPlanId: 'p1', fromPosition: 0, ideas: ['Add raita.', 'Rename Day 2 lunch.'] } });
    expect(spec.revision).toBeUndefined();
    expect(spec.brief).toMatch(/^No beef\n.*Add raita\. Rename Day 2 lunch\./);
    expect(revisedSpec({ brief: 'x' })).toEqual({ brief: 'x' });
    expect(revisionOf({ revision: { ideas: [] } })).toBeNull();
  });
});

describe('reading a saved draft back', () => {
  it('turns a diet plan into the shape the AI saves', async () => {
    mockPrisma.dietPlan.findUnique.mockResolvedValue({
      name: 'Desi Gain',
      description: 'Home food',
      dietPlanDays: [
        {
          dayNumber: 1,
          dietPlanMeals: [{ name: 'Aloo paratha', mealType: { name: 'Breakfast' }, recipe: 'Ingredients:\n- paratha: 120 g\n- dahi, plain: 150 g\n\nCook the paratha.\nServe with dahi.' }],
        },
      ],
    });
    expect(await loadDietDraft('p1')).toEqual({
      name: 'Desi Gain',
      description: 'Home food',
      days: [
        {
          dayNumber: 1,
          meals: [{ mealType: 'Breakfast', name: 'Aloo paratha', recipe: 'Cook the paratha.\nServe with dahi.', ingredients: [{ name: 'paratha', grams: 120 }, { name: 'dahi, plain', grams: 150 }] }],
        },
      ],
    });
  });

  it('groups exercise rows back into days', async () => {
    mockPrisma.exercisePlan.findUnique.mockResolvedValue({
      name: 'Legs',
      description: 'Strong legs',
      exercisePlanWeeks: [
        {
          weekNumber: 1,
          exercisePlanSchedule: [
            { exerciseId: 'e1', dayOfWeek: 'Monday', sets: 3, reps: '10', duration: '45 sec' },
            { exerciseId: 'e2', dayOfWeek: 'Monday', sets: 2, reps: null, duration: '30 sec' },
            { exerciseId: 'e1', dayOfWeek: 'Thursday', sets: 3, reps: '12', duration: '45 sec' },
          ],
        },
      ],
    });
    const plan = await loadExerciseDraft('p1');
    expect(plan?.weeks[0].days.map((d) => [d.dayOfWeek, d.exercises.length])).toEqual([
      ['Monday', 2],
      ['Thursday', 1],
    ]);
  });

  it('tells the AI to change only what was picked', () => {
    const text = revisionText({ fromJobId: 'j1', fromPlanId: 'p1', fromPosition: 0, ideas: ['Add raita'] }, { name: 'Desi Gain' });
    expect(text).toMatch(/revision of plan #1/);
    expect(text).toMatch(/"name":"Desi Gain"/);
    expect(text).toMatch(/- Add raita/);
    expect(revisionText({ fromJobId: 'j1', fromPlanId: null, fromPosition: 0, ideas: ['Add raita'] }, null)).toMatch(/no longer exists/);
  });
});
