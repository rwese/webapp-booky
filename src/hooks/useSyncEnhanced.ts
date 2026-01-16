// Enhanced Sync Hooks - Real-time sync with backend integration
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { syncApi } from '../services/api';
import { db, syncOperations, bookOperations, collectionOperations, tagOperations, readingLogOperations } from '../lib/db';
import { useOnlineStatus } from './useOffline';
import { syncService } from '../services/syncService';
import type { ConflictData } from '../types';

// Hook for comprehensive sync status
export function useSyncStatus() {
  const isOnline = useOnlineStatus();
  const [syncState, setSyncState] = useState({
    isSyncing: false,
    lastSyncTime: null as Date | null,
    pendingOperations: 0,
    syncError: null as string | null,
    backendStatus: 'unknown' as 'unknown' | 'connected' | 'disconnected'
  });

  // Get pending operations count from IndexedDB
  const pendingCount = useLiveQuery(
    () => db.syncQueue.where('synced').equals(0).count(),
    [],
    0
  );

  // Fetch sync status from backend
  const fetchStatus = useCallback(async () => {
    if (!isOnline) {
      setSyncState(prev => ({ ...prev, backendStatus: 'disconnected' }));
      return;
    }

    try {
      const result = await syncApi.getStatus();
      if (result.success && result.status) {
        const status = result.status;
        setSyncState(prev => ({
          ...prev,
          lastSyncTime: status.lastSyncTime ? new Date(status.lastSyncTime) : prev.lastSyncTime,
          backendStatus: 'connected',
          pendingOperations: status.pendingOperations
        }));
      } else {
        setSyncState(prev => ({ ...prev, backendStatus: 'disconnected' }));
      }
    } catch {
      setSyncState(prev => ({ ...prev, backendStatus: 'disconnected' }));
    }
  }, [isOnline]);

  // Periodic status updates
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Sync now
  const syncNow = useCallback(async () => {
    if (!isOnline || syncState.isSyncing) return;
    
    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));
    
    try {
      const result = await syncService.sync();
      
      if (result.success) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date(),
          pendingOperations: 0
        }));
        return { success: true, synced: result.synced };
      } else {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          syncError: result.reason || 'Sync failed'
        }));
        return { success: false, error: result.reason };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, [isOnline, syncState.isSyncing]);

  // Full sync
  const fullSync = useCallback(async () => {
    if (!isOnline || syncState.isSyncing) return;
    
    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));
    
    try {
      const [books, collections, tags, readings] = await Promise.all([
        bookOperations.getAll(),
        collectionOperations.getAll(),
        tagOperations.getAll(),
        readingLogOperations.getAll()
      ]);
      
      const result = await syncApi.fullSync({ books, collections, tags, readings });
      
      if (result.success) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date(),
          pendingOperations: 0
        }));
        return { success: true };
      } else {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          syncError: result.error || 'Full sync failed'
        }));
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, [isOnline, syncState.isSyncing]);

  return {
    ...syncState,
    pendingCount,
    isOnline,
    syncNow,
    fullSync,
    refreshStatus: fetchStatus
  };
}

// Hook for conflict detection and resolution
export function useConflictResolution() {
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  // Resolve a conflict
  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'keep_local' | 'keep_server' | 'merge',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mergedData?: any
  ) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return false;

    setIsResolving(true);
    
    try {
      if (resolution === 'keep_local') {
        await syncOperations.queueOperation({
          type: 'update',
          entity: conflict.entity as 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
          entityId: conflict.entityId,
          data: conflict.localData
        });
      } else if (resolution === 'keep_server' && conflict.serverData) {
        const { entity, entityId, serverData } = conflict;
        if (entity === 'book') await bookOperations.update(entityId, serverData);
        else if (entity === 'collection') await collectionOperations.update(entityId, serverData);
        else if (entity === 'tag') await tagOperations.update(entityId, serverData);
      } else if (resolution === 'merge' && mergedData) {
        await syncOperations.queueOperation({
          type: 'update',
          entity: conflict.entity as 'book' | 'rating' | 'tag' | 'collection' | 'readingLog',
          entityId: conflict.entityId,
          data: mergedData
        });
      }

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
    isResolving,
    resolveConflict,
    clearConflicts: () => setConflicts([])
  };
}

// Hook for pull-based sync
export function usePullSync() {
  const [isPulling, setIsPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const lastPullTime = useRef<Date | null>(null);

  const pullChanges = useCallback(async () => {
    setIsPulling(true);
    setPullError(null);

    try {
      const timestamp = lastPullTime.current?.toISOString() || '1970-01-01T00:00:00Z';
      const result = await syncApi.pullChanges(timestamp);
      
      if (result.success && result.changes) {
        const { changes } = result;
        
        // Apply book changes
        if (changes.books) {
          for (const book of changes.books) {
            await bookOperations.update(book.id, book);
          }
        }

        // Apply collection changes
        if (changes.collections) {
          for (const collection of changes.collections) {
            await collectionOperations.update(collection.id, collection);
          }
        }

        // Apply tag changes
        if (changes.tags) {
          for (const tag of changes.tags) {
            await tagOperations.update(tag.id, tag);
          }
        }

        // Apply reading log changes
        if (changes.readings) {
          for (const reading of changes.readings) {
            await readingLogOperations.upsert(reading);
          }
        }

        // Handle deletions
        if (changes.deletedBookIds) {
          for (const id of changes.deletedBookIds) {
            await bookOperations.delete(id);
          }
        }

        if (changes.deletedCollectionIds) {
          for (const id of changes.deletedCollectionIds) {
            await collectionOperations.delete(id);
          }
        }

        if (changes.deletedTagIds) {
          for (const id of changes.deletedTagIds) {
            await tagOperations.delete(id);
          }
        }

        lastPullTime.current = new Date();
        return { success: true, changes: result.changes };
      } else {
        setPullError(result.error || 'Pull sync failed');
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPullError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsPulling(false);
    }
  }, []);

  return {
    isPulling,
    pullError,
    lastPullTime: lastPullTime.current,
    pullChanges
  };
}

// Hook for automatic background sync
export function useBackgroundSync() {
  const isOnline = useOnlineStatus();
  const { syncNow, isSyncing, syncError, pendingCount } = useSyncStatus();
  const { pullChanges, isPulling } = usePullSync();
  const syncIntervalRef = useRef<number | null>(null);
  const pullIntervalRef = useRef<number | null>(null);
  const isPullingRef = useRef(isPulling);
  
  // Keep ref in sync with state
  useEffect(() => {
    isPullingRef.current = isPulling;
  }, [isPulling]);

  const startAutoSync = useCallback((pushInterval = 60000, pullInterval = 300000) => {
    syncIntervalRef.current = window.setInterval(() => {
      if (isOnline && !isSyncing && pendingCount > 0) {
        syncNow();
      }
    }, pushInterval);

    pullIntervalRef.current = window.setInterval(() => {
      if (isOnline && !isPullingRef.current) {
        pullChanges();
      }
    }, pullInterval);
  }, [isOnline, isSyncing, pendingCount, syncNow, pullChanges]);

  const stopAutoSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (pullIntervalRef.current) {
      clearInterval(pullIntervalRef.current);
      pullIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
    return () => stopAutoSync();
  }, [isOnline, startAutoSync, stopAutoSync]);

  return {
    isOnline,
    isSyncing: isSyncing || isPulling,
    pendingCount,
    syncError,
    startAutoSync,
    stopAutoSync,
    triggerSync: syncNow,
    triggerPull: pullChanges
  };
}

// Hook for sync progress tracking
type SyncProgressPhase = 'idle' | 'pushing' | 'pulling' | 'resolving' | 'complete' | 'error';

interface SyncProgress {
  phase: SyncProgressPhase;
  total: number;
  current: number;
  message: string;
}

export function useSyncProgress() {
  const [progress, setProgress] = useState<SyncProgress>({
    phase: 'idle',
    total: 0,
    current: 0,
    message: ''
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateProgress = useCallback((phase: SyncProgressPhase, current: number, total: number, message = '') => {
    setProgress({ phase, current, total, message });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({ phase: 'idle', total: 0, current: 0, message: '' });
  }, []);

  return {
    progress,
    updateProgress,
    resetProgress,
    isInProgress: progress.phase !== 'idle' && progress.phase !== 'complete' && progress.phase !== 'error',
    percentage: progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  };
}
