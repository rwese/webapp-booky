// Sync Service - handles online/offline monitoring and sync operations
import { syncOperations } from '../lib/db';
import type { SyncOperation, SyncOperationData } from '../types';

const SYNC_INTERVAL = 30000; // 30 seconds
const BACKEND_API = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

class SyncService {
  private isOnline: boolean = navigator.onLine;
  private syncIntervalId: number | null = null;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    // Setup online/offline listeners
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline() {
    this.isOnline = true;
    this.notifyListeners(true);
    // Trigger sync when coming online
    this.sync();
  }

  private handleOffline() {
    this.isOnline = false;
    this.notifyListeners(false);
  }

  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => {
      listener(online);
    });
  }

  // Start automatic sync monitoring
  startMonitoring() {
    if (this.syncIntervalId) {
      return; // Already monitoring
    }

    this.syncIntervalId = window.setInterval(() => {
      if (this.isOnline) {
        this.sync();
      }
    }, SYNC_INTERVAL);
  }

  // Stop automatic sync monitoring
  stopMonitoring() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // Subscribe to online/offline changes
  subscribe(listener: (online: boolean) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get current online status
  getOnlineStatus() {
    return this.isOnline;
  }

  // Queue an operation for sync
  async queueOperation(
    entity: 'book' | 'rating' | 'tag' | 'collection' | 'readingLog', 
    entityId: string, 
    type: 'create' | 'update' | 'delete',
    data?: SyncOperationData | undefined
  ) {
    await syncOperations.queueOperation({
      entity,
      entityId,
      type,
      data: data ?? {}
    });

    // Try to sync immediately if online
    if (this.isOnline) {
      this.sync();
    }
  }

  // Process sync queue
  async sync() {
    if (!this.isOnline) {
      return { success: false, reason: 'offline' };
    }

    try {
      const pendingOperations = await syncOperations.getPendingOperations();
      
      if (pendingOperations.length === 0) {
        return { success: true, synced: 0 };
      }

      // Process operations in batches
      const batchSize = 10;
      const results = [];

      for (let i = 0; i < pendingOperations.length; i += batchSize) {
        const batch = pendingOperations.slice(i, i + batchSize);
        const batchResults = await this.syncBatch(batch);
        results.push(...batchResults);
      }

      // Mark successful operations as synced
      const successfulIds = results
        .filter(r => r.status === 'success')
        .map(r => r.id);

      for (const id of successfulIds) {
        await syncOperations.markAsSynced(id);
      }

      // Clean up old synced operations
      await syncOperations.clearSyncedOperations();

      const successCount = successfulIds.length;
      const failCount = results.length - successCount;

      return { 
        success: true, 
        synced: successCount, 
        failed: failCount,
        results 
      };

    } catch (error) {
      console.error('Sync failed:', error);
      return { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async syncBatch(operations: SyncOperation[]) {
    try {
      const response = await fetch(`${BACKEND_API}/sync/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operations })
      });

      if (!response.ok) {
        throw new Error('Sync batch failed');
      }

      return await response.json().then(data => data.results);
    } catch (error) {
      // If sync fails, mark all operations as failed (they'll be retried)
      return operations.map(op => ({
        id: op.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Network error'
      }));
    }
  }

  // Force full sync (replace all data)
  async fullSync() {
    if (!this.isOnline) {
      return { success: false, reason: 'offline' };
    }

    try {
      // Export all data from IndexedDB
      const { bookOperations, collectionOperations, tagOperations, readingLogOperations } = await import('../lib/db');
      
      const books = await bookOperations.getAll();
      const collections = await collectionOperations.getAll();
      const tags = await tagOperations.getAll();
      const readings = await readingLogOperations.getAllByStatus('currently_reading');

      const response = await fetch(`${BACKEND_API}/sync/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ books, collections, tags, readings })
      });

      if (!response.ok) {
        throw new Error('Full sync failed');
      }

      const result = await response.json();
      return { success: true, ...result };

    } catch (error) {
      console.error('Full sync failed:', error);
      return { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Get sync status
  async getStatus() {
    try {
      const pendingCount = (await syncOperations.getPendingOperations()).length;
      
      const response = await fetch(`${BACKEND_API}/sync/status`);
      const backendStatus = await response.json();

      return {
        isOnline: this.isOnline,
        pendingOperations: pendingCount,
        lastSync: backendStatus.lastSync,
        backendStatus: backendStatus.status
      };

    } catch (error) {
      return {
        isOnline: this.isOnline,
        pendingOperations: (await syncOperations.getPendingOperations()).length,
        lastSync: null,
        backendStatus: 'unavailable'
      };
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();