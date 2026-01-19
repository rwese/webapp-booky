import type { Book, FilterConfig, SortConfig } from '../types';
import { bookOperations } from './db';

/**
 * Search configuration options
 */
export interface SearchOptions {
  query: string;
  filters?: Partial<FilterConfig>;
  sortConfig?: SortConfig;
  page?: number;
  limit?: number;
  fuzzyMatch?: boolean;
  includeFacets?: boolean;
}

/**
 * Facet information with count
 */
export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacets {
  authors: FacetValue[];
  genres: FacetValue[];
  formats: FacetValue[];
  statuses: FacetValue[];
  tags: FacetValue[];
  ratings: FacetValue[];
  years: FacetValue[];
  publishers: FacetValue[];
}

/**
 * Search result with pagination info
 */
export interface SearchResult {
  books: Book[];
  total: number;
  page: number;
  totalPages: number;
  facets?: SearchFacets;
  query: string;
  searchTime: number; // ms
}

/**
 * Saved search query
 */
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Partial<FilterConfig>;
  createdAt: Date;
  useCount: number;
}

/**
 * Search history entry
 */
export interface SearchHistoryEntry {
  query: string;
  timestamp: Date;
  resultCount: number;
}

/**
 * Fuzzy match result
 */
interface FuzzyMatch {
  score: number; // 0-1, higher is better
  matched: boolean;
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// Calculate fuzzy match score (0-1)
function calculateFuzzyScore(query: string, text: string): FuzzyMatch {
  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase();

  // Exact match
  if (textLower.includes(queryLower)) {
    return { score: 1, matched: true };
  }

  // Remove spaces and compare
  const queryNoSpaces = queryLower.replace(/\s+/g, '');
  const textNoSpaces = textLower.replace(/\s+/g, '');
  if (textNoSpaces.includes(queryNoSpaces)) {
    return { score: 0.9, matched: true };
  }

  // Levenshtein distance for fuzzy matching
  const maxLen = Math.max(queryLower.length, textLower.length);
  if (maxLen === 0) return { score: 0, matched: false };

  const distance = levenshteinDistance(queryLower, textLower);
  const similarity = 1 - distance / maxLen;

  // Threshold for fuzzy match (0.6 = 60% similar)
  return { score: similarity, matched: similarity >= 0.6 };
}

// Normalize ISBN for comparison
function normalizeISBN(isbn: string): string {
  return isbn.replace(/[-\s]/g, '');
}

// Search field weights for relevance scoring
const FIELD_WEIGHTS = {
  title: 10,
  authors: 8,
  isbn: 7,
  publisher: 5,
  description: 3,
  tags: 4,
  series: 6,
  subjects: 2,
};

/**
 * Main search service
 */
class SearchService {
  private readonly MAX_HISTORY_ITEMS = 20;
  private readonly MAX_SAVED_SEARCHES = 50;

  /**
   * Perform advanced search with filters and facets
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const startTime = performance.now();
    const {
      query,
      filters = {},
      sortConfig = { field: 'addedAt', direction: 'desc' },
      page = 1,
      limit = 50,
      fuzzyMatch = false,
      includeFacets = false
    } = options;

    // Get all books (optimized with indexed fields)
    let books = await bookOperations.getAll();

    // Apply basic filters first to reduce dataset
    books = this.applyBasicFilters(books, filters);

    // Apply text search
    if (query.trim()) {
      books = this.applyTextSearch(books, query, fuzzyMatch);
    }

    // Calculate facets if requested
    let facets: SearchFacets | undefined;
    if (includeFacets) {
      facets = await this.calculateFacets(books, filters);
    }

    // Sort results
    books = this.sortBooks(books, sortConfig);

    // Calculate pagination
    const total = books.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedBooks = books.slice(startIndex, startIndex + limit);

    const searchTime = performance.now() - startTime;

    return {
      books: paginatedBooks,
      total,
      page,
      totalPages,
      facets,
      query,
      searchTime
    };
  }

  /**
   * Apply basic filters to reduce dataset before text search
   */
  private applyBasicFilters(books: Book[], filters: Partial<FilterConfig>): Book[] {
    let result = books;

    // Format filter
    if (filters.formats && filters.formats.length > 0) {
      result = result.filter(book => filters.formats!.includes(book.format));
    }

    // Reading status filter
    if (filters.statuses && filters.statuses.length > 0) {
      result = result.filter((_book) => {
        // TODO: Implement reading status filter with reading logs
        return true;
      });
    }

    // Rating filter
    if (filters.minRating !== undefined || filters.maxRating !== undefined) {
      result = result.filter(book => {
        const rating = book.averageRating || 0;
        if (filters.minRating !== undefined && rating < filters.minRating) return false;
        if (filters.maxRating !== undefined && rating > filters.maxRating) return false;
        return true;
      });
    }

    // Date range filter
    if (filters.dateRange) {
      result = result.filter(book => {
        const addedAt = new Date(book.addedAt);
        return addedAt >= filters.dateRange!.start && addedAt <= filters.dateRange!.end;
      });
    }

    // Year filter
    if (filters.yearRange) {
      result = result.filter(book => {
        const year = book.publishedYear;
        if (!year) return false;
        return year >= filters.yearRange!.start && year <= filters.yearRange!.end;
      });
    }

    return result;
  }

  /**
   * Apply text search with fuzzy matching
   */
  private applyTextSearch(books: Book[], query: string, fuzzyMatch: boolean): Book[] {
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/);
    
    return books.map(book => {
      let relevanceScore = 0;
      let matchedFields: string[] = [];

      // Check ISBN (exact or fuzzy)
      if (book.isbn13) {
        const normalizedISBN = normalizeISBN(book.isbn13);
        const normalizedQuery = normalizeISBN(query);
        if (normalizedISBN.includes(normalizedQuery)) {
          relevanceScore += FIELD_WEIGHTS.isbn * 2;
          matchedFields.push('isbn');
        } else if (fuzzyMatch) {
          const fuzzy = calculateFuzzyScore(query, book.isbn13);
          if (fuzzy.matched) {
            relevanceScore += FIELD_WEIGHTS.isbn * fuzzy.score;
            matchedFields.push('isbn');
          }
        }
      }

      // Check title (weighted)
      const titleLower = book.title.toLowerCase();
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          relevanceScore += FIELD_WEIGHTS.title * 0.5;
          matchedFields.push('title');
        } else if (fuzzyMatch) {
          const fuzzy = calculateFuzzyScore(word, book.title);
          if (fuzzy.matched) {
            relevanceScore += FIELD_WEIGHTS.title * fuzzy.score * 0.3;
            matchedFields.push('title');
          }
        }
      }

      // Exact title match (higher weight)
      if (titleLower === queryLower) {
        relevanceScore += FIELD_WEIGHTS.title * 2;
      } else if (titleLower.startsWith(queryLower)) {
        relevanceScore += FIELD_WEIGHTS.title * 1.5;
      }

      // Check authors
      for (const author of book.authors) {
        const authorLower = author.toLowerCase();
        if (authorLower.includes(queryLower)) {
          relevanceScore += FIELD_WEIGHTS.authors;
          matchedFields.push('authors');
        } else if (fuzzyMatch) {
          const fuzzy = calculateFuzzyScore(query, author);
          if (fuzzy.matched) {
            relevanceScore += FIELD_WEIGHTS.authors * fuzzy.score;
            matchedFields.push('authors');
          }
        }
      }

      // Check publisher
      if (book.publisher) {
        const publisherLower = book.publisher.toLowerCase();
        if (publisherLower.includes(queryLower)) {
          relevanceScore += FIELD_WEIGHTS.publisher;
          matchedFields.push('publisher');
        }
      }

      // Check description
      if (book.description) {
        const descLower = book.description.toLowerCase();
        if (descLower.includes(queryLower)) {
          relevanceScore += FIELD_WEIGHTS.description;
          matchedFields.push('description');
        }
      }

      // Check tags
      if (book.tags) {
        for (const tag of book.tags) {
          if (tag.toLowerCase().includes(queryLower)) {
            relevanceScore += FIELD_WEIGHTS.tags;
            matchedFields.push('tags');
            break;
          }
        }
      }

      // Check series
      if (book.seriesName) {
        const seriesLower = book.seriesName.toLowerCase();
        if (seriesLower.includes(queryLower)) {
          relevanceScore += FIELD_WEIGHTS.series;
          matchedFields.push('series');
        }
      }

      // Check subjects/categories
      if (book.subjects) {
        for (const subject of book.subjects) {
          if (subject.toLowerCase().includes(queryLower)) {
            relevanceScore += FIELD_WEIGHTS.subjects;
            matchedFields.push('subjects');
            break;
          }
        }
      }

      return { ...book, _relevanceScore: relevanceScore, _matchedFields: matchedFields };
    })
      .filter(book => (book._relevanceScore || 0) > 0)
      .sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0))
      .map(({ _relevanceScore, _matchedFields, ...book }) => book);
  }

  /**
   * Sort books by configuration
   */
  private sortBooks(books: Book[], sortConfig: SortConfig): Book[] {
    return [...books].sort((a, b) => {
      let aVal: string | number | Date;
      let bVal: string | number | Date;

      switch (sortConfig.field) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'author':
          aVal = a.authors[0]?.toLowerCase() || '';
          bVal = b.authors[0]?.toLowerCase() || '';
          break;
        case 'rating':
          aVal = a.averageRating || 0;
          bVal = b.averageRating || 0;
          break;
        case 'publishedYear':
        case 'year':
          aVal = a.publishedYear || 0;
          bVal = b.publishedYear || 0;
          break;
        case 'pageCount':
          aVal = a.pageCount || 0;
          bVal = b.pageCount || 0;
          break;
        case 'addedAt':
        default:
          aVal = new Date(a.addedAt);
          bVal = new Date(b.addedAt);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Calculate facets for search results
   */
  private async calculateFacets(books: Book[], _currentFilters: Partial<FilterConfig>): Promise<SearchFacets> {
    const authors = new Map<string, number>();
    const genres = new Map<string, number>();
    const formats = new Map<string, number>();
    const statuses = new Map<string, number>();
    const tags = new Map<string, number>();
    const ratings = new Map<string, number>();
    const years = new Map<string, number>();
    const publishers = new Map<string, number>();

    for (const book of books) {
      // Authors
      for (const author of book.authors) {
        authors.set(author, (authors.get(author) || 0) + 1);
      }

      // Genres/categories
      if (book.categories) {
        for (const cat of book.categories) {
          genres.set(cat, (genres.get(cat) || 0) + 1);
        }
      }

      // Formats
      formats.set(book.format, (formats.get(book.format) || 0) + 1);

      // Tags
      if (book.tags) {
        for (const tag of book.tags) {
          tags.set(tag, (tags.get(tag) || 0) + 1);
        }
      }

      // Years
      if (book.publishedYear) {
        years.set(book.publishedYear.toString(), (years.get(book.publishedYear.toString()) || 0) + 1);
      }

      // Publishers
      if (book.publisher) {
        publishers.set(book.publisher, (publishers.get(book.publisher) || 0) + 1);
      }

      // Ratings (bucketed)
      if (book.averageRating) {
        const ratingBucket = Math.floor(book.averageRating);
        const ratingKey = `${ratingBucket}-${ratingBucket + 1}`;
        ratings.set(ratingKey, (ratings.get(ratingKey) || 0) + 1);
      }
    }

    return {
      authors: this.mapToFacetArray(authors),
      genres: this.mapToFacetArray(genres),
      formats: this.mapToFacetArray(formats),
      statuses: this.mapToFacetArray(statuses),
      tags: this.mapToFacetArray(tags),
      ratings: this.mapToFacetArray(ratings),
      years: this.mapToFacetArray(years),
      publishers: this.mapToFacetArray(publishers),
    };
  }

  private mapToFacetArray(map: Map<string, number>): FacetValue[] {
    return Array.from(map.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Limit to top 20
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(query: string, limit = 5): Promise<string[]> {
    if (!query.trim() || query.length < 2) return [];

    const books = await bookOperations.getAll();
    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    // Collect matching titles
    for (const book of books) {
      if (book.title.toLowerCase().includes(queryLower)) {
        suggestions.add(book.title);
        if (suggestions.size >= limit) break;
      }
    }

    // Collect matching authors
    if (suggestions.size < limit) {
      for (const book of books) {
        for (const author of book.authors) {
          if (author.toLowerCase().includes(queryLower)) {
            suggestions.add(author);
            if (suggestions.size >= limit * 2) break;
          }
        }
        if (suggestions.size >= limit * 2) break;
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Search authors with autocomplete
   */
  async searchAuthors(query: string, limit = 10): Promise<FacetValue[]> {
    if (!query.trim() || query.length < 2) return [];

    const books = await bookOperations.getAll();
    const authorCounts = new Map<string, number>();

    for (const book of books) {
      for (const author of book.authors) {
        if (author.toLowerCase().includes(query.toLowerCase())) {
          authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
        }
      }
    }

    return Array.from(authorCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get all unique authors
   */
  async getAllAuthors(): Promise<FacetValue[]> {
    const books = await bookOperations.getAll();
    const authorCounts = new Map<string, number>();

    for (const book of books) {
      for (const author of book.authors) {
        authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
      }
    }

    return Array.from(authorCounts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // =========================================================================
  // Search History Management
  // =========================================================================

  /**
   * Get search history from localStorage
   */
  getSearchHistory(): SearchHistoryEntry[] {
    try {
      const stored = localStorage.getItem('searchHistory');
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Add entry to search history
   */
  addToSearchHistory(query: string, resultCount: number): void {
    const history = this.getSearchHistory();
    
    // Remove duplicate if exists
    const filtered = history.filter(entry => entry.query !== query);
    
    // Add new entry at the beginning
    filtered.unshift({
      query,
      timestamp: new Date(),
      resultCount
    });

    // Limit history size
    const trimmed = filtered.slice(0, this.MAX_HISTORY_ITEMS);

    try {
      localStorage.setItem('searchHistory', JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save search history:', e);
    }
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    localStorage.removeItem('searchHistory');
  }

  /**
   * Remove specific entry from search history
   */
  removeFromSearchHistory(query: string): void {
    const history = this.getSearchHistory();
    const filtered = history.filter(entry => entry.query !== query);
    localStorage.setItem('searchHistory', JSON.stringify(filtered));
  }

  // =========================================================================
  // Saved Searches Management
  // =========================================================================

  /**
   * Get saved searches from localStorage
   */
  getSavedSearches(): SavedSearch[] {
    try {
      const stored = localStorage.getItem('savedSearches');
      if (!stored) return [];
      return JSON.parse(stored).map((s: SavedSearch) => ({
        ...s,
        createdAt: new Date(s.createdAt)
      }));
    } catch {
      return [];
    }
  }

  /**
   * Save a search query
   */
  saveSearch(name: string, query: string, filters: Partial<FilterConfig>): SavedSearch {
    const saved = this.getSavedSearches();
    
    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name,
      query,
      filters,
      createdAt: new Date(),
      useCount: 0
    };

    saved.push(newSearch);

    // Limit saved searches
    const trimmed = saved.slice(0, this.MAX_SAVED_SEARCHES);

    try {
      localStorage.setItem('savedSearches', JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save search:', e);
    }

    return newSearch;
  }

  /**
   * Delete a saved search
   */
  deleteSavedSearch(id: string): void {
    const saved = this.getSavedSearches();
    const filtered = saved.filter(s => s.id !== id);
    localStorage.setItem('savedSearches', JSON.stringify(filtered));
  }

  /**
   * Update saved search usage count
   */
  incrementSavedSearchUse(id: string): void {
    const saved = this.getSavedSearches();
    const updated = saved.map(s => {
      if (s.id === id) {
        return { ...s, useCount: s.useCount + 1 };
      }
      return s;
    });
    localStorage.setItem('savedSearches', JSON.stringify(updated));
  }

  /**
   * Update a saved search
   */
  updateSavedSearch(id: string, updates: Partial<SavedSearch>): void {
    const saved = this.getSavedSearches();
    const updated = saved.map(s => {
      if (s.id === id) {
        return { ...s, ...updates };
      }
      return s;
    });
    localStorage.setItem('savedSearches', JSON.stringify(updated));
  }
}

// Singleton instance
export const searchService = new SearchService();

/**
 * Helper function to create search options from FilterConfig
 */
export function filterConfigToSearchOptions(
  filterConfig: FilterConfig,
  sortConfig: SortConfig,
  page = 1,
  limit = 50
): SearchOptions {
  return {
    query: filterConfig.search || '',
    filters: filterConfig,
    sortConfig,
    page,
    limit,
    fuzzyMatch: true,
    includeFacets: true
  };
}

/**
 * Debounced search helper
 */
export function debouncedSearch<T>(
  searchFn: (query: string) => Promise<T>,
  delay = 300
): (query: string) => Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (query: string) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        const result = await searchFn(query);
        resolve(result);
      }, delay);
    });
  };
}
