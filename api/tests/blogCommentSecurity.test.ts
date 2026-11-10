export {};

const mockPrisma = {
  blogComment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const {
  createBlogComment,
  deleteBlogComment,
  updateBlogComment,
} = require('../src/controllers/blogsController') as typeof import('../src/controllers/blogsController');

const createResponse = () => {
  const response: any = { body: null, statusCode: 0 };
  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body: unknown) => {
    response.body = body;
    return response;
  });
  return response;
};

describe('blog comment ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the authenticated user as the comment author', async () => {
    mockPrisma.blogComment.create.mockResolvedValue({ id: 'comment-one' });
    const response = createResponse();

    await createBlogComment({
      params: { blogId: 'blog-one' },
      body: { userId: 'spoofed-user', content: 'Hello' },
      user: { id: 'user-one', email: 'user@example.com', role: '' },
    } as any, response);

    expect(response.statusCode).toBe(201);
    expect(mockPrisma.blogComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-one' }),
    }));
  });

  it('prevents a user from editing another user\'s comment', async () => {
    mockPrisma.blogComment.findUnique.mockResolvedValue({ userId: 'user-two' });
    const response = createResponse();

    await updateBlogComment({
      params: { id: 'comment-one' },
      body: { content: 'Changed' },
      user: { id: 'user-one', email: 'user@example.com', role: '' },
    } as any, response);

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.blogComment.update).not.toHaveBeenCalled();
  });

  it('allows an admin to remove a comment', async () => {
    mockPrisma.blogComment.findUnique.mockResolvedValue({ userId: 'user-two' });
    mockPrisma.blogComment.findMany.mockResolvedValue([]);
    mockPrisma.blogComment.delete.mockResolvedValue({ id: 'comment-one' });
    const response = createResponse();

    await deleteBlogComment({
      params: { id: 'comment-one' },
      user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' },
    } as any, response);

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.blogComment.delete).toHaveBeenCalledWith({ where: { id: 'comment-one' } });
  });
});
