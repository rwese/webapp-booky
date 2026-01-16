/**
 * Books API Service
 * 
 * Integrates frontend with Booky backend for book CRUD operations.
 * Works with IndexedDB for offline-first functionality.
 */

import { authService } from './backendAuth';
import { db } from './db';
import type { Book, SyncOperation, Collection, Tag } from '../types';

const BACKEND_API = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

/**
 * Backend Books API
 */
export class BooksApiService {
  /**
   * Fetch all books for a user from backend
   */
  async fetchBooks(userId: string): Promise<Book[]> {
    return authService.authenticatedFetch<Book[]>(`${BACKEND_API}/books?userId=${userId}`);
  }

  /**
   * Fetch a single book by ID
   */
  async fetchBook(bookId: string): Promise<Book | null> {
    try {
      return await authService.authenticatedFetch<Book>(`${BACKEND_API}/books/${bookId}`);
    } catch {
      return null;
    }
  }

  /**
   * Create a new book
   */
  async createBook(book: Omit<Book, 'id' | 'addedAt' | 'needsSync' | 'localOnly'>): Promise<Book> {
    const response = await authService.authenticatedFetch<Book>(`${BACKEND_API}/books`, {
      method: 'POST',
      body: JSON.stringify(book),
    });
    return response;
  }

  /**
   * Update an existing book
   */
  async updateBook(bookId: string, changes: Partial<Book>): Promise<Book> {
    const response = await authService.authenticatedFetch<Book>(`${BACKEND_API}/books/${bookId}`, {
      method: 'PUT',
      body: JSON.stringify(changes),
    });
    return response;
  }

  /**
   * Delete a book
   */
  async deleteBook(bookId: string): Promise<void> {
    await authService.authenticatedFetch(`${BACKEND_API}/books/${bookId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Fetch collections for a user
   */
  async fetchCollections(userId: string): Promise<Collection[]> {
    return authService.authenticatedFetch<Collection[]>(`${BACKEND_API}/collections?userId=${userId}`);
  }

  /**
   * Create a collection
   */
  async createCollection(data: { name: string; description?: string; bookIds?: string[] }): Promise<Collection> {
    return authService.authenticatedFetch<Collection>(`${BACKEND_API}/collections`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Fetch tags for a user
   */
  async fetchTags(userId: string): Promise<Tag[]> {
    return authService.authenticatedFetch<Tag[]>(`${BACKEND_API}/tags?userId=${userId}`);
  }

  /**
   * Create a tag
   */
  async createTag(data: { name: string; color?: string }): Promise<Tag> {
    return authService.authenticatedFetch<Tag>(`${BACKEND_API}/tags`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// Export singleton instance
export const booksApi = new BooksApiService();

/**
 * Sync service that coordinates between IndexedDB and backend
 */
export class BooksSyncService {
  /**
   * Sync all pending changes to backend
   */
  async syncPendingChanges(_userId: string): Promise<{ success: boolean; synced: number; failed: number }> {
    try {
      // Get pending operations from IndexedDB
      const pendingOperations = await db.syncQueue
        .where('synced')
        .equals(0)
        .toArray();

      if (pendingOperations.length === 0) {
        return { success: true, synced: 0, failed: 0 };
      }

      // Process operations in batches
      const batchSize = 50;
      let synced = 0;
      let failed = 0;

      for (let i = 0; i < pendingOperations.length; i += batchSize) {
        const batch = pendingOperations.slice(i, i + batchSize);
        
        try {
          await authService.authenticatedFetch(`${BACKEND_API}/sync/operations`, {
            method: 'POST',
            body: JSON.stringify({ operations: batch }),
          });

          // Mark as synced
          await db.syncQueue.where('id').anyOf(batch.map((b: SyncOperation) => b.id)).modify({ synced: 1 });
          synced += batch.length;
        } catch (error) {
          console.error('Sync batch failed:', error);
          failed += batch.length;
        }
      }

      return { success: true, synced, failed };
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, synced: 0, failed: 0 };
    }
  }

  /**
   * Pull changes from backend since last sync
   */
  async pullChanges(userId: string, since: Date): Promise<{ success: boolean; changes: { books?: { created?: Book[]; updated?: Book[]; deleted?: string[] }; collections?: { created?: Collection[] }; tags?: { created?: Tag[] } } }> {
    try {
      const changes = await authService.authenticatedFetch<{ books?: { created?: Book[]; updated?: Book[]; deleted?: string[] }; collections?: { created?: Collection[] }; tags?: { created?: Tag[] } }>(
        `${BACKEND_API}/sync/changes?since=${since.toISOString()}`
      );
      return { success: true, changes };
    } catch (error) {
      console.error('Pull changes failed:', error);
      return { success: false, changes: {} };
    }
  }

  /**
   * Perform full sync - push local changes and pull remote changes
   */
  async fullSync(_userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all local data
      const localBooks = await db.books.toArray();
      const localCollections = await db.collections.toArray();
      const localTags = await db.tags.toArray();
      const localReadings = await db.readingLogs.toArray();
      const localSettings = await db.settings.get('userSettings');

      // Perform full sync
      const result = await authService.authenticatedFetch<{ success: boolean }>(`${BACKEND_API}/sync/full`, {
        method: 'POST',
        body: JSON.stringify({
          books: localBooks,
          collections: localCollections,
          tags: localTags,
          readings: localReadings,
          settings: localSettings,
        }),
      });

      if (result.success) {
        // Clear synced operations
        await db.syncQueue.where('synced').equals(1).delete();
        return { success: true };
      }

      return { success: false, error: 'Full sync failed' };
    } catch (error) {
      console.error('Full sync error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(_userId: string): Promise<{ isOnline: boolean; lastSyncTime: Date | null; pendingOperations: number; isSyncing: boolean; syncError: string | null }> {
    return authService.authenticatedFetch<{ isOnline: boolean; lastSyncTime: Date | null; pendingOperations: number; isSyncing: boolean; syncError: string | null }>(`${BACKEND_API}/sync/status`);
  }

  /**
   * Get pending operations count
   */
  async getPendingCount(): Promise<number> {
    return db.syncQueue.where('synced').equals(0).count();
  }
}

// Export singleton instance
export const booksSync = new BooksSyncService();

/**
 * Helper function to get auth header
 */
export function getAuthHeader(): Record<string, string> {
  const token = authService.getAccessToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

/**
 * Helper function for books API requests
 */
export async function booksApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return authService.authenticatedFetch<T>(`${BACKEND_API}${endpoint}`, options);
}
