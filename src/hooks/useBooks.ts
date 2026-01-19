import { useLiveQuery } from 'dexie-react-hooks';
import { bookOperations, ratingOperations, tagOperations } from '../lib/db';
import { searchService } from '../lib/searchService';
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
import { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchResult, SavedSearch, SearchHistoryEntry } from '../lib/searchService';

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

// =========================================================================
// Advanced Search Hook
// =========================================================================

/**
 * Hook for advanced search with faceted filtering
 */
export function useAdvancedSearch(initialFilters: FilterConfig = {}, initialSort: SortConfig = { field: 'addedAt', direction: 'desc' }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterConfig>(initialFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [includeFacets, setIncludeFacets] = useState(true);
  const [fuzzyMatch, setFuzzyMatch] = useState(true);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async () => {
    setIsSearching(true);
    setError(null);

    try {
      const searchResult = await searchService.search({
        query,
        filters,
        sortConfig,
        page,
        limit,
        fuzzyMatch,
        includeFacets
      });

      setResult(searchResult);

      // Add to search history
      if (query.trim()) {
        searchService.addToSearchHistory(query, searchResult.total);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  }, [query, filters, sortConfig, page, limit, fuzzyMatch, includeFacets]);

  // Re-search when parameters change
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Reset page when filters or query change
  const previousFilters = useRef(filters);
  const previousQuery = useRef(query);
  
  useEffect(() => {
    if (filters !== previousFilters.current || query !== previousQuery.current) {
      previousFilters.current = filters;
      previousQuery.current = query;
      setPage(1);
    }
  }, [filters, query]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    sortConfig,
    setSortConfig,
    page,
    setPage,
    limit,
    setLimit,
    result,
    isSearching,
    error,
    facets: result?.facets,
    totalResults: result?.total || 0,
    totalPages: result?.totalPages || 0,
    searchTime: result?.searchTime || 0,
    fuzzyMatch,
    setFuzzyMatch,
    includeFacets,
    setIncludeFacets,
    refresh: performSearch
  };
}

/**
 * Hook for search suggestions/autocomplete
 */
export function useSearchSuggestions(limit = 5) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchService.getSuggestions(query, limit);
        setSuggestions(results);
      } catch (e) {
        console.error('Suggestion error:', e);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 200); // Debounce suggestions

    return () => clearTimeout(timer);
  }, [query, limit]);

  return { query, setQuery, suggestions, isLoading };
}

/**
 * Hook for author autocomplete
 */
export function useAuthorSearch(limit = 10) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ value: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const authorResults = await searchService.searchAuthors(query, limit);
        setResults(authorResults);
      } catch (e) {
        console.error('Author search error:', e);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, limit]);

  return { query, setQuery, results, isLoading };
}

/**
 * Hook for search history management
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(searchService.getSearchHistory());
  }, []);

  const clearHistory = useCallback(() => {
    searchService.clearSearchHistory();
    setHistory([]);
  }, []);

  const removeEntry = useCallback((query: string) => {
    searchService.removeFromSearchHistory(query);
    setHistory(searchService.getSearchHistory());
  }, []);

  return { history, clearHistory, removeEntry };
}

/**
 * Hook for saved searches management
 */
export function useSavedSearches() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setSavedSearches(searchService.getSavedSearches());
  }, []);

  const saveSearch = useCallback((name: string, query: string, filters: Partial<FilterConfig>) => {
    const saved = searchService.saveSearch(name, query, filters);
    setSavedSearches(searchService.getSavedSearches());
    return saved;
  }, []);

  const deleteSearch = useCallback((id: string) => {
    searchService.deleteSavedSearch(id);
    setSavedSearches(searchService.getSavedSearches());
  }, []);

  const useSavedSearch = useCallback((id: string) => {
    searchService.incrementSavedSearchUse(id);
    setSavedSearches(searchService.getSavedSearches());
  }, []);

  return { savedSearches, saveSearch, deleteSearch, useSavedSearch };
}
