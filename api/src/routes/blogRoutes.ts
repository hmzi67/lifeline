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

const router = Router();

// Blog Category Routes
router.post('/categories', authenticate, authorize(['admin']), createBlogCategory);
router.get('/categories', getAllBlogCategories);
router.get('/categories/:id', getBlogCategoryById);
router.put('/categories/:id', authenticate, authorize(['admin']), updateBlogCategory);
router.delete('/categories/:id', authenticate, authorize(['admin']), deleteBlogCategory);

// Blog Routes
router.post('/', authenticate, authorize(['admin']), createBlog);
router.get('/', getAllBlogs);
router.get('/:id', getBlogById);
router.get('/slug/:slug', getBlogBySlug);
router.put('/:id', authenticate, authorize(['admin']), updateBlog);
router.delete('/:id', authenticate, authorize(['admin']), deleteBlog);
router.get('/category/:categoryId', getBlogsByCategory);
router.get('/author/:authorId', getBlogsByAuthor);

// Blog Comment Routes
router.post('/:blogId/comments', authenticate, createBlogComment);
router.get('/:blogId/comments', getBlogComments);
router.put('/comments/:id', authenticate, updateBlogComment);
router.delete('/comments/:id', authenticate, deleteBlogComment);
router.get('/comments/:id/replies', getCommentReplies);

export default router;
