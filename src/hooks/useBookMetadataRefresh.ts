/**
 * Book Metadata Refresh Hook
 *
 * Hook for refreshing book metadata from external sources while preserving
 * local user data like reading status, tags, collections, and ratings.
 */

import { useState, useCallback } from 'react';
import {
  searchByISBN,
  searchGoogleBooksByISBN,
  isbnLookupSources
} from '../lib/api';
import type { Book } from '../types';

/**
 * Fields that can be refreshed from external sources
 */
const REFRESHABLE_FIELDS = [
  'title',
  'authors',
  'description',
  'coverUrl',
  'publisher',
  'publishedYear',
  'pageCount',
  'categories',
  'subjects',
  'averageRating',
  'ratingsCount',
  'externalIds'
] as const;

/**
 * Error types for better error handling
 */
export type MetadataErrorType = 
  | 'isbn_required'
  | 'no_results'
  | 'api_error'
  | 'network_error'
  | 'rate_limit'
  | 'unknown';

interface MetadataError {
  type: MetadataErrorType;
  message: string;
  source?: string;
  retryable: boolean;
}

/**
 * Return type for the useBookMetadataRefresh hook
 */
interface UseBookMetadataRefreshReturn {
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Any error that occurred during refresh */
  error: MetadataError | null;
  /** The last successfully refreshed book data (with only refreshable fields) */
  lastRefreshedData: Partial<Book> | null;
  /** Function to trigger metadata refresh */
  refreshMetadata: (bookId: string, isbn: string) => Promise<Partial<Book> | null>;
  /** Clear the error state */
  clearError: () => void;
  /** Clear the last refreshed data */
  clearLastRefreshedData: () => void;
}

/**
 * Hook for refreshing book metadata from external sources
 *
 * @example
 * ```tsx
 * const { isRefreshing, error, refreshMetadata, lastRefreshedData } = useBookMetadataRefresh();
 *
 * const handleRefresh = async () => {
 *   const metadata = await refreshMetadata(book.id, book.isbn13);
 *   if (metadata) {
 *     // Update book with new metadata
 *     updateBook({ ...book, ...metadata });
 *   }
 * };
 * ```
 */
export function useBookMetadataRefresh(): UseBookMetadataRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<MetadataError | null>(null);
  const [lastRefreshedData, setLastRefreshedData] = useState<Partial<Book> | null>(null);

  /**
   * Extract only refreshable fields from the source book data
   */
  const extractRefreshableFields = useCallback((sourceBook: Book): Partial<Book> => {
    const extracted: Partial<Book> = {};

    for (const field of REFRESHABLE_FIELDS) {
      if (field in sourceBook && sourceBook[field as keyof Book] !== undefined) {
        (extracted as any)[field] = sourceBook[field as keyof Book];
      }
    }

    return extracted;
  }, []);

  /**
   * Merge source metadata with existing local fields that should be preserved
   */
  const mergeWithPreservedFields = useCallback(
    (sourceBook: Book, _existingBook: Book): Partial<Book> => {
      // Extract only the refreshable fields from the source
      const refreshableData = extractRefreshableFields(sourceBook);

      // The hook returns only the refreshable data
      // The caller is responsible for merging with existing book data
      return refreshableData;
    },
    [extractRefreshableFields]
  );

  /**
   * Refresh book metadata from external sources
   *
   * @param bookId - The local book ID (used for reference, not lookup)
   * @param isbn - The ISBN to lookup
   * @returns The refreshed metadata or null if lookup failed
   */
  const refreshMetadata = useCallback(
    async (bookId: string, isbn: string): Promise<Partial<Book> | null> => {
      if (!isbn) {
        setError({
          type: 'isbn_required',
          message: 'ISBN is required for metadata refresh',
          retryable: false
        });
        return null;
      }

      setIsRefreshing(true);
      setError(null);

      try {
        // Search multiple sources in parallel by priority
        // Priority: Google Books > Open Library
        const searchPromises = [
          searchGoogleBooksByISBN(isbn),
          searchByISBN(isbn)
        ];

        const [googleBooksResult, openLibraryResult] = await Promise.all(searchPromises);

        // Select the best result based on priority
        let selectedBook: Book | null = null;
        let sourceName: string | null = null;

        if (googleBooksResult) {
          selectedBook = googleBooksResult;
          sourceName = isbnLookupSources.googleBooks.name;
        } else if (openLibraryResult) {
          selectedBook = openLibraryResult;
          sourceName = isbnLookupSources.openLibrary.name;
        }

        if (!selectedBook) {
          setError({
            type: 'no_results',
            message: `No metadata found for ISBN ${isbn}. Searched sources: ${isbnLookupSources.googleBooks.name}, ${isbnLookupSources.openLibrary.name}`,
            retryable: true
          });
          return null;
        }

        // Extract and return only the refreshable fields
        const mergedData = mergeWithPreservedFields(selectedBook, { id: bookId } as Book);

        // Store the last refreshed data
        setLastRefreshedData(mergedData);

        // Dispatch event for external subscribers
        window.dispatchEvent(
          new CustomEvent('book:metadata-refreshed', {
            detail: {
              bookId,
              isbn,
              source: sourceName,
              metadata: mergedData
            }
          })
        );

        return mergedData;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to refresh book metadata';
        setError({
          type: 'api_error',
          message: errorMessage,
          retryable: true
        });
        console.error('Metadata refresh error:', err);
        return null;
      } finally {
        setIsRefreshing(false);
      }
    },
    [mergeWithPreservedFields]
  );

  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear the last refreshed data
   */
  const clearLastRefreshedData = useCallback(() => {
    setLastRefreshedData(null);
  }, []);

  return {
    isRefreshing,
    error,
    lastRefreshedData,
    refreshMetadata,
    clearError,
    clearLastRefreshedData
  };
}
