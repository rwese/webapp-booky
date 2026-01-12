/**
 * Batch Scanning Hook
 * 
 * Hook for managing batch scanning functionality with queue management.
 */

import { useState, useCallback } from 'react';
import { cleanISBN, ScanQueueItem, BatchScanState, defaultBatchScanConfig, BatchScanConfig } from '../lib/barcodeUtils';
import { bookOperations } from '../lib/db';

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

  // Function to lookup book by ISBN using Open Library and Google Books APIs
  const lookupBookByISBN = useCallback(async (isbn: string): Promise<any | null> => {
    try {
      // Dynamic import to avoid circular dependencies
      const { searchByISBN, searchGoogleBooksByISBN } = await import('../lib/api');
      
      // Try Open Library first, then Google Books as fallback
      let book = await searchByISBN(isbn);
      if (!book) {
        book = await searchGoogleBooksByISBN(isbn);
      }
      
      return book;
    } catch (error) {
      console.error('Error looking up book:', error);
      return null;
    }
  }, []);

  // Function to create book in database
  const createBookInDatabase = useCallback(async (bookData: any): Promise<boolean> => {
    try {
      // Check for duplicates in database
      const existingByIsbn = bookData.isbn ? await bookOperations.getByIsbn(bookData.isbn) : null;
      const existingByIsbn13 = bookData.isbn13 ? await bookOperations.getByIsbn13(bookData.isbn13) : null;
      
      if (existingByIsbn || existingByIsbn13) {
        return false; // Duplicate
      }
      
      await bookOperations.add(bookData);
      return true;
    } catch (error) {
      console.error('Error creating book:', error);
      return false;
    }
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
    let duplicates = 0;
    const pendingItems = state.queue.filter(item => item.status === 'pending');

    for (const item of pendingItems) {
      try {
        // Lookup book metadata
        const bookData = await lookupBookByISBN(item.isbn);

        if (bookData) {
          // Check if book already exists in database
          const existingByIsbn = bookData.isbn ? await bookOperations.getByIsbn(bookData.isbn) : null;
          const existingByIsbn13 = bookData.isbn13 ? await bookOperations.getByIsbn13(bookData.isbn13) : null;

          if (existingByIsbn || existingByIsbn13) {
            // Mark as duplicate
            setState(prev => ({
              ...prev,
              currentProgress: completed + 1,
              queue: prev.queue.map(q => 
                q.id === item.id ? { ...q, status: 'duplicate' } : q
              )
            }));
            duplicates++;
          } else {
            // Store book data and mark as success
            setState(prev => ({
              ...prev,
              currentProgress: completed + 1,
              queue: prev.queue.map(q => 
                q.id === item.id ? { 
                  ...q, 
                  status: 'success',
                  bookData: bookData
                } : q
              )
            }));
          }
        } else {
          // Book not found - mark as error
          setState(prev => ({
            ...prev,
            currentProgress: completed + 1,
            queue: prev.queue.map(q => 
              q.id === item.id ? { 
                ...q, 
                status: 'error',
                error: 'Book not found'
              } : q
            )
          }));
        }

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
      detail: { 
        total: pendingItems.length, 
        completed, 
        errors: errorCount,
        duplicates
      } 
    }));

  }, [state.queue, state.isProcessing, state.errors.length, lookupBookByISBN]);

  // Function to create books in database for successful lookups
  const createBooks = useCallback(async () => {
    if (state.isProcessing || state.queue.length === 0) return;

    const successItems = state.queue.filter(item => item.status === 'success' && item.bookData);
    if (successItems.length === 0) return;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentProgress: 0,
      totalItems: successItems.length,
      errors: []
    }));

    let created = 0;
    let duplicates = 0;
    let failed = 0;

    for (const item of successItems) {
      try {
        if (item.bookData) {
          const success = await createBookInDatabase(item.bookData);
          
          if (success) {
            created++;
            // Mark as created
            setState(prev => ({
              ...prev,
              currentProgress: created + duplicates + failed,
              queue: prev.queue.map(q => 
                q.id === item.id ? { ...q, status: 'created' } : q
              )
            }));
          } else {
            duplicates++;
            // Mark as duplicate
            setState(prev => ({
              ...prev,
              currentProgress: created + duplicates + failed,
              queue: prev.queue.map(q => 
                q.id === item.id ? { ...q, status: 'duplicate' } : q
              )
            }));
          }
        }
      } catch (error) {
        failed++;
        setState(prev => ({
          ...prev,
          queue: prev.queue.map(q => 
            q.id === item.id ? { 
              ...q, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Creation failed'
            } : q
          ),
          errors: [...prev.errors, `${item.isbn}: Creation failed`]
        }));
      }
    }

    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentProgress: created + duplicates + failed,
      totalItems: successItems.length
    }));

    // Emit completion event
    window.dispatchEvent(new CustomEvent('batch:created', { 
      detail: { 
        total: successItems.length, 
        created, 
        duplicates,
        failed: failed + state.errors.length
      } 
    }));

  }, [state.queue, state.isProcessing, state.errors.length, createBookInDatabase]);

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
    createBooks,
    retryItem
  };
}
