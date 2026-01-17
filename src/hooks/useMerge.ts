import { useState, useCallback } from 'react';
import { useToastStore } from '../store/useStore';
import { bookOperations } from '../lib/db';
import { mergeBooks, getMergePreview, type MergeStrategy, type MergeAction } from '../lib/mergeUtils';
import type { Book } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseMergeReturn {
  // State
  isLoading: boolean;
  error: string | null;
  lastMergedBook: Book | null;

  // Actions
  merge: (existingBook: Book, fetchedBook: Book, strategy: MergeStrategy, fieldActions?: Record<string, MergeAction>) => Promise<Book>;
  previewMerge: (existingBook: Book, fetchedBook: Book) => ReturnType<typeof getMergePreview>;
  reset: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for handling book merge operations
 * Provides merge functionality with loading states, error handling, and toast notifications
 */
export function useMerge(): UseMergeReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMergedBook, setLastMergedBook] = useState<Book | null>(null);

  const { addToast } = useToastStore();

  /**
   * Preview a merge without executing it
   */
  const previewMerge = useCallback((existingBook: Book, fetchedBook: Book) => {
    return getMergePreview(existingBook, fetchedBook);
  }, []);

  /**
   * Execute a merge operation
   */
  const merge = useCallback(
    async (
      existingBook: Book,
      fetchedBook: Book,
      strategy: MergeStrategy,
      fieldActions?: Record<string, MergeAction>
    ): Promise<Book> => {
      setIsLoading(true);
      setError(null);

      try {
        // Create the merged book
        const mergedBook = mergeBooks(existingBook, fetchedBook, strategy, fieldActions);

        // Update the existing book in the database
        await bookOperations.update(existingBook.id, mergedBook);

        // Store the merged result
        setLastMergedBook(mergedBook);

        // Show success toast
        addToast({
          type: 'success',
          message: 'Book updated successfully',
        });

        return mergedBook;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to merge books';

        setError(errorMessage);

        // Show error toast
        addToast({
          type: 'error',
          message: errorMessage,
        });

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addToast]
  );

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setLastMergedBook(null);
  }, []);

  return {
    isLoading,
    error,
    lastMergedBook,
    merge,
    previewMerge,
    reset,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for merging books with selective strategy (field-by-field control)
 */
export function useSelectiveMerge() {
  const [fieldActions, setFieldActions] = useState<Record<string, MergeAction>>({});

  const { isLoading, error, lastMergedBook, merge, previewMerge, reset } = useMerge();

  const updateFieldAction = useCallback((field: string, action: MergeAction) => {
    setFieldActions((prev) => ({ ...prev, [field]: action }));
  }, []);

  const clearFieldActions = useCallback(() => {
    setFieldActions({});
  }, []);

  const executeMerge = useCallback(
    async (existingBook: Book, fetchedBook: Book) => {
      return merge(existingBook, fetchedBook, 'selective', fieldActions);
    },
    [merge, fieldActions]
  );

  const getPreview = useCallback(
    (existingBook: Book, fetchedBook: Book) => {
      const preview = previewMerge(existingBook, fetchedBook);
      // Update preview to reflect current field actions
      const updatedFields = preview.fields.map((field) => {
        const action = fieldActions[field.field] ?? 'keep-existing';
        return {
          ...field,
          // Keep the existing value if action is keep-existing
          resolvedValue: action === 'copy-fetched' ? field.fetched : field.existing,
        };
      });
      return { ...preview, fields: updatedFields };
    },
    [previewMerge, fieldActions]
  );

  return {
    isLoading,
    error,
    lastMergedBook,
    fieldActions,
    updateFieldAction,
    clearFieldActions,
    executeMerge,
    getPreview,
    reset,
  };
}

/**
 * Hook for quick merge operations (keep existing, keep fetched, or fill empty)
 */
export function useQuickMerge() {
  const { isLoading, error, lastMergedBook, merge, previewMerge, reset } = useMerge();

  const keepExisting = useCallback(
    async (existingBook: Book, fetchedBook: Book) => {
      return merge(existingBook, fetchedBook, 'keep-existing');
    },
    [merge]
  );

  const keepFetched = useCallback(
    async (existingBook: Book, fetchedBook: Book) => {
      return merge(existingBook, fetchedBook, 'keep-fetched');
    },
    [merge]
  );

  const fillEmpty = useCallback(
    async (existingBook: Book, fetchedBook: Book) => {
      return merge(existingBook, fetchedBook, 'fill-empty');
    },
    [merge]
  );

  return {
    isLoading,
    error,
    lastMergedBook,
    previewMerge,
    keepExisting,
    keepFetched,
    fillEmpty,
    reset,
  };
}
