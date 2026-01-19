import { useState, useEffect, useCallback, useRef } from 'react'; 
import { 
  syncOperations,
  coverImageOperations,
  db
} from '../lib/db';
import { useToastStore } from '../store/useStore';
import type { 
  OfflineAction,
  OfflineActionData,
  SyncStatus, 
  ConflictData,
  ConflictResolution,
  StorageUsage,
  SyncOperation,
  SyncOperationData
} from '../types';

// Hook for managing online/offline status with enhanced monitoring
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      window.dispatchEvent(new CustomEvent('app:online'));
    };

    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('app:offline'));
    };

    // Listen for network status changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for network changes (more comprehensive)
    if ('connection' in navigator) {
      // Network Information API - properly typed for browser compatibility
      const connection = (navigator as Navigator & { connection?: { addEventListener: (event: string, handler: () => void) => void; removeEventListener: (event: string, handler: () => void) => void } }).connection;
      const handleConnectionChange = () => {
        const online = navigator.onLine;
        setIsOnline(online);
        if (online) {
          window.dispatchEvent(new CustomEvent('app:online'));
        }
      };
      
      connection?.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection?.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Enhanced sync status hook
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    lastSyncTime: null,
    pendingOperations: 0,
    isSyncing: false,
    syncError: null
  });

  const isOnline = useOnlineStatus();

  useEffect(() => {
    const updateStatus = async () => {
      try {
        const pendingOps = await syncOperations.getPendingOperations();
        setStatus(prev => ({
          ...prev,
          isOnline,
          pendingOperations: pendingOps.length
        }));
      } catch (error) {
        console.error('Failed to update sync status:', error);
      }
    };

    updateStatus();

    // Listen for sync events
    const handleSyncStart = () => setStatus(prev => ({ ...prev, isSyncing: true }));
    const handleSyncEnd = () => setStatus(prev => ({ 
      ...prev, 
      isSyncing: false, 
      lastSyncTime: new Date() 
    }));
    const handleSyncError = (event: Event) => {
      const customEvent = event as CustomEvent<{error: string}>;
      setStatus(prev => ({ ...prev, syncError: customEvent.detail?.error || 'Sync failed' }));
    };

    window.addEventListener('sync:start', handleSyncStart);
    window.addEventListener('sync:end', handleSyncEnd);
    window.addEventListener('sync:error', handleSyncError);
    window.addEventListener('app:online', updateStatus);

    return () => {
      window.removeEventListener('sync:start', handleSyncStart);
      window.removeEventListener('sync:end', handleSyncEnd);
      window.removeEventListener('sync:error', handleSyncError);
      window.removeEventListener('app:online', updateStatus);
    };
  }, [isOnline]);

  return status;
}

// Hook for queueing offline operations
export function useOfflineQueue() {
  const queueOfflineAction = useCallback(async (
    type: OfflineAction['type'],
    entityId: string,
    data: OfflineActionData
  ) => {
    const action: OfflineAction = {
      id: crypto.randomUUID(),
      type,
      entityId,
      data,
      timestamp: new Date(),
      synced: false,
      retryCount: 0
    };

    await syncOperations.queueOperation({
      type: type.includes('delete') ? 'delete' : 
            type.includes('add') ? 'create' : 'update',
      entity: (type.split('_')[1] || 'book') as 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
      entityId,
      data
    });

    return action;
  }, []);

  const clearSyncedOperations = useCallback(async () => {
    await syncOperations.clearSyncedOperations();
  }, []);

  return {
    queueOfflineAction,
    clearSyncedOperations
  };
}

// Hook for conflict detection and resolution
export function useConflictResolution() {
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const detectConflict = useCallback(async (
    entity: string,
    entityId: string,
    localData: { updatedAt: Date },
    serverData?: { updatedAt: Date }
  ): Promise<ConflictData | null> => {
    // Check if there's a conflict based on timestamps
    if (serverData && localData.updatedAt > serverData.updatedAt) {
      return {
        id: crypto.randomUUID(),
        localData,
        serverData,
        localTimestamp: localData.updatedAt,
        serverTimestamp: serverData.updatedAt,
        entity,
        entityId
      };
    }
    return null;
  }, []);

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: ConflictResolution['resolution'],
    mergedData?: { updatedAt: Date }
  ) => {
    setIsResolving(true);
    try {
      const conflict = conflicts.find(c => c.id === conflictId);
      if (!conflict) return false;

      // Apply resolution
      if (resolution === 'keep_local') {
        // Keep local data, mark as needing sync
        await syncOperations.queueOperation({
          type: 'update',
          entity: conflict.entity as 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
          entityId: conflict.entityId,
          data: conflict.localData
        });
      } else if (resolution === 'keep_server' && conflict.serverData) {
        // Use server data, update local
        // This would involve actual server sync logic
      } else if (resolution === 'merge' && mergedData) {
        // Merge and sync
        await syncOperations.queueOperation({
          type: 'update',
          entity: conflict.entity as 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
          entityId: conflict.entityId,
          data: mergedData
        });
      }

      // Remove resolved conflict
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      return true;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    } finally {
      setIsResolving(false);
    }
  }, [conflicts]);

  return {
    conflicts,
    detectConflict,
    resolveConflict,
    isResolving
  };
}

// Hook for storage usage monitoring
export function useStorageUsage(): StorageUsage {
  const [usage, setUsage] = useState<StorageUsage>({
    totalSize: 0,
    imagesSize: 0,
    dataSize: 0,
    lastCleanup: new Date()
  });

  useEffect(() => {
    const checkStorage = async () => {
      try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const usage: StorageUsage = {
            totalSize: estimate.usage || 0,
            imagesSize: estimate.usage ? estimate.usage * 0.7 : 0, // Estimate 70% for images
            dataSize: estimate.usage ? estimate.usage * 0.3 : 0,  // Estimate 30% for data
            lastCleanup: new Date()
          };
          setUsage(usage);
        }
      } catch (error) {
        console.error('Failed to estimate storage:', error);
      }
    };

    checkStorage();
    
    // Update storage info periodically
    const interval = setInterval(checkStorage, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  return usage;
}

// Hook for background sync
export function useBackgroundSync() {
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const syncInBackground = useCallback(async () => {
    if (!isOnline || syncStatus.isSyncing) return;

    window.dispatchEvent(new CustomEvent('sync:start'));

    try {
      // Get operations sorted by priority
      const pendingOps = await syncOperations.getPendingOperationsByPriority();
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const operation of pendingOps) {
        try {
          // Simulate sync operation (would be actual API calls)
          // In a real implementation, this would call the backend API
          await new Promise(resolve => setTimeout(resolve, 50));
          
          await syncOperations.markAsSynced(operation.id);
          success++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await syncOperations.markAsFailed(operation.id, errorMessage);
          errors.push(`${operation.entity} ${operation.type}: ${errorMessage}`);
          failed++;
        }
      }

      setLastSyncResult({ success, failed, errors });
      window.dispatchEvent(new CustomEvent('sync:end'));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sync:error', { 
        detail: error instanceof Error ? error.message : 'Sync failed' 
      }));
    }
  }, [isOnline, syncStatus.isSyncing]);

  const retryFailedOperations = useCallback(async () => {
    const failedOps = await syncOperations.getFailedOperations();
    for (const op of failedOps) {
      await syncOperations.retryOperation(op.id);
    }
    // Trigger sync after retrying
    syncInBackground();
  }, [syncInBackground]);

  const clearFailedOperations = useCallback(async () => {
    return await syncOperations.clearFailedOperations();
  }, []);

  return { 
    syncInBackground, 
    retryFailedOperations,
    clearFailedOperations,
    lastSyncResult
  };
}

// Hook for image caching with IndexedDB storage
export function useImageCache() {
  const cacheImage = useCallback(async (bookId: string, imageUrl: string): Promise<string | null> => {
    try {
      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const blob = await response.blob();
      
      // Store in IndexedDB using coverImageOperations
      const imageId = await coverImageOperations.store(blob, `${bookId}-cover`);
      
      // Return the local blob URL
      const localUrl = await coverImageOperations.getUrl(imageId);
      return localUrl;
    } catch (error) {
      console.error('Failed to cache image:', error);
      return null;
    }
  }, []);

  const getCachedImage = useCallback(async (bookId: string): Promise<string | null> => {
    try {
      const imageId = `${bookId}-cover`;
      const localUrl = await coverImageOperations.getUrl(imageId);
      
      // Update last accessed time
      if (localUrl) {
        await coverImageOperations.get(imageId); // This would update lastAccessed in full implementation
      }
      
      return localUrl;
    } catch (error) {
      console.error('Failed to get cached image:', error);
      return null;
    }
  }, []);

  const deleteCachedImage = useCallback(async (bookId: string): Promise<void> => {
    try {
      const imageId = `${bookId}-cover`;
      await coverImageOperations.delete(imageId);
    } catch (error) {
      console.error('Failed to delete cached image:', error);
    }
  }, []);

  const clearImageCache = useCallback(async (): Promise<void> => {
    try {
      await coverImageOperations.clear();
    } catch (error) {
      console.error('Failed to clear image cache:', error);
    }
  }, []);

  const getImageCacheSize = useCallback(async (): Promise<number> => {
    try {
      const images = await db.coverImages.toArray();
      return images.reduce((total, img) => total + img.blob.size, 0);
    } catch (error) {
      console.error('Failed to get image cache size:', error);
      return 0;
    }
  }, []);

  return { 
    cacheImage, 
    getCachedImage, 
    deleteCachedImage, 
    clearImageCache,
    getImageCacheSize 
  };
}

// Hook for managing offline sync queue with full visibility
export function useOfflineSyncQueue() {
  const [queue, setQueue] = useState<SyncOperation[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const isOnline = useOnlineStatus();

  const refreshQueue = useCallback(async () => {
    try {
      const pending = await syncOperations.getPendingOperationsByPriority();
      const failed = await syncOperations.getFailedOperations();
      
      setQueue(pending);
      setFailedCount(failed.length);
    } catch (error) {
      console.error('Failed to refresh sync queue:', error);
    }
  }, []);

  useEffect(() => {
    refreshQueue();

    // Listen for sync events
    const handleSyncEnd = () => refreshQueue();
    const handleSyncStart = () => {};

    window.addEventListener('sync:end', handleSyncEnd);
    window.addEventListener('sync:start', handleSyncStart);

    return () => {
      window.removeEventListener('sync:end', handleSyncEnd);
      window.removeEventListener('sync:start', handleSyncStart);
    };
  }, [refreshQueue]);

  const retryOperation = useCallback(async (id: string) => {
    await syncOperations.retryOperation(id);
    await refreshQueue();
  }, [refreshQueue]);

  const clearOperation = useCallback(async (id: string) => {
    await syncOperations.markAsSynced(id);
    await refreshQueue();
  }, [refreshQueue]);

  const clearAllFailed = useCallback(async () => {
    await syncOperations.clearFailedOperations();
    await refreshQueue();
  }, [refreshQueue]);

  const queueOperation = useCallback(async (
    type: 'create' | 'update' | 'delete',
    entity: 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
    entityId: string,
    data: SyncOperationData,
    priority?: number
  ) => {
    await syncOperations.queueOperation({
      type,
      entity,
      entityId,
      data,
      priority
    });
    await refreshQueue();
  }, [refreshQueue]);

  return {
    queue,
    failedCount,
    isOnline,
    refreshQueue,
    retryOperation,
    clearOperation,
    clearAllFailed,
    queueOperation,
    totalCount: queue.length + failedCount
  };
}

// Hook for pull-to-refresh functionality
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - touchStartY.current;
    
    // Trigger refresh when pulled down more than 100px
    if (pullDistance > 100 && !isRefreshing) {
      setIsRefreshing(true);
      onRefresh().finally(() => setIsRefreshing(false));
    }
  }, [isRefreshing, onRefresh]);

  return {
    containerRef,
    handleTouchStart,
    handleTouchMove,
    isRefreshing
  };
}

// Hook for handling connectivity changes
export function useConnectivityHandler() {
  const isOnline = useOnlineStatus();
  const { syncInBackground } = useBackgroundSync();
  const { addToast } = useToastStore();
  const wasOffline = useRef(false);
  const lastNotificationTime = useRef(0);
  const hasPendingSync = useRef(false);

  useEffect(() => {
    // Check if there are pending operations to sync
    const checkPendingSync = async () => {
      try {
        const pendingOps = await syncOperations.getPendingOperations();
        hasPendingSync.current = pendingOps.length > 0;
      } catch {
        hasPendingSync.current = false;
      }
    };

    // Track offline/online transitions
    if (!isOnline) {
      wasOffline.current = true;
      checkPendingSync();
    } else if (wasOffline.current && isOnline) {
      // Only show notification when transitioning from offline to online
      // and only if there's actually something to sync
      const now = Date.now();
      const cooldown = 30000; // 30 seconds cooldown between notifications

      if (hasPendingSync.current && now - lastNotificationTime.current > cooldown) {
        // Show "back online" notification only if there are pending operations
        addToast({
          type: 'info',
          message: 'You\'re back online. Syncing your changes...',
          duration: 3000
        });
        
        lastNotificationTime.current = now;
        
        // Trigger background sync
        syncInBackground();
      }

      wasOffline.current = false;
    }
  }, [isOnline, syncInBackground, addToast]);

  return { isOnline };
}