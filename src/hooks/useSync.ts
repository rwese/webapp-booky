import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useOnlineStatus } from './useOffline';
import { db, syncOperations, readingLogOperations } from '../lib/db';

// Hook for sync status
export function useSyncStatus() {
  const isOnline = useOnlineStatus();
  const pendingCount = useLiveQuery(
    () => db.syncQueue.where('synced').equals(0).count()
  );
  
  return {
    isOnline,
    pendingCount: pendingCount || 0,
    isSyncing: false, // This would be updated by actual sync process
  };
}

// Hook for initiating sync
export function useSync() {
  const isOnline = useOnlineStatus();
  
  const syncData = useCallback(async () => {
    if (!isOnline) {
      console.log('Cannot sync: device is offline');
      return { success: false, error: 'Device is offline' };
    }
    
    try {
      // Get pending operations
      const pendingOperations = await syncOperations.getPendingOperations();
      
      if (pendingOperations.length === 0) {
        return { success: true, message: 'No pending operations' };
      }
      
      // Process each operation
      for (const operation of pendingOperations) {
        try {
          // In a real app, this would send to a server
          // For local-first, we might just mark as synced
          console.log('Syncing operation:', operation);
          
          await syncOperations.markAsSynced(operation.id);
        } catch (error) {
          console.error('Failed to sync operation:', operation, error);
        }
      }
      
      // Clean up synced operations
      await syncOperations.clearSyncedOperations();
      
      return { success: true, message: `Synced ${pendingOperations.length} operations` };
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, error: String(error) };
    }
  }, [isOnline]);
  
  return { syncData, isOnline };
}

// Hook for queueing operations for sync
export function useQueueSync() {
  const queueOperation = useCallback(async (
    type: 'create' | 'update' | 'delete',
    entity: 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
    entityId: string,
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
