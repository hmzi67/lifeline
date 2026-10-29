export {};

// Public blog reads once included whole user rows (password hash, email, OTP),
// which let anyone read an admin's password-reset code.
const mockPrisma = {
  blog: {
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    findUnique: jest.fn(async () => ({ id: 'blog-1' })),
  },
  blogComment: {
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const blogs = require('../src/controllers/blogsController') as typeof import('../src/controllers/blogsController');

const response = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const ALLOWED = new Set(['id', 'username', 'displayName', 'profileImage']);

/** Every author/user relation in a Prisma query must select public profile fields only. */
const userRelations = (node: unknown, path = ''): string[] => {
  if (!node || typeof node !== 'object') return [];
  const problems: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const here = `${path}.${key}`;
    if (key === 'author' || key === 'user') {
      const select = (value as any)?.select;
      if (!select) problems.push(`${here} includes the whole user row`);
      else for (const field of Object.keys(select)) if (!ALLOWED.has(field)) problems.push(`${here}.${field}`);
    }
    problems.push(...userRelations(value, here));
  }
  return problems;
};

describe('public blog endpoints expose only public profile fields', () => {
  const reads: Array<[string, (req: any, res: any) => Promise<unknown>, any]> = [
    ['getAllBlogs', blogs.getAllBlogs, { query: {} }],
    ['getBlogById', blogs.getBlogById, { params: { id: 'blog-1' } }],
    ['getBlogBySlug', blogs.getBlogBySlug, { params: { slug: 'post' } }],
    ['getBlogsByCategory', blogs.getBlogsByCategory, { params: { categoryId: 'c' }, query: {} }],
    ['getBlogsByAuthor', blogs.getBlogsByAuthor, { params: { authorId: 'a' }, query: {} }],
    ['getBlogComments', blogs.getBlogComments, { params: { blogId: 'blog-1' }, query: {} }],
  ];

  it.each(reads)('%s', async (_name, handler, req) => {
    jest.clearAllMocks();
    await handler(req, response());
    const calls = [
      ...mockPrisma.blog.findMany.mock.calls,
      ...mockPrisma.blog.findUnique.mock.calls,
      ...mockPrisma.blogComment.findMany.mock.calls,
    ] as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.flatMap((args) => userRelations(args[0]))).toEqual([]);
  });

  it('matches blog status regardless of case', async () => {
    jest.clearAllMocks();
    await blogs.getAllBlogs({ query: { status: 'PUBLISHED' } } as any, response());
    expect((mockPrisma.blog.findMany.mock.calls[0] as any[])[0].where.status)
      .toEqual({ equals: 'PUBLISHED', mode: 'insensitive' });
  });
});
