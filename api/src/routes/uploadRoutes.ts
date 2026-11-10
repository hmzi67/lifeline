import { NextFunction, Request, Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import authenticate from '../middleware/authenticate.js';
import {
  getMediaCategory,
  IMAGE_UPLOAD_MAX_BYTES,
  imageUpload,
  MEDIA_UPLOAD_MAX_BYTES,
  mediaUpload,
} from '../middleware/upload.js';
import { AuthenticatedRequest } from '../types/middlewareTypes.js';

const router = Router();

const isAdmin = (req: Request) => (req as AuthenticatedRequest).user?.role === 'admin';

// The mobile app uploads users' own photos (avatar, medicine, meals) here; admins upload content.
// shortcut: in-memory counter, per API process and reset on restart; move to a shared store
// (e.g. Redis) if the API ever runs as more than one instance.
const userUploadQuota = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.USER_UPLOAD_DAILY_LIMIT || 50),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.id || 'anonymous',
  skip: isAdmin,
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: 'Daily upload limit reached. Please try again tomorrow.' });
  },
});

router.post('/', authenticate, userUploadQuota, (req: Request, res: Response, _next: NextFunction) => {
  const admin = isAdmin(req);
  const upload = admin ? mediaUpload : imageUpload;
  const maxMb = (admin ? MEDIA_UPLOAD_MAX_BYTES : IMAGE_UPLOAD_MAX_BYTES) / (1024 * 1024);

  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum upload size is ${maxMb}MB.`
        : error.message;

      res.status(400).json({ success: false, message });
      return;
    }

    if (error) {
      res.status(400).json({ success: false, message: error.message || 'Failed to upload file' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const category = getMediaCategory(req.file.mimetype);
    const relativePath = `/uploads/${category}/${req.file.filename}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.status(201).json({
      success: true,
      data: {
        url: `${baseUrl}${relativePath}`,
        path: relativePath,
        filename: req.file.filename,
        type: category,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      message: 'File uploaded successfully',
    });
  });
});

export default router;
