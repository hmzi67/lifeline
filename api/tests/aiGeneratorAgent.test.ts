export {};

const mockPrisma: any = {
  aiGenerationBatch: { findUnique: jest.fn() },
  aiGenerationJob: { update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 1 })), findMany: jest.fn(async () => []) },
};
const mockDropJobDraft = jest.fn(async (..._args: unknown[]) => 1);
jest.mock('../src/services/aiGenerator/batchService', () => ({ dropJobDraft: (...args: unknown[]) => mockDropJobDraft(...args), dropUnusedDraftExercises: async () => 0 }));
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const mockChat = jest.fn();
jest.mock('../src/services/aiGenerator/openai', () => ({
  aiSettings: () => ({ agentModel: 'agent', criticModel: 'critic' }),
  chat: (...args: unknown[]) => mockChat(...args),
}));

const mockRunExerciseTool = jest.fn();
const mockLibrary = jest.fn(async () => new Map<string, any>());
jest.mock('../src/services/aiGenerator/exerciseTools', () => {
  const { z } = jest.requireActual('zod');
  return {
    correctTags: (_name: unknown, tags: unknown) => tags,
    exerciseToolDefinitions: [],
    exerciseCatalogText: async () => 'e1 | Squat | beginner | strength',
    describeExercisePlan: () => 'plan text',
    exerciseTagsSchema: z.object({ position: z.string(), impact: z.string(), equipment: z.array(z.string()) }),
    existingPlanNames: async () => new Map([['old plan', 'Old Plan']]),
    library: () => mockLibrary(),
    runExerciseTool: (...args: unknown[]) => mockRunExerciseTool(...args),
  };
});
const mockPictureFor = jest.fn();
jest.mock('../src/services/aiGenerator/media', () => ({ pictureFor: (...args: unknown[]) => mockPictureFor(...args), stockVideo: jest.fn() }));

import { runPlanJob } from '../src/services/aiGenerator/agent';
import { JobError } from '../src/services/aiGenerator/worker';

const toolCall = (name: string) => ({
  message: { role: 'assistant', content: null, tool_calls: [{ id: `c-${name}`, type: 'function', function: { name, arguments: '{}' } }] },
  costUsd: 0.01,
});
const reply = (content: string) => ({ message: { role: 'assistant', content }, costUsd: 0.01 });
const critic = (approved: boolean, issues: string[] = [], suggestions: string[] = []) => ({
  message: { role: 'assistant', content: JSON.stringify({ mustFix: approved ? [] : issues.map((problem) => ({ type: 'safety', problem })), suggestions }) },
  costUsd: 0.005,
});

const ctx = {
  job: { id: 'job-1', batchId: 'batch-1', position: 0, attempts: 1, spec: { level: 'beginner', focusArea: 'Legs', weeks: 1, daysPerWeek: 1, minutesPerSession: 20 } },
  batch: { id: 'batch-1', kind: 'exercise', mediaSource: 'admin_upload', settings: {} },
  signal: new AbortController().signal,
};

/** Fakes save_exercise_plan: the first save fails the checks, later ones succeed. */
const saveFailsOnce = () => {
  let saves = 0;
  mockRunExerciseTool.mockImplementation(async (state: any, name: string) => {
    if (name !== 'save_exercise_plan') return { result: {}, summary: name };
    saves += 1;
    if (saves === 1) {
      state.lastCheck = { errors: ['Week 1 Monday: use 3 to 10 exercises'], warnings: [] };
      return { result: { saved: false }, summary: 'rejected' };
    }
    state.lastCheck = { errors: [], warnings: [] };
    state.planId = 'plan-1';
    state.lastPlan = { kind: 'exercise', plan: { name: 'Legs', description: 'd', weeks: [] } };
    return { result: { saved: true }, summary: 'saved' };
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.aiGenerationBatch.findUnique.mockResolvedValue({ costUsd: 0, costCapUsd: null });
  mockLibrary.mockResolvedValue(new Map());
});

it('fixes a rejected save and a reviewer issue, then succeeds', async () => {
  saveFailsOnce();
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan')) // rejected by the checks
    .mockResolvedValueOnce(toolCall('save_exercise_plan')) // fixed and saved
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce(critic(false, ['Add a warm-up']))
    .mockResolvedValueOnce(toolCall('save_exercise_plan')) // saved again after the review
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce(critic(true));

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.status).toBe('succeeded');
  expect(outcome.resultPlanId).toBe('plan-1');
  expect(outcome.costUsd).toBeCloseTo(0.06);
  // The reviewer's issue went back to the agent.
  const agentMessages: { role: string; content: string | null }[] = mockChat.mock.calls[4][0].messages;
  expect(agentMessages.some((m) => m.role === 'user' && /Add a warm-up/.test(m.content ?? ''))).toBe(true);
});

it('saves the plan for review when the reviewer keeps finding issues', async () => {
  saveFailsOnce();
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValue(reply('Saved.'));
  mockChat.mockImplementation(async (options: any) => (options.model === 'critic' ? critic(false, ['Too repetitive']) : reply('Saved.')));

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.status).toBe('needs_attention');
  expect(outcome.message).toMatch(/Too repetitive/);
});

it('asks the next review to re-check the earlier findings instead of starting over', async () => {
  saveFailsOnce();
  const criticPrompts: string[] = [];
  mockChat.mockImplementation(async (options: any) => {
    if (options.model !== 'critic') return reply('Saved.');
    criticPrompts.push(options.messages[1].content);
    return critic(false, ['Too repetitive']);
  });
  mockChat.mockResolvedValueOnce(toolCall('save_exercise_plan')).mockResolvedValueOnce(toolCall('save_exercise_plan'));

  await runPlanJob(ctx as any);

  expect(criticPrompts.length).toBeGreaterThan(1);
  expect(criticPrompts[0]).not.toMatch(/re-check/);
  expect(criticPrompts[1]).toMatch(/This is a re-check[\s\S]*Too repetitive/);
});

it('treats a must-fix item without an allowed type as a suggestion', async () => {
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce({
      message: { role: 'assistant', content: JSON.stringify({ mustFix: [{ type: 'variety', problem: 'Use more varied warm-ups' }, 'Shorter rests'], suggestions: [] }) },
      costUsd: 0.005,
    });

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.status).toBe('succeeded');
  expect(outcome.message).toMatch(/Optional ideas[\s\S]*Use more varied warm-ups[\s\S]*Shorter rests/);
  expect(outcome.message).not.toMatch(/Please fix/);
});

it('asks again when the review is not JSON, and passes on a readable approval', async () => {
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce(reply('Looks good to me!'))
    .mockResolvedValueOnce(critic(true));

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.status).toBe('succeeded');
  expect(mockChat).toHaveBeenCalledTimes(4);
});

it('never passes a plan whose review could not be read', async () => {
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce(reply('Looks good to me!'))
    .mockResolvedValueOnce(reply('[]'));

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.status).toBe('needs_attention');
  expect(outcome.message).toMatch(/couldn't be read/);
  // Nothing unreadable is sent back to the agent as a problem to fix.
  expect(mockChat).toHaveBeenCalledTimes(4);
});

it('reads ideas the reviewer sends as objects', async () => {
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce({
      message: { role: 'assistant', content: JSON.stringify({ mustFix: [], suggestions: [{ type: 'variety', problem: 'Swap one squat day' }, { suggestion: 'Add a cool-down' }] }) },
      costUsd: 0.005,
    });

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.message).toMatch(/Swap one squat day[\s\S]*Add a cool-down/);
  expect(outcome.message).not.toMatch(/object Object/);
});

it('fails (retryable) when no valid plan is ever saved', async () => {
  mockRunExerciseTool.mockImplementation(async (state: any) => {
    state.lastCheck = { errors: ['bad'], warnings: [] };
    return { result: { saved: false }, summary: 'rejected' };
  });
  mockChat.mockResolvedValue(reply('I give up.'));

  await expect(runPlanJob(ctx as any)).rejects.toMatchObject({ retryable: true });
  await expect(runPlanJob(ctx as any)).rejects.toBeInstanceOf(JobError);
});

it('gives up after 5 rejected saves in a row, without a retry, and logs why', async () => {
  mockRunExerciseTool.mockImplementation(async (state: any) => {
    state.lastCheck = { errors: ['Week 1 Monday: session time is 9 min', 'Week 1 Tuesday: session time is 8 min'], warnings: [] };
    return { result: { saved: false, errors: state.lastCheck.errors }, summary: 'rejected: 2 errors' };
  });
  let n = 0;
  mockChat.mockImplementation(async () => {
    n += 1;
    return { message: { role: 'assistant', content: null, tool_calls: [{ id: `c${n}`, type: 'function', function: { name: 'save_exercise_plan', arguments: `{"draft":${n}}` } }] }, costUsd: 0.01 };
  });

  const error: any = await runPlanJob(ctx as any).catch((e) => e);

  expect(error).toBeInstanceOf(JobError);
  expect(error.retryable).toBe(false);
  expect(error.message).toMatch(/tried 5 times in a row/);
  expect(error.message).toMatch(/What was still wrong:\n• /);
  expect(error.message).toMatch(/session time is 9 min/);
  expect(mockChat).toHaveBeenCalledTimes(5);
  expect(error.log.some((e: any) => e.type === 'tool' && /session time is 9 min/.test(e.summary))).toBe(true);
});

it('sends only the newest plan draft back to the model', async () => {
  mockRunExerciseTool.mockImplementation(async (state: any) => {
    state.lastCheck = { errors: ['bad'], warnings: [] };
    return { result: { saved: false, errors: ['bad'] }, summary: 'rejected: 1 errors' };
  });
  let n = 0;
  const sentDrafts: string[][] = [];
  mockChat.mockImplementation(async (options: any) => {
    sentDrafts.push(options.messages.flatMap((m: any) => m.tool_calls ?? []).map((c: any) => c.function.arguments));
    n += 1;
    return { message: { role: 'assistant', content: null, tool_calls: [{ id: `c${n}`, type: 'function', function: { name: 'save_exercise_plan', arguments: `{"draft":${n}}` } }] }, costUsd: 0.01 };
  });

  await runPlanJob(ctx as any).catch(() => undefined);

  // The 4th request carries drafts 1-3; only draft 3 keeps its full arguments.
  expect(sentDrafts[3]).toHaveLength(3);
  expect(sentDrafts[3].filter((a) => a.startsWith('{"draft"'))).toEqual(['{"draft":3}']);
});

it('gives plan exercises with no picture or an outside link a new one, and keeps our uploads', async () => {
  const images: Record<string, string | null> = {
    placeholder: 'https://images.unsplash.com/photo-1?w=900',
    empty: null,
    ours: 'http://localhost:3000/uploads/image/kept.png',
  };
  mockPrisma.exercise = {
    findUnique: jest.fn(async ({ where }: any) => ({ name: where.id, image: images[where.id], videoUrl: null })),
    update: jest.fn(async () => ({})),
  };
  mockPrisma.exercisePlan = { update: jest.fn(async () => ({})) };
  mockPictureFor.mockResolvedValue({ url: 'http://localhost:3000/uploads/image/new.png', costUsd: 0.02 });
  mockRunExerciseTool.mockImplementation(async (state: any) => {
    state.lastCheck = { errors: [], warnings: [] };
    state.planId = 'plan-1';
    const row = (exerciseId: string) => ({ exerciseId, sets: 3, duration: '45 sec' });
    state.lastPlan = { kind: 'exercise', plan: { name: 'P', description: 'd', weeks: [{ weekNumber: 1, days: [{ dayOfWeek: 'Monday', exercises: [row('placeholder'), row('empty'), row('ours')] }] }] } };
    return { result: { saved: true }, summary: 'saved' };
  });
  mockChat.mockImplementation(async (options: any) => (options.model === 'critic' ? critic(true) : options.messages.length > 2 ? reply('Saved.') : toolCall('save_exercise_plan')));

  const outcome = await runPlanJob({ ...ctx, batch: { ...ctx.batch, mediaSource: 'ai_generated' } } as any);

  const updated = mockPrisma.exercise.update.mock.calls.map((c: any) => c[0].where.id).sort();
  expect(updated).toEqual(['empty', 'placeholder']);
  expect(outcome.costUsd).toBeGreaterThan(0.06 - 1e-9); // cover + 2 exercise pictures
});

it('passes a plan with only reviewer suggestions and shows them as optional notes', async () => {
  saveFailsOnce();
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce(critic(true, [], ['Swap high knees for a low-impact march']));

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.status).toBe('succeeded');
  expect(outcome.message).toMatch(/Optional ideas from the coach review:\n• Swap high knees/);
  // Suggestions are not sent back for another (paid) fix round.
  expect(mockChat).toHaveBeenCalledTimes(4);
});

it('treats a reviewer "None" must-fix item as no issue', async () => {
  saveFailsOnce();
  mockChat
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(toolCall('save_exercise_plan'))
    .mockResolvedValueOnce(reply('Saved.'))
    .mockResolvedValueOnce({ message: { role: 'assistant', content: JSON.stringify({ mustFix: ['None'], suggestions: [] }) }, costUsd: 0.005 });

  const outcome = await runPlanJob(ctx as any);

  expect(outcome.status).toBe('succeeded');
  expect(mockChat).toHaveBeenCalledTimes(4);
});

describe('drafts of failed tries', () => {
  it('notes the draft on the job as soon as it is saved', async () => {
    saveFailsOnce();
    mockChat
      .mockResolvedValueOnce(toolCall('save_exercise_plan'))
      .mockResolvedValueOnce(toolCall('save_exercise_plan'))
      .mockResolvedValueOnce(reply('Saved.'))
      .mockResolvedValueOnce(critic(true));

    await runPlanJob(ctx as any);

    expect(mockPrisma.aiGenerationJob.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { resultPlanId: 'plan-1' } });
    expect(mockDropJobDraft).not.toHaveBeenCalled();
  });

  it('removes the saved draft when the try fails afterwards', async () => {
    saveFailsOnce();
    mockChat
      .mockResolvedValueOnce(toolCall('save_exercise_plan'))
      .mockResolvedValueOnce(toolCall('save_exercise_plan'))
      .mockRejectedValueOnce(new JobError('OpenAI is busy (500)', true));

    await expect(runPlanJob(ctx as any)).rejects.toMatchObject({ retryable: true });

    expect(mockDropJobDraft).toHaveBeenCalledWith('job-1', 'plan-1');
  });

  it('clears a draft left by an earlier, cut-off try before starting', async () => {
    mockChat.mockResolvedValue(reply('I give up.'));
    mockRunExerciseTool.mockResolvedValue({ result: {}, summary: 'x' });

    await runPlanJob({ ...ctx, job: { ...ctx.job, resultPlanId: 'old-plan' } } as any).catch(() => undefined);

    expect(mockDropJobDraft).toHaveBeenCalledWith('job-1');
  });
});

describe('pictures', () => {
  const savesPlanWith = (exerciseIds: string[]) =>
    mockRunExerciseTool.mockImplementation(async (state: any) => {
      state.lastCheck = { errors: [], warnings: [] };
      state.planId = 'plan-1';
      const row = (exerciseId: string) => ({ exerciseId, sets: 3, duration: '45 sec' });
      state.lastPlan = { kind: 'exercise', plan: { name: 'P', description: 'd', weeks: [{ weekNumber: 1, days: [{ dayOfWeek: 'Monday', exercises: exerciseIds.map(row) }] }] } };
      return { result: { saved: true }, summary: 'saved' };
    });
  const oneSaveThenApproved = () =>
    mockChat.mockImplementation(async (options: any) => (options.model === 'critic' ? critic(true) : options.messages.length > 2 ? reply('Saved.') : toolCall('save_exercise_plan')));

  beforeEach(() => {
    mockPrisma.exercisePlan = { update: jest.fn(async () => ({})) };
    mockPictureFor.mockResolvedValue({ url: 'http://localhost:3000/uploads/image/new.jpg', costUsd: 0.02 });
  });

  it('holds a new picture for an exercise that is live in the app until the plan is published', async () => {
    mockPrisma.exercise = {
      findUnique: jest.fn(async () => ({ name: 'Squat', image: 'https://images.unsplash.com/x', videoUrl: null, status: 'published' })),
      update: jest.fn(async () => ({})),
    };
    savesPlanWith(['live-squat']);
    oneSaveThenApproved();

    const outcome = await runPlanJob({ ...ctx, batch: { ...ctx.batch, mediaSource: 'ai_generated' } } as any);

    expect(mockPrisma.exercise.update).not.toHaveBeenCalled();
    const reviewData = mockPrisma.aiGenerationJob.update.mock.calls.map((c: any) => c[0].data.reviewData).find(Boolean);
    expect(reviewData.pendingMedia).toEqual({ 'live-squat': { image: 'http://localhost:3000/uploads/image/new.jpg' } });
    expect(outcome.message).toMatch(/gets a new picture when you publish/);
  });

  it('reuses a picture another plan of the batch already made for the same live exercise', async () => {
    mockPrisma.exercise = {
      findUnique: jest.fn(async () => ({ name: 'Squat', image: null, videoUrl: null, status: 'published' })),
      update: jest.fn(async () => ({})),
    };
    mockPrisma.aiGenerationJob.findMany.mockResolvedValueOnce([{ reviewData: { pendingMedia: { 'live-squat': { image: 'http://localhost:3000/uploads/image/first.jpg' } } } }]);
    savesPlanWith(['live-squat']);
    oneSaveThenApproved();

    const outcome = await runPlanJob({ ...ctx, batch: { ...ctx.batch, mediaSource: 'ai_generated' } } as any);

    // Only the plan cover was generated; the exercise picture was reused for free.
    expect(mockPictureFor).toHaveBeenCalledTimes(1);
    expect(outcome.costUsd).toBeCloseTo(0.01 + 0.01 + 0.005 + 0.02);
  });

  it('stops the job clock before pictures, so slow pictures cannot fail the plan', async () => {
    mockPrisma.exercise = { findUnique: jest.fn(async () => null), update: jest.fn() };
    savesPlanWith([]);
    oneSaveThenApproved();
    const stopClock = jest.fn();
    mockPictureFor.mockImplementation(async () => {
      expect(stopClock).toHaveBeenCalledTimes(1);
      return { url: null, costUsd: 0, note: 'none' };
    });

    const outcome = await runPlanJob({ ...ctx, stopClock, batch: { ...ctx.batch, mediaSource: 'stock' } } as any);

    expect(mockPictureFor).toHaveBeenCalled();
    expect(outcome.status).toBe('succeeded');
  });

  it('keeps the plan when the picture step itself breaks', async () => {
    mockPrisma.exercise = { findUnique: jest.fn(async () => { throw new Error('db hiccup'); }), update: jest.fn() };
    savesPlanWith(['e1']);
    oneSaveThenApproved();

    const outcome = await runPlanJob({ ...ctx, batch: { ...ctx.batch, mediaSource: 'ai_generated' } } as any);

    expect(outcome.resultPlanId).toBe('plan-1');
    expect(outcome.message).toMatch(/Pictures stopped early/);
    expect(mockDropJobDraft).not.toHaveBeenCalled();
  });
});

describe('labelling exercises', () => {
  it('labels unlabelled library exercises once and saves the labels', async () => {
    const squat: any = { id: 'e1', name: 'Squat', purpose: 'strength', difficulty: 'beginner', tags: null };
    const plank = { id: 'e2', name: 'Plank', purpose: 'core', difficulty: 'beginner', tags: { position: 'floor', impact: 'low', equipment: [] } };
    mockLibrary.mockResolvedValue(new Map<string, any>([['e1', squat], ['e2', plank]]));
    mockPrisma.exercise = { update: jest.fn(async () => ({})), findUnique: jest.fn(async () => null) };
    mockChat
      .mockResolvedValueOnce({ message: { role: 'assistant', content: JSON.stringify({ labels: [{ id: 'e1', position: 'standing', impact: 'low', equipment: [] }] }) }, costUsd: 0.002 })
      .mockResolvedValue(reply('I give up.'));
    mockRunExerciseTool.mockResolvedValue({ result: {}, summary: 'x' });

    await runPlanJob(ctx as any).catch(() => undefined);

    // Only the unlabelled exercise was sent and saved.
    expect(mockChat.mock.calls[0][0].messages[1].content).toBe('e1 | Squat | strength');
    expect(mockPrisma.exercise.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { tags: { position: 'standing', impact: 'low', equipment: [] } } });
    expect(squat.tags).toEqual({ position: 'standing', impact: 'low', equipment: [] });
  });
});
