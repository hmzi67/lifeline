// controllers/blog.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const prisma = new PrismaClient();

// Blog authors and commenters are shown publicly: never include the full user
// row (password hash, email, phone, one-time codes, store tokens).
const PUBLIC_PROFILE = { select: { id: true, username: true, displayName: true, profileImage: true } } as const;

/** Status is stored uppercase ("PUBLISHED", "DRAFT"), whatever case the client sends. */
const normalizeStatus = (status: unknown) => (typeof status === 'string' ? status.toUpperCase() : undefined);

// Blog Category Controllers
export const createBlogCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug } = req.body;
    
    const category = await prisma.blogCategory.create({
      data: { name, slug }
    });
    
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllBlogCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      include: { _count: { select: { blogs: true } } }
    });
    
    res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBlogCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const category = await prisma.blogCategory.findUnique({
      where: { id },
      include: { blogs: true }
    });
    
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    
    res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateBlogCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug } = req.body;
    
    const category = await prisma.blogCategory.update({
      where: { id },
      data: { name, slug }
    });
    
    res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteBlogCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.blogCategory.delete({
      where: { id }
    });
    
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Blog Controllers
export const createBlog = async (req: Request, res: Response) => {
  try {
    const { title, slug, content, excerpt, coverImage, status, categoryId } = req.body;
    // The author is the signed-in admin, never an id taken from the request body.
    const authorId = (req as AuthenticatedRequest).user?.id;

    const blog = await prisma.blog.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        coverImage,
        status: normalizeStatus(status),
        authorId,
        categoryId
      },
      include: {
        author: PUBLIC_PROFILE,
        category: true
      }
    });
    
    res.status(201).json({ success: true, data: blog });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllBlogs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, categoryId, authorId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    // Older rows were saved as "published"; match either case.
    if (typeof status === 'string' && status) where.status = { equals: status, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;
    if (authorId) where.authorId = authorId;
    
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          author: PUBLIC_PROFILE,
          category: true,
          _count: { select: { comments: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.blog.count({ where })
    ]);
    
    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch blogs' });
  }
};

export const getBlogById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const blog = await prisma.blog.findUnique({
      where: { id },
      include: {
        author: PUBLIC_PROFILE,
        category: true,
        comments: {
          where: { parentId: null },
          include: {
            user: PUBLIC_PROFILE,
            replies: {
              include: { user: PUBLIC_PROFILE }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }
    
    res.status(200).json({ success: true, data: blog });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBlogBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const blog = await prisma.blog.findUnique({
      where: { slug },
      include: {
        author: PUBLIC_PROFILE,
        category: true,
        comments: {
          where: { parentId: null },
          include: {
            user: PUBLIC_PROFILE,
            replies: {
              include: { user: PUBLIC_PROFILE }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }
    
    res.status(200).json({ success: true, data: blog });
  } catch (error :any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, slug, content, excerpt, coverImage, status, categoryId } = req.body;
    
    const blog = await prisma.blog.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        excerpt,
        coverImage,
        status: normalizeStatus(status),
        categoryId
      },
      include: {
        author: PUBLIC_PROFILE,
        category: true
      }
    });
    
    res.status(200).json({ success: true, data: blog });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Delete all comments first due to foreign key constraints
    await prisma.blogComment.deleteMany({
      where: { blogId: id }
    });
    
    await prisma.blog.delete({
      where: { id }
    });
    
    res.status(200).json({ success: true, message: 'Blog deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBlogsByCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where: { categoryId },
        skip,
        take: Number(limit),
        include: {
          author: PUBLIC_PROFILE,
          category: true,
          _count: { select: { comments: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.blog.count({ where: { categoryId } })
    ]);
    
    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBlogsByAuthor = async (req: Request, res: Response) => {
  try {
    const { authorId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where: { authorId },
        skip,
        take: Number(limit),
        include: {
          author: PUBLIC_PROFILE,
          category: true,
          _count: { select: { comments: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.blog.count({ where: { authorId } })
    ]);
    
    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Blog Comment Controllers
export const createBlogComment = async (req: Request, res: Response) => {
  try {
    const { blogId } = req.params;
    const { content, parentId } = req.body;
    const userId = (req as AuthenticatedRequest).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const text = typeof content === 'string' ? content.trim() : '';
    if (!text || text.length > 2000) {
      return res.status(400).json({ success: false, error: 'Comment must be between 1 and 2000 characters' });
    }

    const comment = await prisma.blogComment.create({
      data: {
        blogId,
        userId,
        content: text,
        parentId
      },
      include: {
        user: PUBLIC_PROFILE,
        parent: true
      }
    });
    
    res.status(201).json({ success: true, data: comment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBlogComments = async (req: Request, res: Response) => {
  try {
    const { blogId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const [comments, total] = await Promise.all([
      prisma.blogComment.findMany({
        where: { 
          blogId,
          parentId: null // Only get top-level comments
        },
        skip,
        take: Number(limit),
        include: {
          user: PUBLIC_PROFILE,
          replies: {
            include: {
              user: PUBLIC_PROFILE,
              replies: {
                include: { user: PUBLIC_PROFILE }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.blogComment.count({ 
        where: { 
          blogId,
          parentId: null 
        } 
      })
    ]);
    
    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateBlogComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const existingComment = await prisma.blogComment.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingComment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    if (existingComment.userId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    
    const comment = await prisma.blogComment.update({
      where: { id },
      data: { content },
      include: {
        user: PUBLIC_PROFILE,
        parent: true
      }
    });
    
    res.status(200).json({ success: true, data: comment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteBlogComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const existingComment = await prisma.blogComment.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingComment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    if (existingComment.userId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    
    // Delete all nested replies first
    const deleteReplies = async (commentId: string) => {
      const replies = await prisma.blogComment.findMany({
        where: { parentId: commentId },
        select: { id: true }
      });
      
      for (const reply of replies) {
        await deleteReplies(reply.id);
      }
      
      await prisma.blogComment.delete({
        where: { id: commentId }
      });
    };
    
    await deleteReplies(id);
    
    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCommentReplies = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const replies = await prisma.blogComment.findMany({
      where: { parentId: id },
      include: {
        user: PUBLIC_PROFILE,
        replies: {
          include: { user: PUBLIC_PROFILE }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    res.status(200).json({ success: true, data: replies });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
