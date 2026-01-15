/**
 * Sync Service
 * Handles offline-first synchronization with the backend
 */

import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'react-native-get-random-values';
import { apiService } from './api';
import { StorageService } from './storage';
import { SyncOperation, SyncStatus, OfflineAction, Book } from '../types';

type SyncEntity = 'book' | 'rating' | 'tag' | 'collection' | 'readingLog';

class SyncService {
  private syncInProgress = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL = 60000; // 1 minute

  constructor() {
    this.setupNetworkListener();
  }

  // =========================================================================
  // Network Detection
  // =========================================================================

  private setupNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        console.log('Network connected, triggering sync...');
        this.sync();
      }
    });
  }

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  // =========================================================================
  // Sync Operations Queue
  // =========================================================================

  async queueOperation(
    type: 'create' | 'update' | 'delete',
    entity: SyncEntity,
    entityId: string,
    data: unknown
  ): Promise<void> {
    const operation: SyncOperation = {
      id: uuidv4(),
      type,
      entity,
      entityId,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    await StorageService.addSyncOperation(operation);
    console.log(`Queued ${type} ${entity} operation:`, entityId);

    // Try to sync immediately if online
    if (await this.isOnline()) {
      await this.sync();
    }
  }

  // =========================================================================
  // Main Sync Function
  // =========================================================================

  async sync(): Promise<SyncStatus> {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return this.getSyncStatus();
    }

    this.syncInProgress = true;

    try {
      const isOnline = await this.isOnline();
      
      if (!isOnline) {
        console.log('Offline, cannot sync');
        return this.getSyncStatus();
      }

      console.log('Starting sync...');

      // 1. Push pending local changes
      await this.pushChanges();

      // 2. Fetch remote changes
      await this.pullChanges();

      // 3. Update last sync time
      const now = new Date().toISOString();
      await StorageService.setLastSyncTime(now);

      console.log('Sync completed successfully');
      return this.getSyncStatus();
    } catch (error) {
      console.error('Sync failed:', error);
      return this.getSyncStatus();
    } finally {
      this.syncInProgress = false;
    }
  }

  private async pushChanges(): Promise<void> {
    const operations = await StorageService.getSyncOperations();
    const pendingOperations = operations.filter(op => !op.synced);

    if (pendingOperations.length === 0) {
      console.log('No pending operations to push');
      return;
    }

    console.log(`Pushing ${pendingOperations.length} operations...`);

    try {
      const result = await apiService.pushChanges(pendingOperations);
      
      if (result.success && result.data) {
        // Mark operations as synced
        const syncedIds = new Set(result.data.map(op => op.id));
        const allOperations = await StorageService.getSyncOperations();
        
        const updatedOperations = allOperations.map(op => ({
          ...op,
          synced: syncedIds.has(op.id) ? true : op.synced,
        }));
        
        await StorageService.saveSyncOperations(updatedOperations);
        
        // Clear fully synced operations
        const stillPending = updatedOperations.filter(op => !op.synced);
        if (stillPending.length !== updatedOperations.length) {
          console.log(`${updatedOperations.length - stillPending.length} operations synced`);
        }
      }
    } catch (error) {
      console.error('Failed to push changes:', error);
      throw error;
    }
  }

  private async pullChanges(): Promise<void> {
    const lastSyncTime = await StorageService.getLastSyncTime();

    try {
      const result = await apiService.getPendingChanges(lastSyncTime ?? undefined);
      
      if (result.success && result.data && result.data.length > 0) {
        console.log(`Received ${result.data.length} changes from server`);
        
        for (const operation of result.data) {
          await this.applyRemoteOperation(operation);
        }
      }
    } catch (error) {
      console.error('Failed to pull changes:', error);
      throw error;
    }
  }

  private async applyRemoteOperation(operation: SyncOperation): Promise<void> {
    switch (operation.entity) {
      case 'book':
        await this.applyBookOperation(operation);
        break;
      case 'rating':
        // Handle rating operations
        break;
      case 'tag':
        // Handle tag operations
        break;
      case 'collection':
        // Handle collection operations
        break;
      case 'readingLog':
        // Handle reading log operations
        break;
    }
  }

  private async applyBookOperation(operation: SyncOperation): Promise<void> {
    const books = await StorageService.getBooks();
    
    switch (operation.type) {
      case 'create':
        // Check if book already exists (might have been created locally)
        const existingIndex = books.findIndex(b => b.id === operation.entityId);
        if (existingIndex === -1) {
          books.push(operation.data as Book);
        }
        break;
        
      case 'update':
        const updateIndex = books.findIndex(b => b.id === operation.entityId);
        if (updateIndex !== -1) {
          books[updateIndex] = { 
            ...books[updateIndex], 
            ...operation.data as Partial<Book>,
            needsSync: false,
            localOnly: false,
          };
        }
        break;
        
      case 'delete':
        const filtered = books.filter(b => b.id !== operation.entityId);
        // Replace array to trigger reactivity
        await StorageService.saveBooks(filtered);
        return;
    }
    
    await StorageService.saveBooks(books);
  }

  // =========================================================================
  // Status & Management
  // =========================================================================

  async getSyncStatus(): Promise<SyncStatus> {
    const operations = await StorageService.getSyncOperations();
    const pendingOperations = operations.filter(op => !op.synced);
    const lastSyncTime = await StorageService.getLastSyncTime();
    const isOnline = await this.isOnline();

    return {
      isOnline,
      lastSyncTime,
      pendingOperations: pendingOperations.length,
      isSyncing: this.syncInProgress,
      syncError: null,
    };
  }

  async markBookForSync(bookId: string): Promise<void> {
    await StorageService.updateBook(bookId, { needsSync: true });
  }

  async resolveConflict(bookId: string, keepServer: boolean): Promise<void> {
    if (keepServer) {
      // Get fresh data from server and replace local
      const result = await apiService.getBook(bookId);
      if (result.success) {
        await StorageService.updateBook(bookId, {
          ...result.data,
          needsSync: false,
          localOnly: false,
        });
      }
    } else {
      // Keep local, mark for sync
      await this.markBookForSync(bookId);
    }
  }

  // =========================================================================
  // Background Sync
  // =========================================================================

  startBackgroundSync(): void {
    if (this.syncInterval) {
      return;
    }

    console.log('Starting background sync...');
    this.syncInterval = setInterval(() => {
      this.sync();
    }, this.SYNC_INTERVAL);
  }

  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Background sync stopped');
    }
  }

  // =========================================================================
  // Force Sync
  // =========================================================================

  async forceSyncAllBooks(): Promise<void> {
    const books = await StorageService.getBooksNeedingSync();
    
    for (const book of books) {
      try {
        if (book.localOnly) {
          // Create new book on server
          const result = await apiService.createBook('current-user', book);
          if (result.success) {
            await StorageService.updateBook(book.id, {
              ...result.data,
              needsSync: false,
              localOnly: false,
            });
          }
        } else {
          // Update existing book
          const result = await apiService.updateBook(book.id, book);
          if (result.success) {
            await StorageService.updateBook(book.id, {
              ...result.data,
              needsSync: false,
            });
          }
        }
      } catch (error) {
        console.error(`Failed to sync book ${book.id}:`, error);
      }
    }
  }
}

export const syncService = new SyncService();
