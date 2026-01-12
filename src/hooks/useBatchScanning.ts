/**
 * Batch Scanning Hook
 * 
 * Hook for managing batch scanning functionality with queue management.
 */

import { useState, useCallback } from 'react';
import { cleanISBN, ScanQueueItem, BatchScanState, defaultBatchScanConfig, BatchScanConfig } from '../lib/barcodeUtils';

export function useBatchScanning(config?: Partial<BatchScanConfig>) {
  const [state, setState] = useState<BatchScanState>({
    queue: [],
    isProcessing: false,
    currentProgress: 0,
    totalItems: 0,
    errors: []
  });

  const [configState] = useState<BatchScanConfig>({
    ...defaultBatchScanConfig,
    ...config
  });

  const addToQueue = useCallback((isbn: string) => {
    const cleanedISBN = cleanISBN(isbn);
    
    // Check for duplicates
    const exists = state.queue.some(item => 
      item.isbn === cleanedISBN || item.isbn13 === cleanedISBN
    );

    if (exists) {
      window.dispatchEvent(new CustomEvent('batch:duplicate', { detail: isbn }));
      return false;
    }

    const item: ScanQueueItem = {
      id: crypto.randomUUID(),
      isbn: cleanedISBN,
      isbn13: cleanedISBN.length === 13 ? cleanedISBN : undefined,
      status: 'pending',
      scannedAt: new Date()
    };

    setState(prev => ({
      ...prev,
      queue: [...prev.queue, item]
    }));

    return true;
  }, [state.queue]);

  const removeFromQueue = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter(item => item.id !== id)
    }));
  }, []);

  const clearQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: [],
      errors: [],
      currentProgress: 0
    }));
  }, []);

  const processQueue = useCallback(async () => {
    if (state.isProcessing || state.queue.length === 0) return;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentProgress: 0,
      totalItems: prev.queue.length,
      errors: []
    }));

    let completed = 0;
    const pendingItems = state.queue.filter(item => item.status === 'pending');

    for (const item of pendingItems) {
      try {
        // Emit event for each book lookup
        window.dispatchEvent(new CustomEvent('book:lookup', { 
          detail: { isbn: item.isbn, isbn13: item.isbn13 } 
        }));

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update item status
        setState(prev => ({
          ...prev,
          currentProgress: completed + 1,
          queue: prev.queue.map(q => 
            q.id === item.id ? { ...q, status: 'success' } : q
          )
        }));

        completed++;
      } catch (error) {
        setState(prev => ({
          ...prev,
          queue: prev.queue.map(q => 
            q.id === item.id ? { 
              ...q, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Lookup failed'
            } : q
          ),
          errors: [...prev.errors, `${item.isbn}: Lookup failed`]
        }));
      }
    }

    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentProgress: completed,
      totalItems: pendingItems.length
    }));

    // Emit completion event
    const errorCount = state.errors.length;
    window.dispatchEvent(new CustomEvent('batch:complete', { 
      detail: { total: pendingItems.length, completed, errors: errorCount } 
    }));

  }, [state.queue, state.isProcessing, state.errors.length]);

  const retryItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.map(item => 
        item.id === id ? { ...item, status: 'pending', error: undefined } : item
      )
    }));
  }, []);

  return {
    state,
    config: configState,
    addToQueue,
    removeFromQueue,
    clearQueue,
    processQueue,
    retryItem
  };
}
