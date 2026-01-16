import { useCallback, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOnlineStatus } from './useOffline';
import { db, syncOperations, readingLogOperations } from '../lib/db';
import { syncService } from '../services/syncService';

// Enhanced hook for sync status with real-time updates
export function useSyncStatus() {
  const isOnline = useOnlineStatus();
  const pendingCount = useLiveQuery(
    () => db.syncQueue.where('synced').equals(0).count()
  );
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Subscribe to sync service for real-time updates
    const unsubscribe = syncService.subscribe((_online) => {
      // This will trigger re-render when online status changes
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await syncService.sync();
      if (result.success && result.synced) {
        setLastSync(new Date());
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  return {
    isOnline,
    pendingCount: pendingCount || 0,
    isSyncing,
    lastSync,
    syncNow
  };
}

// Enhanced hook for initiating sync with backend integration
export function useSync() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const syncData = useCallback(async () => {
    if (!isOnline) {
      console.log('Cannot sync: device is offline');
      return { success: false, error: 'Device is offline' };
    }
    
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      // Use the enhanced sync service
      const result = await syncService.sync();
      
      if (result.success) {
        return { 
          success: true, 
          message: (result.synced ?? 0) > 0 
            ? `Synced ${result.synced} operations` 
            : 'No pending operations',
          failed: result.failed
        };
      } else {
        setSyncError(result.reason || 'Sync failed');
        return { success: false, error: result.reason };
      }
    } catch (error) {
      const errorMessage = String(error);
      setSyncError(errorMessage);
      console.error('Sync failed:', error);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);
  
  const fullSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'Device is offline' };
    }
    
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await syncService.fullSync();
      
      if (result.success) {
        return { success: true, message: 'Full sync completed' };
      } else {
        setSyncError(result.reason || 'Full sync failed');
        return { success: false, error: result.reason };
      }
    } catch (error) {
      const errorMessage = String(error);
      setSyncError(errorMessage);
      console.error('Full sync failed:', error);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);
  
  return { syncData, fullSync, isOnline, isSyncing, syncError };
}

// Hook for queueing operations for sync
export function useQueueSync() {
  const queueOperation = useCallback(async (
    type: 'create' | 'update' | 'delete',
    entity: 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
    entityId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
  ) => {
    await syncOperations.queueOperation({
      type,
      entity,
      entityId,
      data
    });
  }, []);
  
  return { queueOperation };
}

// Hook for reading statistics
export function useReadingStats() {
  const currentlyReading = useLiveQuery(
    () => readingLogOperations.getAllByStatus('currently_reading')
  );
  
  const completedBooks = useLiveQuery(
    () => readingLogOperations.getAllByStatus('read')
  );
  
  const wantToReadBooks = useLiveQuery(
    () => readingLogOperations.getAllByStatus('want_to_read')
  );
  
  return {
    currentlyReading: currentlyReading || [],
    completedBooks: completedBooks || [],
    wantToReadBooks: wantToReadBooks || [],
    totalInProgress: (currentlyReading?.length || 0),
    totalCompleted: (completedBooks?.length || 0),
    totalWantToRead: (wantToReadBooks?.length || 0),
  };
}
