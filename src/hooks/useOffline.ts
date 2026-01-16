import { useState, useEffect, useCallback, useRef } from 'react'; 
import { 
  syncOperations
} from '../lib/db';
import { useToastStore } from '../store/useStore';
import type { 
  OfflineAction,
  OfflineActionData,
  SyncStatus, 
  ConflictData,
  ConflictResolution,
  StorageUsage
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
  const syncInBackground = useCallback(async () => {
    if (!isOnline || syncStatus.isSyncing) return;

    window.dispatchEvent(new CustomEvent('sync:start'));

    try {
      const pendingOps = await syncOperations.getPendingOperations();
      
      for (const operation of pendingOps) {
        // Simulate sync operation (would be actual API calls)
        await new Promise(resolve => setTimeout(resolve, 100));
        await syncOperations.markAsSynced(operation.id);
      }

      window.dispatchEvent(new CustomEvent('sync:end'));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sync:error', { 
        detail: error instanceof Error ? error.message : 'Sync failed' 
      }));
    }
  }, [isOnline, syncStatus.isSyncing]);

  return { syncInBackground };
}

// Hook for image caching
export function useImageCache() {
  const cacheImage = useCallback(async (bookId: string, imageUrl: string): Promise<string | null> => {
    try {
      // For now, we'll store the original URL
      // In a full implementation, this would cache the image to IndexedDB
      return imageUrl;
    } catch (error) {
      console.error('Failed to cache image:', error);
      return null;
    }
  }, []);

  const getCachedImage = useCallback(async (_bookId: string): Promise<string | null> => {
    // Retrieve cached image path
    return null;
  }, []);

  return { cacheImage, getCachedImage };
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