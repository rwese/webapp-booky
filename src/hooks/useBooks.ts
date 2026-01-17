import { useLiveQuery } from 'dexie-react-hooks';
import { bookOperations, ratingOperations, tagOperations } from '../lib/db';
import type { Book, FilterConfig, SortConfig } from '../types';

// Hook for accessing all books with live queries
export function useBooks() {
  return useLiveQuery(() => bookOperations.getAll());
}


// Hook for accessing a single book by ID
export function useBook(id: string) {
  return useLiveQuery(() => bookOperations.getById(id), [id]);
}

// Hook for searching books
export function useSearchBooks(query: string) {
  return useLiveQuery(
    () => (query ? bookOperations.search(query) : bookOperations.getAll()),
    [query]
  );
}

// Hook for books with filters and sorting
export function useFilteredBooks(
  filters: FilterConfig,
  sortConfig: SortConfig
) {
  return useLiveQuery(async () => {
    let books = await bookOperations.getAll();

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      books = books.filter(book =>
        book.title.toLowerCase().includes(searchLower) ||
        book.authors.some(author => author.toLowerCase().includes(searchLower))
      );
    }

    // Apply tag filter
    if (filters.tags && filters.tags.length > 0) {
      // Get tags for all books first
      const booksWithTags = await Promise.all(
        books.map(async (book) => {
          const bookTags = await tagOperations.getBookTags(book.id);
          return {
            book,
            hasMatchingTag: filters.tags!.some(tagId =>
              bookTags.some(bt => bt.id === tagId)
            )
          };
        })
      );

      // Filter books that have at least one matching tag
      books = booksWithTags
        .filter(({ hasMatchingTag }) => hasMatchingTag)
        .map(({ book }) => book);
    }

    // Apply format filter
    if (filters.formats && filters.formats.length > 0) {
      books = books.filter(book => filters.formats!.includes(book.format));
    }

    // Apply sorting
    books.sort((a, b) => {
      const field = sortConfig.field as keyof Book;
      const aVal = a[field] ?? '';
      const bVal = b[field] ?? '';

      // Handle dates
      const aDate = aVal instanceof Date ? aVal.getTime() : aVal;
      const bDate = bVal instanceof Date ? bVal.getTime() : bVal;

      if (aDate < bDate) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aDate > bDate) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return books;
  }, [filters, sortConfig]);
}

// Hook for accessing ratings
export function useRating(bookId: string) {
  return useLiveQuery(
    () => ratingOperations.getByBookId(bookId),
    [bookId]
  );
}

// Hook for accessing ratings for multiple books
export function useRatings(bookIds: string[]) {
  return useLiveQuery(
    () => ratingOperations.getByBookIds(bookIds),
    [bookIds]
  );
}

// Hook for accessing all tags
export function useTags() {
  return useLiveQuery(() => tagOperations.getAll());
}

// Hook for accessing tags for a specific book
export function useBookTags(bookId: string) {
  return useLiveQuery(
    () => tagOperations.getBookTags(bookId),
    [bookId]
  );
}

// Import functionality
import { bookImportService } from '../lib/importService';
import type { ImportBookData, ImportProgress, ImportResult } from '../types';
import { useState, useCallback } from 'react';

// Hook for import progress and status
export function useBookImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0,
    current: 0,
    status: 'idle',
    errors: []
  });
  const [result, setResult] = useState<ImportResult | undefined>();

  const importBooks = useCallback(async (
    importData: ImportBookData[],
    options?: { skipDuplicates?: boolean }
  ) => {
    setIsImporting(true);
    setProgress({
      total: importData.length,
      current: 0,
      status: 'reading',
      errors: []
    });

    try {
      const importResult = await bookImportService.importBooks(importData, {
        skipDuplicates: options?.skipDuplicates ?? true,
        onProgress: setProgress
      });

      setResult(importResult);
      setProgress(prev => ({
        ...prev,
        status: 'completed',
        current: importData.length
      }));

      return importResult;
    } catch (error) {
      console.error('Import failed:', error);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        errors: [{ 
          bookId: 'unknown', 
          title: 'Import failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }]
      }));
      throw error;
    } finally {
      setIsImporting(false);
    }
  }, []);

  const resetImport = useCallback(() => {
    setIsImporting(false);
    setProgress({
      total: 0,
      current: 0,
      status: 'idle',
      errors: []
    });
    setResult(undefined);
  }, []);

  return {
    isImporting,
    progress,
    result,
    importBooks,
    resetImport
  };
}

// Preview import data
export async function previewImportData(importData: ImportBookData[]) {
  return await bookImportService.previewImport(importData);
}
