import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
});

const updateTagSchema = createTagSchema.partial();

// Get all tags for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.user!.userId },
      include: {
        _count: {
          select: { bookTags: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      bookCount: tag._count.bookTags,
      createdAt: tag.createdAt,
    })));
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

// Create tag
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createTagSchema.parse(req.body);

    const tag = await prisma.tag.create({
      data: {
        ...data,
        userId: req.user!.userId,
      } as any,
    });

    res.status(201).json({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      bookCount: 0,
      createdAt: tag.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    // Handle unique constraint violation
    const { Prisma } = await import('@prisma/client');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Tag with this name already exists' });
    }
    
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update tag
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = updateTagSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const tag = await prisma.tag.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update tag error:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete tag
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.tag.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// Add tag to book
router.post('/:tagId/books/:bookId', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Verify ownership of both
    const [tag, book] = await Promise.all([
      prisma.tag.findFirst({ where: { id: req.params.tagId, userId: req.user!.userId } }),
      prisma.book.findFirst({ where: { id: req.params.bookId, userId: req.user!.userId } }),
    ]);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const bookTag = await prisma.bookTag.create({
      data: {
        bookId: req.params.bookId,
        tagId: req.params.tagId,
      },
    });

    res.status(201).json({ message: 'Tag added to book', bookTag });
    } catch (error) {
    const PrismaClientKnownRequestError = ((await import('@prisma/client')).default as any).PrismaClientKnownRequestError ||
      (await import('@prisma/client')).Prisma?.PrismaClientKnownRequestError;
    if (error instanceof PrismaClientKnownRequestError && (error as any).code === 'P2002') {
      return res.status(400).json({ error: 'Tag already added to this book' });
    }
    console.error('Add tag to book error:', error);
    res.status(500).json({ error: 'Failed to add tag to book' });
  }
});

// Remove tag from book
router.delete('/:tagId/books/:bookId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.bookTag.deleteMany({
      where: {
        bookId: req.params.bookId,
        tagId: req.params.tagId,
        tag: { userId: req.user!.userId }, // Ensure user owns the tag
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Tag not found on this book' });
    }

    res.json({ message: 'Tag removed from book' });
  } catch (error) {
    console.error('Remove tag from book error:', error);
    res.status(500).json({ error: 'Failed to remove tag from book' });
  }
});

export default router;
