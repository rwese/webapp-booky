import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  coverImage: z.string().url().optional().nullable(),
  isSmart: z.boolean().default(false),
  smartRules: z.array(z.object({
    field: z.enum(['rating', 'format', 'tags', 'status', 'year']),
    operator: z.enum(['equals', 'notEquals', 'greaterThan', 'lessThan', 'contains']),
    value: z.union([z.string(), z.number()]),
  })).optional(),
});

const updateCollectionSchema = createCollectionSchema.partial();
const addBookSchema = z.object({
  bookId: z.string(),
  order: z.number().optional(),
});

// Get all collections for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const collections = await prisma.collection.findMany({
      where: { userId: req.user!.userId },
      include: {
        _count: {
          select: { books: true },
        },
        books: {
          orderBy: { order: 'asc' },
          take: 3,
          include: { book: true },
        },
      } as any,
      orderBy: { name: 'asc' },
    });

    res.json(collections.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      coverImage: c.coverImage,
      isSmart: c.isSmart,
      smartRules: c.smartRules ? JSON.parse(c.smartRules) : null,
      bookCount: c._count.books,
      previewBooks: c.books.map((cb: any) => ({
        id: cb.book.id,
        title: cb.book.title,
        coverUrl: cb.book.coverUrl,
      })),
      createdAt: c.createdAt,
    })));
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Failed to get collections' });
  }
});

// Get single collection with books
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        books: {
          orderBy: { order: 'asc' },
          include: {
            book: {
              include: {
                tags: {
                  include: { tag: true },
                },
              },
            },
          },
        },
      } as any,
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImage: collection.coverImage,
      isSmart: collection.isSmart,
      smartRules: collection.smartRules ? JSON.parse(collection.smartRules) : null,
      books: collection.books.map((cb: any) => ({
        ...cb.book,
        authors: cb.book.authors ? JSON.parse(cb.book.authors) : [],
        tags: cb.book.tags.map((t: any) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
        order: cb.order,
        addedAt: cb.addedAt,
      })),
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ error: 'Failed to get collection' });
  }
});

// Create collection
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = createCollectionSchema.parse(req.body);

    const collection = await prisma.collection.create({
      data: {
        ...data,
        smartRules: data.smartRules ? JSON.stringify(data.smartRules) : null,
        userId: req.user!.userId,
      } as any,
    });

    res.status(201).json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImage: collection.coverImage,
      isSmart: collection.isSmart,
      smartRules: collection.smartRules ? JSON.parse(collection.smartRules) : null,
      bookCount: 0,
      createdAt: collection.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    const { Prisma } = await import('@prisma/client');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Collection with this name already exists' });
    }
    
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Update collection
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = updateCollectionSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.collection.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: {
        ...data,
        smartRules: data.smartRules ? JSON.stringify(data.smartRules) : undefined,
      },
    });

    res.json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverImage: collection.coverImage,
      isSmart: collection.isSmart,
      smartRules: collection.smartRules ? JSON.parse(collection.smartRules) : null,
      createdAt: collection.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update collection error:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// Delete collection
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.collection.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// Add book to collection
router.post('/:id/books', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = addBookSchema.parse(req.body);

    // Verify collection ownership
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: { id: data.bookId, userId: req.user!.userId },
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Get max order
    const maxOrder = await prisma.collectionBook.aggregate({
      where: { collectionId: req.params.id },
      _max: { order: true },
    });

    const collectionBook = await prisma.collectionBook.create({
      data: {
        collectionId: req.params.id,
        bookId: data.bookId,
        order: data.order ?? (maxOrder._max.order ?? -1) + 1,
      },
    });

    res.status(201).json({ message: 'Book added to collection', collectionBook });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    const { Prisma } = await import('@prisma/client');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Book already in this collection' });
    }
    
    console.error('Add book to collection error:', error);
    res.status(500).json({ error: 'Failed to add book to collection' });
  }
});

// Remove book from collection
router.delete('/:id/books/:bookId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await prisma.collectionBook.deleteMany({
      where: {
        collectionId: req.params.id,
        bookId: req.params.bookId,
        collection: { userId: req.user!.userId }, // Ensure user owns the collection
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Book not found in this collection' });
    }

    res.json({ message: 'Book removed from collection' });
  } catch (error) {
    console.error('Remove book from collection error:', error);
    res.status(500).json({ error: 'Failed to remove book from collection' });
  }
});

// Reorder books in collection
router.put('/:id/books/reorder', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bookOrders } = req.body; // Array of { bookId, order }

    if (!Array.isArray(bookOrders)) {
      return res.status(400).json({ error: 'bookOrders must be an array' });
    }

    // Verify collection ownership
    const collection = await prisma.collection.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Update all orders in a transaction
    await prisma.$transaction(
      bookOrders.map(({ bookId, order }: { bookId: string; order: number }) =>
        prisma.collectionBook.updateMany({
          where: { collectionId: req.params.id, bookId },
          data: { order },
        })
      )
    );

    res.json({ message: 'Books reordered successfully' });
  } catch (error) {
    console.error('Reorder books error:', error);
    res.status(500).json({ error: 'Failed to reorder books' });
  }
});

export default router;
