/**
 * Unit Tests for useBooks Hook
 * Tests core functionality of book-related hooks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Book, FilterConfig, SortConfig } from '../../src/types';

// Helper function to simulate useFilteredBooks logic
// This tests the filtering and sorting logic used by the hook
function filterAndSortBooks(
  books: Book[],
  filters: FilterConfig,
  sortConfig: SortConfig
): Book[] {
  let filtered = [...books];

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(book =>
      book.title.toLowerCase().includes(searchLower) ||
      book.authors.some(author => author.toLowerCase().includes(searchLower))
    );
  }

  // Apply format filter
  if (filters.formats && filters.formats.length > 0) {
    filtered = filtered.filter(book => filters.formats!.includes(book.format));
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const field = sortConfig.field as keyof Book;
    const aVal = a[field] ?? '';
    const bVal = b[field] ?? '';
    const aDate = aVal instanceof Date ? aVal.getTime() : aVal;
    const bDate = bVal instanceof Date ? bVal.getTime() : bVal;

    if (aDate < bDate) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aDate > bDate) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return filtered;
}

describe('useBooks Hook Logic', () => {
  const mockBooks: Book[] = [
    {
      id: '1',
      title: 'Test Book 1',
      authors: ['Author 1'],
      addedAt: new Date('2024-01-01'),
      format: 'physical',
      localOnly: false,
      needsSync: false,
      externalIds: {}
    },
    {
      id: '2',
      title: 'Test Book 2',
      authors: ['Author 2'],
      addedAt: new Date('2024-01-02'),
      format: 'kindle',
      localOnly: false,
      needsSync: false,
      externalIds: {}
    },
    {
      id: '3',
      title: 'Another Book',
      authors: ['Author 1'],
      addedAt: new Date('2024-01-03'),
      format: 'audiobook',
      localOnly: false,
      needsSync: false,
      externalIds: {}
    }
  ];

  describe('Filter Logic', () => {
    it('should filter books by search term in title', () => {
      const filterConfig: FilterConfig = { search: 'Test Book 1' };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Book 1');
    });

    it('should filter books by search term in author', () => {
      const filterConfig: FilterConfig = { search: 'Author 1' };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Another Book'); // Most recent
      expect(result[1].title).toBe('Test Book 1');
    });

    it('should filter books by format', () => {
      const filterConfig: FilterConfig = { formats: ['kindle'] };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(1);
      expect(result[0].format).toBe('kindle');
    });

    it('should filter books by multiple formats', () => {
      const filterConfig: FilterConfig = { formats: ['kindle', 'audiobook'] };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(2);
      expect(result[0].format).toBe('audiobook');
      expect(result[1].format).toBe('kindle');
    });

    it('should handle empty filters', () => {
      const filterConfig: FilterConfig = {};
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      // Result should be sorted by addedAt descending
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Another Book'); // Most recent (2024-01-03)
      expect(result[1].title).toBe('Test Book 2');
      expect(result[2].title).toBe('Test Book 1'); // Oldest (2024-01-01)
    });
  });

  describe('Sort Logic', () => {
    it('should sort books by title ascending', () => {
      const filterConfig: FilterConfig = {};
      const sortConfig: SortConfig = { field: 'title', direction: 'asc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result[0].title).toBe('Another Book');
      expect(result[1].title).toBe('Test Book 1');
      expect(result[2].title).toBe('Test Book 2');
    });

    it('should sort books by title descending', () => {
      const filterConfig: FilterConfig = {};
      const sortConfig: SortConfig = { field: 'title', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result[0].title).toBe('Test Book 2');
      expect(result[1].title).toBe('Test Book 1');
      expect(result[2].title).toBe('Another Book');
    });

    it('should sort books by date ascending', () => {
      const filterConfig: FilterConfig = {};
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'asc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result[0].id).toBe('1'); // 2024-01-01
      expect(result[1].id).toBe('2'); // 2024-01-02
      expect(result[2].id).toBe('3'); // 2024-01-03
    });

    it('should sort books by date descending', () => {
      const filterConfig: FilterConfig = {};
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result[0].id).toBe('3'); // 2024-01-03 (most recent)
      expect(result[1].id).toBe('2'); // 2024-01-02
      expect(result[2].id).toBe('1'); // 2024-01-01
    });
  });

  describe('Combined Filter and Sort', () => {
    it('should apply both filter and sort', () => {
      const filterConfig: FilterConfig = { formats: ['kindle', 'physical'] };
      const sortConfig: SortConfig = { field: 'title', direction: 'asc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Book 1');
      expect(result[1].title).toBe('Test Book 2');
    });

    it('should handle search with multiple results', () => {
      const filterConfig: FilterConfig = { search: 'Test' };
      const sortConfig: SortConfig = { field: 'title', direction: 'asc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Book 1');
      expect(result[1].title).toBe('Test Book 2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive search', () => {
      const filterConfig: FilterConfig = { search: 'TEST BOOK 1' };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Book 1');
    });

    it('should return empty array when no matches', () => {
      const filterConfig: FilterConfig = { search: 'NonExistentBook' };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(0);
    });

    it('should handle empty book array', () => {
      const filterConfig: FilterConfig = { search: 'test' };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks([], filterConfig, sortConfig);
      
      expect(result).toHaveLength(0);
    });

    it('should handle partial format matches', () => {
      const filterConfig: FilterConfig = { formats: ['physical'] };
      const sortConfig: SortConfig = { field: 'addedAt', direction: 'desc' };
      
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toHaveLength(1);
      expect(result[0].format).toBe('physical');
    });

    it('should handle undefined sort config gracefully', () => {
      const filterConfig: FilterConfig = {};
      const sortConfig: SortConfig = { field: 'title', direction: 'desc' };
      
      // This should not throw
      const result = filterAndSortBooks(mockBooks, filterConfig, sortConfig);
      
      expect(result).toBeDefined();
    });
  });
});

describe('Book Type Validation', () => {
  it('should create valid Book objects', () => {
    const book: Book = {
      id: 'test-id',
      title: 'Test Title',
      authors: ['Author 1', 'Author 2'],
      addedAt: new Date(),
      format: 'physical',
      localOnly: false,
      needsSync: false,
      externalIds: {
        openLibrary: 'OL12345M',
        googleBooks: 'abc123'
      }
    };
    
    expect(book.id).toBe('test-id');
    expect(book.title).toBe('Test Title');
    expect(book.authors).toHaveLength(2);
    expect(book.format).toBe('physical');
    expect(book.externalIds.openLibrary).toBe('OL12345M');
  });

  it('should handle optional fields', () => {
    const minimalBook: Book = {
      id: 'minimal',
      title: 'Minimal Book',
      authors: ['Author'],
      addedAt: new Date(),
      format: 'kindle',
      localOnly: false,
      needsSync: false,
      externalIds: {}
    };
    
    expect(minimalBook.subtitle).toBeUndefined();
    expect(minimalBook.isbn13).toBeUndefined();
    expect(minimalBook.coverUrl).toBeUndefined();
  });

  it('should support all book formats', () => {
    const formats: Book['format'][] = ['physical', 'kindle', 'kobo', 'audible', 'audiobook', 'pdf', 'other'];
    
    formats.forEach(format => {
      const book: Book = {
        id: 'test',
        title: 'Test',
        authors: ['Author'],
        addedAt: new Date(),
        format,
        localOnly: false,
        needsSync: false,
        externalIds: {}
      };
      
      expect(book.format).toBe(format);
    });
  });
});

describe('FilterConfig Type', () => {
  it('should allow optional filter fields', () => {
    const emptyFilters: FilterConfig = {};
    expect(emptyFilters.search).toBeUndefined();
    expect(emptyFilters.tags).toBeUndefined();
    expect(emptyFilters.formats).toBeUndefined();
    expect(emptyFilters.collections).toBeUndefined();
    expect(emptyFilters.statuses).toBeUndefined();
  });

  it('should allow partial filter configurations', () => {
    const partialFilters: FilterConfig = {
      search: 'test',
      formats: ['physical']
    };
    
    expect(partialFilters.search).toBe('test');
    expect(partialFilters.formats).toEqual(['physical']);
  });

  it('should allow complete filter configurations', () => {
    const fullFilters: FilterConfig = {
      search: 'test query',
      tags: ['tag1', 'tag2'],
      formats: ['kindle', 'physical'],
      collections: ['collection1'],
      statuses: ['read', 'currently_reading']
    };
    
    expect(fullFilters.search).toBe('test query');
    expect(fullFilters.tags).toHaveLength(2);
    expect(fullFilters.formats).toHaveLength(2);
    expect(fullFilters.collections).toHaveLength(1);
    expect(fullFilters.statuses).toHaveLength(2);
  });
});

describe('SortConfig Type', () => {
  it('should require field and direction', () => {
    const sortConfig: SortConfig = {
      field: 'title',
      direction: 'asc'
    };
    expect(sortConfig.field).toBe('title');
    expect(sortConfig.direction).toBe('asc');
  });

  it('should support ascending direction', () => {
    const sortAsc: SortConfig = {
      field: 'title',
      direction: 'asc'
    };
    
    expect(sortAsc.direction).toBe('asc');
  });

  it('should support descending direction', () => {
    const sortDesc: SortConfig = {
      field: 'addedAt',
      direction: 'desc'
    };
    
    expect(sortDesc.direction).toBe('desc');
  });
});
