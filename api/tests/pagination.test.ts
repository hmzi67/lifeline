export {};

const rows = Array.from({ length: 250 }, (_, i) => ({ id: `ex-${String(i).padStart(3, '0')}` }));
const mockFindMany = jest.fn(async (args: any) => {
  const start = args.cursor ? rows.findIndex((r) => r.id === args.cursor.id) + (args.skip ?? 0) : 0;
  return rows.slice(start, start + args.take);
});
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({ exercise: { findMany: mockFindMany } })) }));

const { MAX_PAGE_SIZE, pageSize, cursorArgs } = require('../src/utils/pagination') as typeof import('../src/utils/pagination');
const { getAllExercises } = require('../src/controllers/exerciseController') as typeof import('../src/controllers/exerciseController');

const list = async (query: Record<string, string>) => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn((body: any) => { res.body = body; return res; });
  await getAllExercises({ query } as any, res);
  return res.body;
};

describe('page size', () => {
  it('never exceeds the server maximum, whatever the client asks', () => {
    expect(pageSize('1000000')).toBe(MAX_PAGE_SIZE);
    expect(pageSize('-5', 10)).toBe(1);
    expect(pageSize('0', 10)).toBe(10);
    expect(pageSize('abc', 10)).toBe(10);
    expect(pageSize(undefined, 20)).toBe(20);
    expect(cursorArgs({ limit: '5000' }).take).toBe(MAX_PAGE_SIZE + 1);
  });
});

describe('cursor paging on GET /exercises', () => {
  it('keeps returning a plain array in data, capped, with a cursor to the next page', async () => {
    const first = await list({});
    expect(first.data).toHaveLength(MAX_PAGE_SIZE);
    expect(first.nextCursor).toBe(first.data.at(-1).id);
    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({ id: 'asc' });
  });

  it('walks every row exactly once and ends with a null cursor', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: any = await list(cursor ? { limit: '40', cursor } : { limit: '40' });
      seen.push(...page.data.map((r: any) => r.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(rows.map((r) => r.id));
  });
});
