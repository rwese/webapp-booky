import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Extend PrismaClient to include models from our schema
export interface ExtendedPrismaClient extends PrismaClient {
  user: PrismaClient['user'];
  book: PrismaClient['book'];
  rating: PrismaClient['rating'];
  tag: PrismaClient['tag'];
  bookTag: PrismaClient['bookTag'];
  collection: PrismaClient['collection'];
  collectionBook: PrismaClient['collectionBook'];
  readingLog: PrismaClient['readingLog'];
  syncOperation: PrismaClient['syncOperation'];
  userSettings: PrismaClient['userSettings'];
  coverImage: PrismaClient['coverImage'];
}

// Create a singleton Prisma client
const createPrismaClient = (): ExtendedPrismaClient => {
  const client = new PrismaClient() as ExtendedPrismaClient;
  return client;
};

let prisma: ExtendedPrismaClient | null = null;

export const getPrismaClient = (): ExtendedPrismaClient => {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
};

// Initialize database connection
export async function initializeDatabase(): Promise<void> {
  const client = getPrismaClient();
  
  try {
    // Test connection
    await client.$connect();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// Book operations
export const bookService = {
  async getAll(userId: string) {
    const client = getPrismaClient();
    return client.book.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        ratings: true,
        bookTags: {
          include: { tag: true }
        },
        readingLogs: true
      }
    });
  },

  async getById(id: string) {
    const client = getPrismaClient();
    return client.book.findUnique({
      where: { id },
      include: {
        ratings: true,
        bookTags: {
          include: { tag: true }
        },
        readingLogs: true
      }
    });
  },

  async getByIsbn(isbn: string) {
    const client = getPrismaClient();
    return client.book.findFirst({
      where: { isbn13: isbn }
    });
  },

  async create(userId: string, data: any) {
    const client = getPrismaClient();
    return client.book.create({
      data: {
        ...data,
        userId,
        externalIds: data.externalIds || {},
        categories: data.categories || [],
        subjects: data.subjects || [],
        tags: data.tags || []
      }
    });
  },

  async update(id: string, changes: any) {
    const client = getPrismaClient();
    return client.book.update({
      where: { id },
      data: changes
    });
  },

  async delete(id: string) {
    const client = getPrismaClient();
    return client.book.delete({
      where: { id }
    });
  },

  async search(userId: string, query: string) {
    const client = getPrismaClient();
    const lowerQuery = query.toLowerCase();
    
    return client.book.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: lowerQuery, mode: 'insensitive' } },
          { authors: { hasSome: [lowerQuery] } }
        ]
      }
    });
  },

  async getByUserAndFormat(userId: string, format: string) {
    const client = getPrismaClient();
    return client.book.findMany({
      where: { userId, format },
      orderBy: { addedAt: 'desc' }
    });
  }
};

// Rating operations
export const ratingService = {
  async getByBookId(bookId: string) {
    const client = getPrismaClient();
    return client.rating.findFirst({
      where: { bookId }
    });
  },

  async getByBookIds(bookIds: string[]) {
    const client = getPrismaClient();
    return client.rating.findMany({
      where: { bookId: { in: bookIds } }
    });
  },

  async upsert(userId: string, data: any) {
    const client = getPrismaClient();
    
    const existing = await client.rating.findFirst({
      where: { 
        userId,
        bookId: data.bookId 
      }
    });

    if (existing) {
      return client.rating.update({
        where: { id: existing.id },
        data
      });
    }

    return client.rating.create({
      data: {
        ...data,
        userId
      }
    });
  },

  async delete(id: string) {
    const client = getPrismaClient();
    return client.rating.delete({
      where: { id }
    });
  }
};

// Tag operations
export const tagService = {
  async getAll(userId: string) {
    const client = getPrismaClient();
    return client.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' }
    });
  },

  async getById(id: string) {
    const client = getPrismaClient();
    return client.tag.findUnique({
      where: { id }
    });
  },

  async create(userId: string, data: any) {
    const client = getPrismaClient();
    return client.tag.create({
      data: {
        ...data,
        userId
      }
    });
  },

  async update(id: string, changes: any) {
    const client = getPrismaClient();
    return client.tag.update({
      where: { id },
      data: changes
    });
  },

  async delete(id: string) {
    const client = getPrismaClient();
    // BookTag entries will be cascade deleted due to relation
    return client.tag.delete({
      where: { id }
    });
  },

  async getBookTags(bookId: string) {
    const client = getPrismaClient();
    const bookTags = await client.bookTag.findMany({
      where: { bookId },
      include: { tag: true }
    });
    return bookTags.map((bt: any) => bt.tag);
  },

  async addTagToBook(bookId: string, tagId: string) {
    const client = getPrismaClient();
    
    const existing = await client.bookTag.findUnique({
      where: {
        bookId_tagId: { bookId, tagId }
      }
    });

    if (!existing) {
      return client.bookTag.create({
        data: { bookId, tagId }
      });
    }
    return existing;
  },

  async removeTagFromBook(bookId: string, tagId: string) {
    const client = getPrismaClient();
    return client.bookTag.delete({
      where: {
        bookId_tagId: { bookId, tagId }
      }
    });
  }
};

// Collection operations
export const collectionService = {
  async getAll(userId: string) {
    const client = getPrismaClient();
    return client.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        books: {
          include: { book: true },
          orderBy: { order: 'asc' }
        }
      }
    });
  },

  async getById(id: string) {
    const client = getPrismaClient();
    return client.collection.findUnique({
      where: { id },
      include: {
        books: {
          include: { book: true },
          orderBy: { order: 'asc' }
        }
      }
    });
  },

  async create(userId: string, data: any) {
    const client = getPrismaClient();
    return client.collection.create({
      data: {
        ...data,
        userId,
        smartRules: data.smartRules || []
      }
    });
  },

  async update(id: string, changes: any) {
    const client = getPrismaClient();
    return client.collection.update({
      where: { id },
      data: changes
    });
  },

  async delete(id: string) {
    const client = getPrismaClient();
    // CollectionBook entries will be cascade deleted
    return client.collection.delete({
      where: { id }
    });
  },

  async getBooksInCollection(collectionId: string) {
    const client = getPrismaClient();
    const collectionBooks = await client.collectionBook.findMany({
      where: { collectionId },
      orderBy: { order: 'asc' },
      include: { book: true }
    });
    return collectionBooks.map((cb: any) => cb.book);
  },

  async addBookToCollection(collectionId: string, bookId: string) {
    const client = getPrismaClient();
    
    const existing = await client.collectionBook.findUnique({
      where: {
        collectionId_bookId: { collectionId, bookId }
      }
    });

    if (!existing) {
      // Get max order
      const collectionBooks = await client.collectionBook.findMany({
        where: { collectionId }
      });
      
      const maxOrder = collectionBooks.reduce((max: number, cb: any) => Math.max(max, cb.order), 0);
      
      return client.collectionBook.create({
        data: {
          collectionId,
          bookId,
          order: maxOrder + 1
        }
      });
    }
    return existing;
  },

  async removeBookFromCollection(collectionId: string, bookId: string) {
    const client = getPrismaClient();
    return client.collectionBook.delete({
      where: {
        collectionId_bookId: { collectionId, bookId }
      }
    });
  },

  async reorderBooks(collectionId: string, bookIds: string[]) {
    const client = getPrismaClient();
    
    const updates = bookIds.map((bookId, index) => 
      client.collectionBook.updateMany({
        where: {
          collectionId,
          bookId
        },
        data: { order: index }
      })
    );

    await Promise.all(updates);
  }
};

// Sync operations
export const syncService = {
  async queueOperation(userId: string, operation: any) {
    const client = getPrismaClient();
    return client.syncOperation.create({
      data: {
        userId,
        ...operation,
        synced: false
      }
    });
  },

  async getPendingOperations(userId: string) {
    const client = getPrismaClient();
    return client.syncOperation.findMany({
      where: {
        userId,
        synced: false
      },
      orderBy: { timestamp: 'asc' }
    });
  },

  async markAsSynced(id: string) {
    const client = getPrismaClient();
    return client.syncOperation.update({
      where: { id },
      data: { synced: true }
    });
  },

  async clearSyncedOperations(userId: string) {
    const client = getPrismaClient();
    return client.syncOperation.deleteMany({
      where: {
        userId,
        synced: true
      }
    });
  }
};

// Settings operations
export const settingsService = {
  async get(userId: string) {
    const client = getPrismaClient();
    return client.userSettings.findUnique({
      where: { userId }
    });
  },

  async update(userId: string, changes: any) {
    const client = getPrismaClient();
    
    const existing = await client.userSettings.findUnique({
      where: { userId }
    });

    if (existing) {
      return client.userSettings.update({
        where: { userId },
        data: changes
      });
    }

    return client.userSettings.create({
      data: {
        userId,
        ...changes
      }
    });
  }
};

// Reading log operations
export const readingLogService = {
  async getAll(userId: string) {
    const client = getPrismaClient();
    return client.readingLog.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
  },

  async getByBookId(bookId: string) {
    const client = getPrismaClient();
    return client.readingLog.findFirst({
      where: { bookId }
    });
  },

  async getByBookIds(bookIds: string[]) {
    const client = getPrismaClient();
    return client.readingLog.findMany({
      where: { bookId: { in: bookIds } }
    });
  },

  async upsert(userId: string, data: any) {
    const client = getPrismaClient();
    
    const existing = await client.readingLog.findFirst({
      where: {
        userId,
        bookId: data.bookId
      }
    });

    if (existing) {
      return client.readingLog.update({
        where: { id: existing.id },
        data
      });
    }

    return client.readingLog.create({
      data: {
        ...data,
        userId
      }
    });
  },

  async deleteByBookId(bookId: string) {
    const client = getPrismaClient();
    return client.readingLog.deleteMany({
      where: { bookId }
    });
  },

  async getAllByStatus(userId: string, status: string) {
    const client = getPrismaClient();
    return client.readingLog.findMany({
      where: { userId, status },
      orderBy: { updatedAt: 'desc' }
    });
  }
};

// Cover image operations
export const coverImageService = {
  async store(userId: string, bookId: string | null, path: string, mimeType: string, size?: number) {
    const client = getPrismaClient();
    return client.coverImage.create({
      data: {
        userId,
        bookId,
        path,
        mimeType,
        size
      }
    });
  },

  async get(id: string) {
    const client = getPrismaClient();
    return client.coverImage.findUnique({
      where: { id }
    });
  },

  async delete(id: string) {
    const client = getPrismaClient();
    return client.coverImage.delete({
      where: { id }
    });
  },

  async getByBookId(bookId: string) {
    const client = getPrismaClient();
    return client.coverImage.findFirst({
      where: { bookId }
    });
  }
};

export default {
  initializeDatabase,
  closeDatabase,
  bookService,
  ratingService,
  tagService,
  collectionService,
  syncService,
  settingsService,
  readingLogService,
  coverImageService
};
