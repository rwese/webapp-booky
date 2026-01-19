import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const createReadingLogSchema = z.object({
  bookId: z.string(),
  status: z.enum(['want_to_read', 'currently_reading', 'read', 'dnf']),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  dnfReason: z.string().optional(),
});

const updateReadingLogSchema = createReadingLogSchema.partial();

// Get reading logs for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bookId, status } = req.query;

    const where: any = { userId: req.user!.userId };
    if (bookId) {
      where.bookId = String(bookId);
    }
    if (status) {
      where.status = String(status);
    }

    const logs = await prisma.readingLog.findMany({
      where,
      include: {
        book: {
          select: { id: true, title: true, coverUrl: true, authors: true, pageCount: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(logs.map((l: any) => ({
      ...l,
      book: {
        ...l.book,
        authors: l.book.authors ? JSON.parse(l.book.authors) : [],
      },
    })));
  } catch (error) {
    console.error('Get reading logs error:', error);
    res.status(500).json({ error: 'Failed to get reading logs' });
  }
});

// Create or update reading log
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createReadingLogSchema.parse(req.body);

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: { id: data.bookId, userId: req.user!.userId },
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const log = await prisma.readingLog.upsert({
      where: {
        userId_bookId: {
          userId: req.user!.userId,
          bookId: data.bookId,
        },
      },
      update: {
        status: data.status,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : undefined,
        dnfReason: data.dnfReason,
        updatedAt: new Date(),
      },
      create: {
        userId: req.user!.userId,
        bookId: data.bookId,
        status: data.status,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : undefined,
        dnfReason: data.dnfReason,
      },
    });

    res.status(201).json(log);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create reading log error:', error);
    res.status(500).json({ error: 'Failed to create reading log' });
  }
});

// Delete reading log
router.delete('/:bookId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.readingLog.deleteMany({
      where: {
        bookId: req.params.bookId,
        userId: req.user!.userId,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Reading log not found' });
    }

    res.json({ message: 'Reading log deleted successfully' });
  } catch (error) {
    console.error('Delete reading log error:', error);
    res.status(500).json({ error: 'Failed to delete reading log' });
  }
});

// Get reading statistics for user
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(String(year)) : new Date().getFullYear();

    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const logs = await prisma.readingLog.findMany({
      where: {
        userId: req.user!.userId,
        status: 'read',
        finishedAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      include: {
        book: {
          select: { id: true, pageCount: true },
        },
      },
    });

    const booksRead = logs.length;
    const totalPages = logs.reduce((sum: number, log: any) => sum + (log.book.pageCount || 0), 0);
    
    // Group by month
    const monthlyData: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) {
      monthlyData[i.toString()] = 0;
    }

    logs.forEach((log: any) => {
      if (log.finishedAt) {
        const month = (log.finishedAt.getMonth() + 1).toString();
        monthlyData[month]++;
      }
    });

    res.json({
      year: targetYear,
      booksRead,
      totalPages,
      monthlyData,
      averagePagesPerBook: booksRead > 0 ? Math.round(totalPages / booksRead) : 0,
    });
  } catch (error) {
    console.error('Get reading stats error:', error);
    res.status(500).json({ error: 'Failed to get reading statistics' });
  }
});

export default router;
