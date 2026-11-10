// routes/blog.routes.ts
import { Router } from 'express';
import {
  createBlogCategory,
  getAllBlogCategories,
  getBlogCategoryById,
  updateBlogCategory,
  deleteBlogCategory,
  createBlog,
  getAllBlogs,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  getBlogsByCategory,
  getBlogsByAuthor,
  createBlogComment,
  getBlogComments,
  updateBlogComment,
  deleteBlogComment,
  getCommentReplies
} from '../controllers/blogsController.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateBody } from '../middleware/validateRequest.js';
import { blogBody, blogCategoryBody, blogCommentBody } from '../validators/contentSchemas.js';

const router = Router();

// Blog Category Routes
router.post('/categories', authenticate, authorize(['admin']), validateBody(blogCategoryBody), createBlogCategory);
router.get('/categories', getAllBlogCategories);
router.get('/categories/:id', getBlogCategoryById);
router.put('/categories/:id', authenticate, authorize(['admin']), validateBody(blogCategoryBody), updateBlogCategory);
router.delete('/categories/:id', authenticate, authorize(['admin']), deleteBlogCategory);

// Blog Routes
router.post('/', authenticate, authorize(['admin']), validateBody(blogBody), createBlog);
router.get('/', getAllBlogs);
router.get('/:id', getBlogById);
router.get('/slug/:slug', getBlogBySlug);
router.put('/:id', authenticate, authorize(['admin']), validateBody(blogBody), updateBlog);
router.delete('/:id', authenticate, authorize(['admin']), deleteBlog);
router.get('/category/:categoryId', getBlogsByCategory);
router.get('/author/:authorId', getBlogsByAuthor);

// Blog Comment Routes
router.post('/:blogId/comments', authenticate, validateBody(blogCommentBody), createBlogComment);
router.get('/:blogId/comments', getBlogComments);
router.put('/comments/:id', authenticate, validateBody(blogCommentBody), updateBlogComment);
router.delete('/comments/:id', authenticate, deleteBlogComment);
router.get('/comments/:id/replies', getCommentReplies);

export default router;
