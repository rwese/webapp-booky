import Dexie, { Table } from 'dexie';
import type { 
  Book, 
  Rating, 
  Tag, 
  BookTag, 
  Collection, 
  CollectionBook, 
  ReadingLog,
  UserSettings,
  SyncOperation,
  ReadingStatus
} from '../types';

// IndexedDB Database Setup with Dexie.js
class BookCollectionDB extends Dexie {
  // Tables declaration
  books!: Table<Book>;
  ratings!: Table<Rating>;
  tags!: Table<Tag>;
  bookTags!: Table<BookTag>;
  collections!: Table<Collection>;
  collectionBooks!: Table<CollectionBook>;
  readingLogs!: Table<ReadingLog>;
  syncQueue!: Table<SyncOperation>;
  settings!: Table<UserSettings>;

  constructor() {
    super('BookCollectionDB');
    
    // Define schema and indexes
    this.version(2).stores({
      books: 'id, title, isbn, isbn13, format, addedAt, [externalIds.openLibrary], [externalIds.googleBooks]',
      ratings: 'id, bookId, stars, updatedAt',
      tags: 'id, name, color',
      bookTags: '[bookId+tagId], bookId, tagId',
      collections: 'id, name, isSmart, createdAt, updatedAt',
      collectionBooks: '[collectionId+bookId], collectionId, bookId, order',
      readingLogs: 'id, bookId, status, startedAt, finishedAt, hidden',
      syncQueue: 'id, entity, entityId, timestamp, synced',
      settings: 'id'
    });
  }
}

// Singleton instance
export const db = new BookCollectionDB();

// Initialize database with default settings
export async function initializeDatabase() {
  try {
    // Check if settings exist
    const existingSettings = await db.settings.get('userSettings');
    
    if (!existingSettings) {
      // Add default settings
      await db.settings.put({
        id: 'userSettings',
        theme: 'system',
        defaultFormat: 'physical',
        ratingDisplay: 'stars',
        dateFormat: 'MM/dd/yyyy'
      } as UserSettings & { id: string });
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Utility functions for common database operations
export const bookOperations = {
  async getAll() {
    return await db.books.toArray();
  },
  
  async getById(id: string) {
    return await db.books.get(id);
  },
  
  async getByIsbn(isbn: string) {
    return await db.books.where('isbn').equals(isbn).first();
  },
  
  async getByIsbn13(isbn13: string) {
    return await db.books.where('isbn13').equals(isbn13).first();
  },
  
  async add(book: Book) {
    return await db.books.add(book);
  },
  
  async update(id: string, changes: Partial<Book>) {
    return await db.books.update(id, changes);
  },
  
  async delete(id: string) {
    return await db.books.delete(id);
  },
  
  async search(query: string) {
    const lowerQuery = query.toLowerCase();
    return await db.books
      .filter(book => 
        book.title.toLowerCase().includes(lowerQuery) ||
        book.authors.some(author => author.toLowerCase().includes(lowerQuery))
      )
      .toArray();
  }
};

export const ratingOperations = {
  async getByBookId(bookId: string) {
    return await db.ratings.where('bookId').equals(bookId).first();
  },
  
  async getByBookIds(bookIds: string[]) {
    return await db.ratings
      .filter(rating => bookIds.includes(rating.bookId))
      .toArray();
  },
  
  async upsert(rating: Rating) {
    const existing = await db.ratings.where('bookId').equals(rating.bookId).first();
    if (existing) {
      return await db.ratings.update(existing.id, rating);
    }
    return await db.ratings.add(rating);
  }
};

export const tagOperations = {
  async getAll() {
    return await db.tags.toArray();
  },
  
  async getById(id: string) {
    return await db.tags.get(id);
  },
  
  async add(tag: Tag) {
    return await db.tags.add(tag);
  },
  
  async update(id: string, changes: Partial<Tag>) {
    return await db.tags.update(id, changes);
  },
  
  async delete(id: string) {
    // Remove associations first
    await db.bookTags.where('tagId').equals(id).delete();
    return await db.tags.delete(id);
  },
  
  async getBookTags(bookId: string) {
    const bookTags = await db.bookTags.where('bookId').equals(bookId).toArray();
    const tagIds = bookTags.map(bt => bt.tagId);
    return await db.tags.where('id').anyOf(tagIds).toArray();
  },
  
  async addTagToBook(bookId: string, tagId: string) {
    const existing = await db.bookTags
      .where('[bookId+tagId]')
      .equals([bookId, tagId])
      .first();
    
    if (!existing) {
      return await db.bookTags.add({ bookId, tagId });
    }
  },
  
  async removeTagFromBook(bookId: string, tagId: string) {
    return await db.bookTags
      .where('[bookId+tagId]')
      .equals([bookId, tagId])
      .delete();
  }
};

export const collectionOperations = {
  async getAll() {
    return await db.collections.toArray();
  },
  
  async getById(id: string) {
    return await db.collections.get(id);
  },
  
  async add(collection: Collection) {
    return await db.collections.add(collection);
  },
  
  async update(id: string, changes: Partial<Collection>) {
    return await db.collections.update(id, changes);
  },
  
  async delete(id: string) {
    // Remove associations first
    await db.collectionBooks.where('collectionId').equals(id).delete();
    return await db.collections.delete(id);
  },
  
  async getBooksInCollection(collectionId: string) {
    const collectionBooks = await db.collectionBooks
      .where('collectionId')
      .equals(collectionId)
      .sortBy('order');
    
    const bookIds = collectionBooks.map(cb => cb.bookId);
    const books = await db.books.where('id').anyOf(bookIds).toArray();
    
    // Reorder books based on collection order
    const bookMap = new Map(books.map(book => [book.id, book]));
    return collectionBooks.map(cb => bookMap.get(cb.bookId)).filter(Boolean);
  },
  
  async addBookToCollection(collectionId: string, bookId: string) {
    const existing = await db.collectionBooks
      .where('[collectionId+bookId]')
      .equals([collectionId, bookId])
      .first();
    
    if (!existing) {
      // Get max order
      const collectionBooks = await db.collectionBooks
        .where('collectionId')
        .equals(collectionId)
        .toArray();
      
      const maxOrder = collectionBooks.reduce((max, cb) => Math.max(max, cb.order), 0);
      
      return await db.collectionBooks.add({
        collectionId,
        bookId,
        order: maxOrder + 1,
        addedAt: new Date()
      });
    }
  },
  
  async removeBookFromCollection(collectionId: string, bookId: string) {
    return await db.collectionBooks
      .where('[collectionId+bookId]')
      .equals([collectionId, bookId])
      .delete();
  },
  
  async reorderBooks(collectionId: string, bookIds: string[]) {
    const updates = bookIds.map((bookId, index) => 
      db.collectionBooks
        .where('[collectionId+bookId]')
        .equals([collectionId, bookId])
        .modify({ order: index })
    );
    
    await Promise.all(updates);
  }
};

export const readingLogOperations = {
  async getCurrentStatus(bookId: string) {
    return await db.readingLogs
      .where('bookId')
      .equals(bookId)
      .sortBy('createdAt')
      .then(logs => logs[logs.length - 1]);
  },
  
  async getHistory(bookId: string) {
    return await db.readingLogs
      .where('bookId')
      .equals(bookId)
      .sortBy('createdAt');
  },
  
  async getAllByStatus(status: string) {
    return await db.readingLogs
      .where('status')
      .equals(status)
      .toArray();
  },
  
  async logStatus(log: ReadingLog) {
    return await db.readingLogs.add(log);
  },
  
  async updateStatus(bookId: string, status: string, additionalData?: Partial<ReadingLog>) {
    const log: ReadingLog = {
      id: crypto.randomUUID(),
      bookId,
      status: status as ReadingStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
      hidden: false,
      ...additionalData
    };
    
    return await this.logStatus(log);
  },

  async softDelete(logId: string) {
    return await db.readingLogs.update(logId, { 
      hidden: true,
      updatedAt: new Date() 
    });
  },

  async restore(logId: string) {
    return await db.readingLogs.update(logId, { 
      hidden: false,
      updatedAt: new Date() 
    });
  },

  async getHiddenLogs() {
    return await db.readingLogs
      .filter(log => log.hidden === true)
      .toArray();
  }
};

export const syncOperations = {
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'synced'>) {
    return await db.syncQueue.add({
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      synced: false
    });
  },
  
  async getPendingOperations() {
    return await db.syncQueue
      .where('synced')
      .equals(0)
      .toArray();
  },
  
  async markAsSynced(id: string) {
    return await db.syncQueue.update(id, { synced: true });
  },
  
  async clearSyncedOperations() {
    return await db.syncQueue.where('synced').equals(1).delete();
  }
};

export const settingsOperations = {
  async get() {
    return await db.settings.get('userSettings');
  },
  
  async update(changes: Partial<UserSettings>) {
    const existing = await db.settings.get('userSettings');
    if (existing) {
      return await db.settings.update('userSettings', changes);
    }
    return await db.settings.put({ id: 'userSettings', ...changes } as UserSettings);
  }
};
