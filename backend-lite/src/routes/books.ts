import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const createBookSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional(),
  authors: z.array(z.string()).min(1),
  isbn13: z.string().optional(),
  coverUrl: z.string().url().optional().nullable(),
  description: z.string().optional(),
  publisher: z.string().optional(),
  publishedYear: z.number().optional(),
  publishedDate: z.string().optional(),
  pageCount: z.number().optional(),
  format: z.string().default('physical'),
  genre: z.string().optional(),
  language: z.string().optional(),
  averageRating: z.number().min(0).max(5).optional(),
  categories: z.array(z.string()).optional(),
  subjects: z.array(z.string()).optional(),
  seriesName: z.string().optional(),
  seriesVolume: z.number().optional(),
});

const updateBookSchema = createBookSchema.partial();

// Helper to serialize JSON fields
function serializeBook(book: any) {
  return {
    ...book,
    authors: book.authors 
      ? (typeof book.authors === 'string' ? JSON.parse(book.authors) : book.authors)
      : [],
    categories: book.categories 
      ? (typeof book.categories === 'string' ? JSON.parse(book.categories) : book.categories)
      : [],
    subjects: book.subjects 
      ? (typeof book.subjects === 'string' ? JSON.parse(book.subjects) : book.subjects)
      : [],
    externalIds: book.externalIds 
      ? (typeof book.externalIds === 'string' ? JSON.parse(book.externalIds) : book.externalIds)
      : null,
  };
}

// Get all books for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      search, 
      format, 
      tag, 
      status,
      sortBy = 'addedAt', 
      sortOrder = 'desc',
      page = 1, 
      limit = 20 
    } = req.query;

    const where: any = { userId: req.user!.userId };

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: String(search) } },
        { subtitle: { contains: String(search) } },
        { authors: { contains: String(search) } },
      ];
    }

    // Format filter
    if (format) {
      where.format = String(format);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const orderBy: any = {};
    orderBy[String(sortBy)] = sortOrder;

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: {
          ratings: true,
          bookTags: {
            include: { tag: true },
          },
          readingLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          collectionBooks: {
            include: { collection: true },
          },
        } as any,
      }),
      prisma.book.count({ where }),
    ]);

    res.json({
      books: books.map((b: any) => ({
        ...serializeBook(b),
        tags: b.bookTags.map((t: any) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
        readingStatus: b.readingLogs[0]?.status || null,
        userRating: (b.ratings as any[]).find((r: any) => r.userId === req.user!.userId)?.stars || null,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Failed to get books' });
  }
});

// Get single book
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const book = await prisma.book.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        ratings: true,
        bookTags: {
          include: { tag: true },
        },
        readingLogs: {
          orderBy: { createdAt: 'desc' },
        },
        collectionBooks: {
          include: { collection: true },
        },
      } as any,
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json({
      ...serializeBook(book),
      tags: (book.bookTags as any[]).map((t: any) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
      readingLogs: book.readingLogs,
      userRating: (book.ratings as any[])[0]?.stars || null,
      collections: (book.collectionBooks as any[]).map((c: any) => ({ id: c.collection.id, name: c.collection.name })),
    });
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ error: 'Failed to get book' });
  }
});

// Create book
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createBookSchema.parse(req.body);

    const book = await prisma.book.create({
      data: {
        ...data,
        authors: JSON.stringify(data.authors),
        categories: data.categories ? JSON.stringify(data.categories) : null,
        subjects: data.subjects ? JSON.stringify(data.subjects) : null,
        userId: req.user!.userId,
      } as any,
    });

    res.status(201).json(serializeBook(book));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create book error:', error);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// Update book
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = updateBookSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.book.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        ...data,
        authors: data.authors ? JSON.stringify(data.authors) : undefined,
        categories: data.categories ? JSON.stringify(data.categories) : undefined,
        subjects: data.subjects ? JSON.stringify(data.subjects) : undefined,
      } as any,
    });

    res.json(serializeBook(book));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update book error:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Delete book
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.book.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

export default router;
