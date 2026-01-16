/**
 * Sync Service Integration
 * 
 * Coordinates data synchronization between IndexedDB (offline storage)
 * and the Booky backend (cloud storage).
 */

import { authService } from './backendAuth';
import { booksApi, booksSync } from './booksApi';
import { db } from './db';
import type { Book, SyncOperation, SyncStatus, UserSettings, Collection, Tag } from '../types';

// Settings interface for sync metadata
interface SyncSettings {
  id: string;
  lastSyncTime: Date | null;
  pendingCount: number;
}

/**
 * Sync Manager
 * 
 * Handles the complete sync lifecycle:
 * 1. Push local changes to backend
 * 2. Pull remote changes from backend
 * 3. Resolve conflicts
 * 4. Update local database
 */
export class SyncManager {
  private isSyncing = false;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  private lastSyncTime: Date | null = null;

  /**
   * Add sync status listener
   */
  addSyncListener(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  /**
   * Notify all listeners of sync status change
   */
  private notifyListeners(status: Partial<SyncStatus>): void {
    const fullStatus: SyncStatus = {
      isOnline: navigator.onLine,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: 0,
      isSyncing: this.isSyncing,
      syncError: null,
      ...status,
    };

    this.syncListeners.forEach(listener => {
      listener(fullStatus);
    });
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Queue a sync operation
   */
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'synced'>): Promise<void> {
    await db.syncQueue.add({
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      synced: false,
    } as SyncOperation);

    // Trigger sync if online
    if (this.isOnline()) {
      this.sync().catch(console.error);
    }
  }

  /**
   * Perform full synchronization
   */
  async sync(): Promise<{ success: boolean; error?: string }> {
    if (this.isSyncing) {
      return { success: true }; // Already syncing
    }

    if (!this.isOnline()) {
      return { success: false, error: 'No internet connection' };
    }

    this.isSyncing = true;
    this.notifyListeners({ isSyncing: true, lastSyncStatus: 'syncing' });

    try {
      const user = authService.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Step 1: Push local changes
      const pushResult = await booksSync.syncPendingChanges(user.id);
      if (!pushResult.success) {
        throw new Error('Failed to push local changes');
      }

      // Step 2: Pull remote changes
      const lastSync = this.lastSyncTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      const pullResult = await booksSync.pullChanges(user.id, lastSync);
      
      if (pullResult.success && pullResult.changes) {
        // Apply remote changes to local database
        await this.applyRemoteChanges(pullResult.changes);
      }

      // Step 3: Perform full sync if needed
      const fullSyncResult = await booksSync.fullSync(user.id);
      if (!fullSyncResult.success) {
        throw new Error(fullSyncResult.error || 'Full sync failed');
      }

      // Step 4: Update sync status
      const syncStatus = await booksSync.getSyncStatus(user.id);
      
      this.lastSyncTime = new Date();
      await db.settings.put({
        id: 'lastSync',
        lastSyncTime: this.lastSyncTime,
        pendingCount: syncStatus.pendingOperations || 0,
      } as unknown as UserSettings);

      this.isSyncing = false;
      this.notifyListeners({
        isSyncing: false,
        lastSyncTime: this.lastSyncTime,
        pendingOperations: syncStatus.pendingOperations || 0,
        lastSyncStatus: 'success',
      });

      return { success: true };
    } catch (error) {
      console.error('Sync error:', error);
      this.isSyncing = false;
      this.notifyListeners({
        isSyncing: false,
        lastSyncStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown sync error',
      });

      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Apply remote changes to local database
   */
  private async applyRemoteChanges(changes: { books?: { created?: Book[]; updated?: Book[]; deleted?: string[] }; collections?: { created?: Collection[] }; tags?: { created?: Tag[] } }): Promise<void> {
    if (!changes) return;

    // Apply book changes
    if (changes.books?.created) {
      for (const book of changes.books.created) {
        await db.books.put(book as Book);
      }
    }
    if (changes.books?.updated) {
      for (const book of changes.books.updated) {
        await db.books.put(book as Book);
      }
    }
    if (changes.books?.deleted) {
      for (const bookId of changes.books.deleted) {
        await db.books.delete(bookId);
      }
    }

    // Apply collection changes
    if (changes.collections?.created) {
      for (const collection of changes.collections.created) {
        await db.collections.put(collection);
      }
    }

    // Apply tag changes
    if (changes.tags?.created) {
      for (const tag of changes.tags.created) {
        await db.tags.put(tag);
      }
    }
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const pendingCount = await db.syncQueue.where('synced').equals(0).count();
    const settings = await db.settings.get('lastSync') as SyncSettings | undefined;
    
    return {
      isOnline: this.isOnline(),
      lastSyncTime: settings?.lastSyncTime || null,
      pendingOperations: pendingCount,
      isSyncing: this.isSyncing,
      syncError: null,
      lastSyncStatus: 'idle',
    };
  }

  /**
   * Force full resync
   */
  async forceResync(): Promise<{ success: boolean; error?: string }> {
    // Clear all local data and redownload from server
    const user = authService.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Get all books from server
      const remoteBooks = await booksApi.fetchBooks(user.id);
      
      // Clear local database
      await db.books.clear();
      await db.syncQueue.clear();
      
      // Import all remote books
      await db.books.bulkAdd(remoteBooks);
      
      // Trigger sync
      return await this.sync();
    } catch (error) {
      console.error('Force resync error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get pending operations count
   */
  async getPendingCount(): Promise<number> {
    return db.syncQueue.where('synced').equals(0).count();
  }
}

// Export singleton instance
export const syncManager = new SyncManager();

/**
 * Set up online/offline listeners
 */
export function setupOnlineListeners(): void {
  window.addEventListener('online', () => {
    syncManager['notifyListeners']({ isOnline: true });
    // Trigger sync when coming back online
    syncManager.sync().catch(console.error);
  });

  window.addEventListener('offline', () => {
    syncManager['notifyListeners']({ isOnline: false });
  });
}

/**
 * Auto-sync on page visibility
 */
export function setupVisibilityListener(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncManager.sync().catch(console.error);
    }
  });
}

/**
 * Initialize sync service
 */
export async function initializeSync(): Promise<void> {
  setupOnlineListeners();
  setupVisibilityListener();
  
  // Initial sync if online
  if (navigator.onLine) {
    syncManager.sync().catch(console.error);
  }
}

export default syncManager;
