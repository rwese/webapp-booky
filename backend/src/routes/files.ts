import { Router, Request, Response } from 'express';
import multer from 'multer';
import { 
  uploadCoverImage, 
  uploadFile, 
  deleteFile, 
  getFile, 
  getFileVariant,
  getStorageUsage,
  cleanupOrphanedFiles,
  validateFileUpload,
  initializeStorage
} from '../fileStorage';
import { authMiddleware } from '../authMiddleware';
import { searchRateLimiter } from '../security';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
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

// Initialize storage on module load
initializeStorage();

// ==================== COVER IMAGE UPLOADS ====================

// Upload cover image for a book
router.post('/cover/:bookId', authMiddleware, upload.single('cover'), async (req, res) => {
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

    // Validate file
    const validation = validateFileUpload(req.file.buffer, req.file.mimetype);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error
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
      message: 'Cover image uploaded successfully',
      file: result.file,
      variants: result.variants
    });

  } catch (error) {
    console.error('Error uploading cover image:', error);
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: 'Failed to upload cover image'
    });
  }
});

// Upload multiple cover images (bulk)
router.post('/covers/bulk', authMiddleware, upload.array('covers', 10), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'No files uploaded'
      });
    }

    const results = [];
    const errors = [];

    for (const file of files as Express.Multer.File[]) {
      const bookId = (req.body as any)[`bookId_${file.fieldname}`] || file.fieldname;
      
      // Validate file
      const validation = validateFileUpload(file.buffer, file.mimetype);
      if (!validation.valid) {
        errors.push({
          file: file.originalname,
          error: validation.error
        });
        continue;
      }

      // Upload cover image
      const result = await uploadCoverImage(
        req.user.userId,
        bookId,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      if (result.success) {
        results.push({
          bookId,
          file: result.file,
          variants: result.variants
        });
      } else {
        errors.push({
          bookId,
          file: file.originalname,
          error: result.error
        });
      }
    }

    res.status(201).json({
      success: true,
      uploaded: results.length,
      errors: errors.length,
      results,
      errorDetails: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error uploading bulk cover images:', error);
    res.status(500).json({
      success: false,
      error: 'BULK_UPLOAD_FAILED',
      message: 'Failed to process bulk upload'
    });
  }
});

// Delete cover image
router.delete('/cover/:bookId', authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { bookId } = req.params;

    // In a real implementation, you'd look up the file ID from the database
    // For now, we'll just try to delete based on the bookId
    const result = await deleteFile(bookId, req.user.userId);

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
    console.error('Error deleting cover image:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: 'Failed to delete cover image'
    });
  }
});

// ==================== FILE RETRIEVAL ====================

// Get cover image (original)
router.get('/cover/:bookId', async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { size } = req.query;

    let result: { buffer: Buffer | null; mimeType: string } | null = null;
    if (size && size !== 'original') {
      result = await getFileVariant(bookId, size as string);
    } else {
      result = await getFile(bookId);
    }

    if (!result || !result.buffer) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Cover image not found'
      });
    }

    res.set('Content-Type', result.mimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
    res.send(result.buffer);

  } catch (error) {
    console.error('Error retrieving cover image:', error);
    res.status(500).json({
      success: false,
      error: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve cover image'
    });
  }
});

// Get cover image variant
router.get('/cover/:bookId/:size', async (req, res) => {
  try {
    const { bookId, size } = req.params;

    // Validate size parameter
    const validSizes = ['thumbnail', 'small', 'medium', 'large'];
    if (!validSizes.includes(size)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SIZE',
        message: `Invalid size. Valid sizes: ${validSizes.join(', ')}`
      });
    }

    const result = await getFileVariant(bookId, size);

    if (!result || !result.buffer) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Cover image variant '${size}' not found`
      });
    }

    res.set('Content-Type', result.mimeType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
    res.send(result.buffer);

  } catch (error) {
    console.error('Error retrieving cover image variant:', error);
    res.status(500).json({
      success: false,
      error: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve cover image variant'
    });
  }
});

// ==================== IMPORT FILE UPLOADS ====================

// Upload import file (JSON, CSV, etc.)
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'No file uploaded'
      });
    }

    // Validate file
    const validation = validateFileUpload(req.file.buffer, req.file.mimetype, 50 * 1024 * 1024); // 50MB for imports
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error
      });
    }

    // Upload file
    const result = await uploadFile(
      req.user.userId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'import'
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
      message: 'Import file uploaded successfully',
      file: result.file
    });

  } catch (error) {
    console.error('Error uploading import file:', error);
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: 'Failed to upload import file'
    });
  }
});

// ==================== AVATAR UPLOADS ====================

// Upload user avatar
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'No file uploaded'
      });
    }

    // Validate file
    const validation = validateFileUpload(req.file.buffer, req.file.mimetype);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error
      });
    }

    // Upload avatar
    const result = await uploadFile(
      req.user.userId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'avatar',
      req.user.userId
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
      message: 'Avatar uploaded successfully',
      file: result.file
    });

  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: 'Failed to upload avatar'
    });
  }
});

// ==================== STORAGE MANAGEMENT ====================

// Get storage usage for current user
router.get('/usage', authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const usage = await getStorageUsage(req.user.userId);

    res.json({
      success: true,
      usage
    });

  } catch (error) {
    console.error('Error getting storage usage:', error);
    res.status(500).json({
      success: false,
      error: 'USAGE_CHECK_FAILED',
      message: 'Failed to get storage usage'
    });
  }
});

// Get overall storage statistics (admin only in production)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const storageModule = await import('../fileStorage');
    const stats = await storageModule.getStorageStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({
      success: false,
      error: 'STATS_FAILED',
      message: 'Failed to get storage statistics'
    });
  }
});

// Cleanup orphaned files (admin only in production)
router.post('/cleanup', authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // In production, you'd want admin authentication for this
    const result = await cleanupOrphanedFiles();

    res.json({
      success: true,
      message: 'Cleanup completed',
      cleaned: result.cleaned,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error('Error cleaning up orphaned files:', error);
    res.status(500).json({
      success: false,
      error: 'CLEANUP_FAILED',
      message: 'Failed to clean up orphaned files'
    });
  }
});

export default router;
