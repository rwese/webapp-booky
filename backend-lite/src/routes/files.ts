import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadCoverImage, deleteCoverImage, getCoverImagePath } from '../lib/fileStorage.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// ==================== COVER IMAGE UPLOADS ====================

// Upload cover image for a book
router.post('/cover/:bookId', authMiddleware, upload.single('cover'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { bookId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'No file uploaded'
      });
    }

    // Upload cover image
    const result = await uploadCoverImage(
      req.user.userId,
      bookId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'UPLOAD_FAILED',
        message: result.error
      });
    }

    res.status(201).json({
      success: true,
      coverUrl: result.coverUrl,
      file: result.file
    });
  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: 'Failed to upload cover image'
    });
  }
});

// Delete cover image for a book
router.delete('/cover/:bookId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { bookId } = req.params;

    const result = await deleteCoverImage(bookId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'DELETE_FAILED',
        message: result.error
      });
    }

    res.json({
      success: true,
      message: 'Cover image deleted successfully'
    });
  } catch (error) {
    console.error('Cover delete error:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: 'Failed to delete cover image'
    });
  }
});

// Get cover image info for a book
router.get('/cover/:bookId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { bookId } = req.params;

    const { getCoverImage } = await import('../lib/fileStorage.js');
    const metadata = await getCoverImage(bookId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Cover image not found'
      });
    }

    res.json({
      success: true,
      file: metadata,
      coverUrl: `/uploads/covers/${bookId}/${metadata.id}${metadata.mimeType.includes('png') ? '.png' : '.jpg'}`
    });
  } catch (error) {
    console.error('Get cover error:', error);
    res.status(500).json({
      success: false,
      error: 'GET_FAILED',
      message: 'Failed to get cover image'
    });
  }
});

export default router;
