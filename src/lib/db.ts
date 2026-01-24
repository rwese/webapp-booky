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
  ReadingStatus,
  ReadingGoal
} from '../types';
import { 
  DATABASE_SCHEMA_VERSION,
  createUpgradeHandler,
  isVersionError,
  isDatabaseClosedError,
  isQuotaExceededError,
  checkDatabaseVersion,
  normalizeDatabaseVersion,
  logDatabaseVersionInfo
} from './db-migration';

// Cover image storage type
interface CoverImageRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: Date;
}

// IndexedDB Database Setup with Dexie.js
class BookCollectionDB extends Dexie {
  // Tables declaration
  books!: Table<Book>;
  ratings!: Table<Rating>;
  tags!: Table<Tag>;
  bookTags!: Table<BookTag>;
  collections!: Table<Collection>;
  collectionBooks!: Table<CollectionBook>;
  syncQueue!: Table<SyncOperation>;
  settings!: Table<UserSettings>;
  readingLogs!: Table<ReadingLog>;
  coverImages!: Table<CoverImageRecord>;
  readingGoals!: Table<ReadingGoal>;

  constructor() {
    super('BookCollectionDB');

    // Log version info for debugging
    logDatabaseVersionInfo('DB Constructor');

    // Define schema and indexes with proper upgrade handling
    // Version 4: Normalized schema after lending feature removal
    this.version(DATABASE_SCHEMA_VERSION).stores({
      books: 'id, isbn13, format, addedAt, title, [externalIds.openLibrary], [externalIds.googleBooks]',
      ratings: 'id, bookId, stars, updatedAt',
      tags: 'id, name',
      bookTags: '[bookId+tagId], bookId, tagId',
      collections: 'id, name, isSmart, createdAt, updatedAt',
      collectionBooks: '[collectionId+bookId], collectionId, bookId, order',
      syncQueue: 'id, entity, entityId, timestamp, synced, [priority+timestamp]',
      settings: 'id',
      readingLogs: 'id, bookId, status, createdAt',
      coverImages: 'id, createdAt',
      readingGoals: 'id, [type+year], [type+year+month], isActive'
    }).upgrade(createUpgradeHandler());
  }
}

// Singleton instance with lazy initialization and robust persistence
let dbInstance: BookCollectionDB | null = null;

// Track initialization promise to prevent concurrent initialization
let initPromise: Promise<{
  success: boolean;
  versionNormalized: boolean;
  error?: string;
  details?: {
    storedVersion: number | null;
    codeVersion: number;
    needsMigration: boolean;
  };
}> | null = null;

export function getDatabase(): BookCollectionDB {
  if (!dbInstance) {
    // Use lazy initialization with a simple check
    // The actual initialization happens in initializeDatabase()
    dbInstance = new BookCollectionDB();
  }
  return dbInstance;
}

// Re-export the singleton as 'db' for backward compatibility
export const db = getDatabase();

// Initialize database with version checking and normalization
// This must be called early in the app lifecycle
export async function initializeDatabase(): Promise<{
  success: boolean;
  versionNormalized: boolean;
  error?: string;
  details?: {
    storedVersion: number | null;
    codeVersion: number;
    needsMigration: boolean;
  };
}> {
  // Prevent multiple simultaneous initialization attempts
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Check database version compatibility
      const versionCheck = await checkDatabaseVersion();
      logDatabaseVersionInfo('initializeDatabase');

      if (!versionCheck.isValid) {
        console.warn('Database version issue detected:', versionCheck.error);

        // Attempt to normalize the version
        const normalizeResult = await normalizeDatabaseVersion();

        if (!normalizeResult.success) {
          // Provide user-friendly error message
          const errorMessage = versionCheck.error ||
            'Database version mismatch and normalization failed. Please try refreshing the page.';

          console.error('Database normalization failed:', errorMessage);
          return {
            success: false,
            versionNormalized: false,
            error: errorMessage,
            details: {
              storedVersion: versionCheck.storedVersion,
              codeVersion: versionCheck.codeVersion,
              needsMigration: versionCheck.needsMigration
            }
          };
        }

        // If normalization succeeded but requires reload
        if (normalizeResult.requiresReload) {
          return {
            success: true,
            versionNormalized: true,
            error: 'Database was upgraded. Please refresh the page to continue.',
            details: {
              storedVersion: versionCheck.storedVersion,
              codeVersion: versionCheck.codeVersion,
              needsMigration: true
            }
          };
        }

        return {
          success: true,
          versionNormalized: true,
          details: {
            storedVersion: versionCheck.storedVersion,
            codeVersion: versionCheck.codeVersion,
            needsMigration: versionCheck.needsMigration
          }
        };
      }

      // Ensure settings exist
      await ensureSettingsExist();

      return {
        success: true,
        versionNormalized: false,
        details: {
          storedVersion: versionCheck.storedVersion,
          codeVersion: versionCheck.codeVersion,
          needsMigration: versionCheck.needsMigration
        }
      };
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return {
        success: false,
        versionNormalized: false,
        error: error instanceof Error ? error.message : 'Unknown error during initialization',
      };
    }
  })();

  return initPromise;
}

// Helper function to ensure default settings exist
async function ensureSettingsExist(): Promise<void> {
  try {
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
      console.log('Default user settings created');
    }
  } catch (error) {
    console.error('Failed to ensure settings exist:', error);
    // Don't throw - settings are not critical for basic functionality
  }
}

// Utility functions for common database operations
export const bookOperations = {
  /**
   * Get all books with error handling for version mismatches
   */
  async getAll() {
    try {
      return await db.books.toArray();
    } catch (error) {
      // Handle version mismatch errors
      if (isVersionError(error) || isDatabaseClosedError(error)) {
        console.error('Database version error detected in getAll:', error);
        // Return empty array to allow graceful degradation
        // The application should handle initialization/recovery
        return [];
      }
      throw error;
    }
  },
  
  async getById(id: string) {
    try {
      return await db.books.get(id);
    } catch (error) {
      if (isVersionError(error) || isDatabaseClosedError(error)) {
        console.error('Database version error detected in getById:', error);
        return undefined;
      }
      throw error;
    }
  },
  
  async getByIsbn(isbn: string) {
    try {
      return await db.books.where('isbn13').equals(isbn).first();
    } catch (error) {
      if (isVersionError(error) || isDatabaseClosedError(error)) {
        return undefined;
      }
      throw error;
    }
  },
  
  async add(book: Book) {
    try {
      return await db.books.add(book);
    } catch (error) {
      if (isVersionError(error) || isDatabaseClosedError(error)) {
        throw new Error('Database is not available. Please refresh the page.');
      }
      if (isQuotaExceededError(error)) {
        throw new Error('Storage quota exceeded. Please delete some books or cover images to free up space.');
      }
      throw error;
    }
  },
  
  async update(id: string, changes: Partial<Book>) {
    try {
      return await db.books.update(id, changes);
    } catch (error) {
      if (isVersionError(error) || isDatabaseClosedError(error)) {
        throw new Error('Database is not available. Please refresh the page.');
      }
      throw error;
    }
  },
  
  async delete(id: string) {
    try {
      return await db.books.delete(id);
    } catch (error) {
      if (isVersionError(error) || isDatabaseClosedError(error)) {
        throw new Error('Database is not available. Please refresh the page.');
      }
      throw error;
    }
  },
  
  async search(query: string) {
    try {
      const lowerQuery = query.toLowerCase();
      return await db.books
        .filter(book => 
          book.title.toLowerCase().includes(lowerQuery) ||
          book.authors.some(author => author.toLowerCase().includes(lowerQuery))
        )
        .toArray();
    } catch (error) {
      if (isVersionError(error) || isDatabaseClosedError(error)) {
        return [];
      }
      throw error;
    }
  },

  /**
   * Get books with pagination support
   * Optimized for large libraries (10K+ books)
   */
  async getPaginated(options: {
    page?: number;
    limit?: number;
    sortField?: keyof Book;
    sortDirection?: 'asc' | 'desc';
    search?: string;
    formats?: string[];
    tagIds?: string[];
    status?: string;
  }) {
    const {
      page = 1,
      limit = 20,
      sortField = 'addedAt',
      sortDirection = 'desc',
      search,
      formats,
      tagIds
    } = options;

    // Build compound filter
    // let collection = db.books.toCollection();

    // Apply search filter using index if available
    if (search) {
      const lowerSearch = search.toLowerCase();
      // For search, we need to filter in memory as Dexie doesn't support array contains
      const allBooks = await db.books
        .filter(book => 
          book.title.toLowerCase().includes(lowerSearch) ||
          book.authors.some(author => author.toLowerCase().includes(lowerSearch))
        )
        .toArray();
      
      // Apply format filter
      let filtered = allBooks;
      if (formats && formats.length > 0) {
        filtered = filtered.filter(book => formats.includes(book.format));
      }
      
      // Apply tag filter
      if (tagIds && tagIds.length > 0) {
        const booksWithTags = await Promise.all(
          filtered.map(async (book) => {
            const bookTags = await tagOperations.getBookTags(book.id);
            return {
              book,
              hasMatchingTag: tagIds.some(tagId =>
                bookTags.some(bt => bt.id === tagId)
              )
            };
          })
        );
        filtered = booksWithTags
          .filter(({ hasMatchingTag }) => hasMatchingTag)
          .map(({ book }) => book);
      }
      
      // Sort and paginate
      filtered.sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        const aDate = aVal instanceof Date ? aVal.getTime() : aVal;
        const bDate = bVal instanceof Date ? bVal.getTime() : bVal;
        if (aDate < bDate) return sortDirection === 'asc' ? -1 : 1;
        if (aDate > bDate) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      
      const total = filtered.length;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);
      
      return {
        books: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // Non-search path with better indexing
    let query = db.books.orderBy(sortField);
    
    if (formats && formats.length > 0) {
      // For format filter, we need to filter in memory as well
      const allBooks = await query.toArray();
      let filtered = allBooks.filter(book => formats.includes(book.format));
      
      // Apply tag filter
      if (tagIds && tagIds.length > 0) {
        const booksWithTags = await Promise.all(
          filtered.map(async (book) => {
            const bookTags = await tagOperations.getBookTags(book.id);
            return {
              book,
              hasMatchingTag: tagIds.some(tagId =>
                bookTags.some(bt => bt.id === tagId)
              )
            };
          })
        );
        filtered = booksWithTags
          .filter(({ hasMatchingTag }) => hasMatchingTag)
          .map(({ book }) => book);
      }
      
      // Sort and paginate
      filtered.sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        const aDate = aVal instanceof Date ? aVal.getTime() : aVal;
        const bDate = bVal instanceof Date ? bVal.getTime() : bVal;
        if (aDate < bDate) return sortDirection === 'asc' ? -1 : 1;
        if (aDate > bDate) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      
      const total = filtered.length;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);
      
      return {
        books: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // Default: use Dexie's offset/limit
    const start = (page - 1) * limit;
    const count = await db.books.count();
    
    let books = await query
      .offset(start)
      .limit(limit)
      .toArray();
    
    // Reverse if descending (Dexie only supports ascending)
    if (sortDirection === 'desc') {
      books.reverse();
    }
    
    return {
      books,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  /**
   * Get book count with error handling for version mismatches
   */
   async getCount(options: {
     search?: string;
     formats?: string[];
     tagIds?: string[];
   }) {
     const { search, formats } = options;

     try {
       // tagIds is reserved for future use with join queries
       let count = await db.books.count();

       if (search) {
         const lowerSearch = search.toLowerCase();
         const allBooks = await db.books
           .filter(book =>
             book.title.toLowerCase().includes(lowerSearch) ||
             book.authors.some(author => author.toLowerCase().includes(lowerSearch))
           )
           .toArray();

         if (formats && formats.length > 0) {
           const filtered = allBooks.filter(book => formats.includes(book.format));
           count = filtered.length;
         } else {
           count = allBooks.length;
         }
       }

       return count;
     } catch (error) {
       if (isVersionError(error) || isDatabaseClosedError(error)) {
         return 0;
       }
       throw error;
     }
   },

  /**
   * Merge update: Apply partial book data to an existing book
   * Preserves immutable fields and handles array merging
   */
  async mergeUpdate(id: string, changes: Partial<Book>): Promise<void> {
    const existing = await db.books.get(id);
    if (!existing) {
      throw new Error(`Book with id ${id} not found`);
    }

    // Fields that should be treated as arrays and merged with deduplication
    const arrayFields: (keyof Book)[] = ['subjects', 'categories', 'authors'];

    // Build merged changes
    const mergedChanges: Partial<Book> = {};

    // Process each field in changes
    for (const [key, value] of Object.entries(changes)) {
      const field = key as keyof Book;

      // Skip immutable fields
      if (field === 'id' || field === 'addedAt' || field === 'localOnly') {
        continue;
      }

      // Handle array fields with merge and deduplication
      if (arrayFields.includes(field) && Array.isArray(value)) {
        const existingArray = (Array.isArray(existing[field]) ? existing[field] : []) as string[];
        const newArray = value as string[];
        // Merge and deduplicate
        const merged = [...new Set([...existingArray, ...newArray])];
        (mergedChanges as Record<string, unknown>)[field] = merged;
      }
      // Handle externalIds - merge with existing, prefer non-empty values
      else if (field === 'externalIds' && typeof value === 'object' && value !== null) {
        const existingIds = existing.externalIds || {};
        const newIds = value as Record<string, string | undefined>;
        mergedChanges.externalIds = {
          ...existingIds,
          ...Object.fromEntries(
            Object.entries(newIds).filter(([_, v]) => v !== undefined && v !== '')
          )
        };
      }
      // Handle cover URL - prefer localCoverPath if exists, otherwise use coverUrl
      else if (field === 'coverUrl' || field === 'localCoverPath') {
        // localCoverPath takes precedence over coverUrl
        if (field === 'localCoverPath' && value) {
          mergedChanges.localCoverPath = value as string;
          // If we have a local cover, we might want to keep the existing coverUrl
          if (!mergedChanges.coverUrl && existing.coverUrl) {
            mergedChanges.coverUrl = existing.coverUrl;
          }
        } else if (field === 'coverUrl' && value) {
          // Only set coverUrl if we don't have a local cover
          if (!existing.localCoverPath) {
            mergedChanges.coverUrl = value as string;
          }
        }
      }
      // All other fields - replace with new value
      else {
        (mergedChanges as Record<string, unknown>)[field] = value;
      }
    }

    // Always update sync flags
    mergedChanges.needsSync = true;
    mergedChanges.lastSyncedAt = undefined;

    // Preserve immutable fields explicitly
    mergedChanges.id = existing.id;
    mergedChanges.addedAt = existing.addedAt;
    mergedChanges.localOnly = existing.localOnly;

    // Perform the update
    await db.books.update(id, mergedChanges);

    // Queue sync operation
    await syncOperations.queueOperation({
      type: 'update',
      entity: 'book',
      entityId: id,
      data: mergedChanges,
      conflictResolution: 'merge'
    });
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
  },

  async getAllWithCount() {
    const tags = await db.tags.toArray();
    const bookTags = await db.bookTags.toArray();

    // Count books per tag
    const tagCounts = new Map<string, number>();
    for (const bt of bookTags) {
      tagCounts.set(bt.tagId, (tagCounts.get(bt.tagId) || 0) + 1);
    }

    // Combine tags with counts and sort alphabetically
    return tags
      .map(tag => ({
        ...tag,
        bookCount: tagCounts.get(tag.id) || 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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


export const syncOperations = {
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'synced'>) {
    return await db.syncQueue.add({
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      synced: false,
      retryCount: 0
    });
  },
  
  async getPendingOperations() {
    return await db.syncQueue
      .where('synced')
      .equals(0)
      .sortBy('timestamp');
  },
  
  async getPendingOperationsByPriority() {
    const pending = await db.syncQueue
      .where('synced')
      .equals(0)
      .toArray();
    
    // Sort by priority (higher first) then by timestamp (older first)
    return pending.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  },
  
  async markAsSynced(id: string) {
    return await db.syncQueue.update(id, { synced: true });
  },
  
  async markAsFailed(id: string, error: string) {
    const operation = await db.syncQueue.get(id);
    if (operation) {
      const newRetryCount = (operation.retryCount ?? 0) + 1;
      // Only retry if under max retry count
      if (newRetryCount <= 3) {
        return await db.syncQueue.update(id, { 
          retryCount: newRetryCount,
          lastError: error,
          synced: false // Keep unsynced for retry
        });
      } else {
        // Mark as failed after max retries
        return await db.syncQueue.update(id, { 
          retryCount: newRetryCount,
          lastError: error
        });
      }
    }
  },
  
  async incrementRetry(id: string) {
    const operation = await db.syncQueue.get(id);
    if (operation) {
      const newRetryCount = (operation.retryCount ?? 0) + 1;
      return await db.syncQueue.update(id, { retryCount: newRetryCount });
    }
  },
  
  async clearSyncedOperations() {
    return await db.syncQueue.where('synced').equals(1).delete();
  },
  
  async clearFailedOperations() {
    // Clear operations that have exceeded retry limit
    const failed = await db.syncQueue
      .filter(op => (op.retryCount ?? 0) > 3)
      .toArray();
    
    if (failed.length > 0) {
      const ids = failed.map(op => op.id);
      return await db.syncQueue.bulkDelete(ids);
    }
    return 0;
  },
  
  async getFailedOperations() {
    return await db.syncQueue
      .filter(op => (op.retryCount ?? 0) > 3)
      .toArray();
  },
  
  async getPendingCount() {
    return await db.syncQueue
      .where('synced')
      .equals(0)
      .count();
  },
  
  async retryOperation(id: string) {
    // Reset retry count and mark for sync
    return await db.syncQueue.update(id, { 
      retryCount: 0,
      lastError: undefined,
      synced: false 
    });
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

export const readingLogOperations = {
  async getAll(): Promise<ReadingLog[]> {
    return await db.readingLogs.toArray();
  },
  
  async getByBookId(bookId: string): Promise<ReadingLog | undefined> {
    return await db.readingLogs.where('bookId').equals(bookId).first();
  },
  
  async getByBookIds(bookIds: string[]): Promise<ReadingLog[]> {
    return await db.readingLogs
      .filter((rl: ReadingLog) => bookIds.includes(rl.bookId))
      .toArray();
  },
  
  async upsert(readingLog: ReadingLog): Promise<string> {
    const existing = await db.readingLogs.where('bookId').equals(readingLog.bookId).first();
    if (existing) {
      await db.readingLogs.update(existing.id, readingLog);
      return existing.id;
    }
    const id = await db.readingLogs.add(readingLog);
    return id as string;
  },
  
  async deleteByBookId(bookId: string): Promise<number> {
    return await db.readingLogs.where('bookId').equals(bookId).delete();
  },

  async getAllByStatus(status: ReadingStatus): Promise<ReadingLog[]> {
    return await db.readingLogs.where('status').equals(status).toArray();
  }
};

// Cover image operations for storing imported cover images
export const coverImageOperations = {
  async store(blob: Blob, id?: string): Promise<string> {
    const imageId = id || crypto.randomUUID();
    try {
      await db.coverImages.put({
        id: imageId,
        blob,
        mimeType: blob.type,
        createdAt: new Date()
      });
      return imageId;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        throw new Error('Storage quota exceeded. Please delete some cover images to free up space.');
      }
      throw error;
    }
  },

  async get(id: string): Promise<Blob | null> {
    const image = await db.coverImages.get(id);
    return image?.blob || null;
  },

  async getUrl(id: string): Promise<string | null> {
    const blob = await this.get(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  },

  async delete(id: string): Promise<void> {
    await db.coverImages.delete(id);
  },

  async clear(): Promise<void> {
    await db.coverImages.clear();
  }
};
