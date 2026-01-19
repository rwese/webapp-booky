import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const createRatingSchema = z.object({
  bookId: z.string(),
  stars: z.number().min(0.5).max(5).multipleOf(0.5),
  review: z.string().max(10000).optional(),
  containsSpoilers: z.boolean().default(false),
});

const updateRatingSchema = createRatingSchema.partial();

// Get all ratings for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.query;

    const where: any = { userId: req.user!.userId };
    if (bookId) {
      where.bookId = String(bookId);
    }

    const ratings = await prisma.rating.findMany({
      where,
      include: {
        book: {
          select: { id: true, title: true, coverUrl: true, authors: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(ratings.map((r: any) => ({
      ...r,
      book: {
        ...r.book,
        authors: r.book.authors ? JSON.parse(r.book.authors) : [],
      },
    })));
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// Create or update rating
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createRatingSchema.parse(req.body);

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: { id: data.bookId, userId: req.user!.userId },
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const rating = await prisma.rating.upsert({
      where: {
        userId_bookId: {
          userId: req.user!.userId,
          bookId: data.bookId,
        },
      },
      update: {
        stars: data.stars,
        review: data.review,
        containsSpoilers: data.containsSpoilers,
        updatedAt: new Date(),
      },
      create: {
        userId: req.user!.userId,
        bookId: data.bookId,
        stars: data.stars,
        review: data.review,
        containsSpoilers: data.containsSpoilers,
      },
    });

    res.status(201).json(rating);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create rating error:', error);
    res.status(500).json({ error: 'Failed to create rating' });
  }
});

// Delete rating
router.delete('/:bookId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.rating.deleteMany({
      where: {
        bookId: req.params.bookId,
        userId: req.user!.userId,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Rating not found' });
    }

    res.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

// Get rating statistics for user
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { userId: req.user!.userId },
    });

    if (ratings.length === 0) {
      return res.json({
        total: 0,
        average: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
    }

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;

    ratings.forEach((r: any) => {
      const stars = Math.round(r.stars);
      distribution[stars as keyof typeof distribution]++;
      total += r.stars;
    });

    res.json({
      total: ratings.length,
      average: Number((total / ratings.length).toFixed(2)),
      distribution,
    });
  } catch (error) {
    console.error('Get rating stats error:', error);
    res.status(500).json({ error: 'Failed to get rating statistics' });
  }
});

export default router;
