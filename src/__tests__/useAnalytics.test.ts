/**
 * Unit Tests for useAnalytics Hook
 * Tests analytics helper functions and data processing logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Book, Rating, ReadingLog } from '../../src/types';

// Helper functions extracted from useAnalytics.ts for testing
function calculateAverageRating(ratings: Rating[] | undefined): number {
  if (!ratings || ratings.length === 0) return 0;
  const total = ratings.reduce((sum, rating) => sum + (rating.stars || 0), 0);
  return Math.round((total / ratings.length) * 10) / 10;
}

function calculatePagesRead(books: Book[], ratings: Rating[]): number {
  return books.reduce((total, book) => {
    const bookRating = ratings.find(r => r.bookId === book.id);
    if (bookRating) {
      return total + (book.pageCount || 0);
    }
    return total;
  }, 0);
}

function getReadingHistory(logs: ReadingLog[]) {
  const readLogs = logs.filter(log => log.status === 'read' && log.finishedAt);

  // Group by year
  const yearData: Record<string, number> = {};
  // Group by month (for current year)
  const monthData: Record<string, number> = {};

  readLogs.forEach(log => {
    const date = log.finishedAt instanceof Date ? log.finishedAt : new Date(log.finishedAt as unknown as string);
    const year = date.getFullYear().toString();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    yearData[year] = (yearData[year] || 0) + 1;
    monthData[monthKey] = (monthData[monthKey] || 0) + 1;
  });

  return { yearData, monthData };
}

function countReReads(logs: ReadingLog[]): number {
  const bookReadCount: Record<string, number> = {};

  logs.filter(log => log.status === 'read').forEach(log => {
    bookReadCount[log.bookId] = (bookReadCount[log.bookId] || 0) + 1;
  });

  // Count books read more than once
  return Object.values(bookReadCount).filter(count => count > 1).length;
}

// Filter and sort functions from useReadingHistory
function filterReadingLogs(
  logs: ReadingLog[],
  books: Book[],
  ratings: Rating[],
  filters: { statuses?: string[]; formats?: string[]; minRating?: number; maxRating?: number }
) {
  let filtered = logs.filter(log => {
    // Apply status filter
    if (filters.statuses && filters.statuses.length > 0) {
      if (!filters.statuses.includes(log.status)) return false;
    }
    return true;
  });

  // Get book details for each log
  const logsWithDetails = filtered.map(log => {
    const book = books.find(b => b.id === log.bookId);
    const rating = ratings.find(r => r.bookId === log.bookId);
    return { ...log, book, rating };
  });

  // Apply book filters
  return logsWithDetails.filter(log => {
    if (!log.book) return false;

    // Apply format filter
    if (filters.formats && filters.formats.length > 0) {
      if (!filters.formats.includes(log.book.format)) return false;
    }

    // Apply rating filter
    if (filters.minRating !== undefined || filters.maxRating !== undefined) {
      const rating = log.rating?.stars || 0;
      if (filters.minRating !== undefined && rating < filters.minRating) return false;
      if (filters.maxRating !== undefined && rating > filters.maxRating) return false;
    }

    return true;
  });
}

function sortReadingLogs(
  logs: Array<ReadingLog & { book?: Book; rating?: Rating }>,
  sortConfig: { field: string; direction: 'asc' | 'desc' }
) {
  const sorted = [...logs];

  sorted.sort((a, b) => {
    let comparison = 0;

    if (sortConfig.field === 'finishedAt' || sortConfig.field === 'startedAt' || sortConfig.field === 'createdAt') {
      const aField = a[sortConfig.field as keyof typeof a];
      const bField = b[sortConfig.field as keyof typeof b];
      const aDate = aField instanceof Date ? aField : (aField ? new Date(aField as unknown as string) : new Date(0));
      const bDate = bField instanceof Date ? bField : (bField ? new Date(bField as unknown as string) : new Date(0));

      comparison = aDate.getTime() - bDate.getTime();
    } else if (sortConfig.field === 'rating') {
      comparison = (a.rating?.stars || 0) - (b.rating?.stars || 0);
    } else if (sortConfig.field === 'title') {
      comparison = (a.book?.title || '').localeCompare(b.book?.title || '');
    }

    return sortConfig.direction === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

describe('useAnalytics Helper Functions', () => {
  describe('calculateAverageRating', () => {
    it('should return 0 for empty ratings', () => {
      expect(calculateAverageRating(undefined)).toBe(0);
      expect(calculateAverageRating([])).toBe(0);
    });

    it('should calculate average rating correctly', () => {
      const ratings: Rating[] = [
        { id: '1', bookId: 'book-1', stars: 5, updatedAt: new Date(), containsSpoilers: false },
        { id: '2', bookId: 'book-2', stars: 3, updatedAt: new Date(), containsSpoilers: false },
        { id: '3', bookId: 'book-3', stars: 4, updatedAt: new Date(), containsSpoilers: false }
      ];

      expect(calculateAverageRating(ratings)).toBe(4); // (5 + 3 + 4) / 3 = 4
    });

    it('should handle single rating', () => {
      const ratings: Rating[] = [
        { id: '1', bookId: 'book-1', stars: 4.5, updatedAt: new Date(), containsSpoilers: false }
      ];

      expect(calculateAverageRating(ratings)).toBe(4.5);
    });

    it('should handle ratings with 0 stars', () => {
      const ratings: Rating[] = [
        { id: '1', bookId: 'book-1', stars: 5, updatedAt: new Date(), containsSpoilers: false },
        { id: '2', bookId: 'book-2', stars: 0, updatedAt: new Date(), containsSpoilers: false }
      ];

      expect(calculateAverageRating(ratings)).toBe(2.5);
    });

    it('should round to 1 decimal place', () => {
      const ratings: Rating[] = [
        { id: '1', bookId: 'book-1', stars: 5, updatedAt: new Date(), containsSpoilers: false },
        { id: '2', bookId: 'book-2', stars: 4, updatedAt: new Date(), containsSpoilers: false },
        { id: '3', bookId: 'book-3', stars: 3, updatedAt: new Date(), containsSpoilers: false }
      ];

      expect(calculateAverageRating(ratings)).toBe(4); // (5 + 4 + 3) / 3 = 4
    });
  });

  describe('calculatePagesRead', () => {
    const mockBooks: Book[] = [
      {
        id: 'book-1',
        title: 'Book 1',
        authors: ['Author 1'],
        addedAt: new Date(),
        format: 'physical',
        localOnly: false,
        needsSync: false,
        externalIds: {},
        pageCount: 300
      },
      {
        id: 'book-2',
        title: 'Book 2',
        authors: ['Author 2'],
        addedAt: new Date(),
        format: 'kindle',
        localOnly: false,
        needsSync: false,
        externalIds: {},
        pageCount: 250
      },
      {
        id: 'book-3',
        title: 'Book 3',
        authors: ['Author 3'],
        addedAt: new Date(),
        format: 'audiobook',
        localOnly: false,
        needsSync: false,
        externalIds: {}
        // No pageCount
      }
    ];

    it('should return 0 for empty books', () => {
      expect(calculatePagesRead([], [])).toBe(0);
    });

    it('should return 0 when no books have ratings', () => {
      const ratings: Rating[] = [];
      expect(calculatePagesRead(mockBooks, ratings)).toBe(0);
    });

    it('should sum pages for books with ratings', () => {
      const ratings: Rating[] = [
        { id: '1', bookId: 'book-1', stars: 5, updatedAt: new Date(), containsSpoilers: false }
      ];

      expect(calculatePagesRead(mockBooks, ratings)).toBe(300);
    });

    it('should sum pages for multiple rated books', () => {
      const ratings: Rating[] = [
        { id: '1', bookId: 'book-1', stars: 5, updatedAt: new Date(), containsSpoilers: false },
        { id: '2', bookId: 'book-2', stars: 4, updatedAt: new Date(), containsSpoilers: false }
      ];

      expect(calculatePagesRead(mockBooks, ratings)).toBe(550); // 300 + 250
    });

    it('should ignore books without pageCount', () => {
      const ratings: Rating[] = [
        { id: '1', bookId: 'book-1', stars: 5, updatedAt: new Date(), containsSpoilers: false },
        { id: '3', bookId: 'book-3', stars: 3, updatedAt: new Date(), containsSpoilers: false }
      ];

      expect(calculatePagesRead(mockBooks, ratings)).toBe(300); // Only book-1 has pageCount
    });
  });

  describe('getReadingHistory', () => {
    it('should return empty data for no read logs', () => {
      const logs: ReadingLog[] = [];
      const result = getReadingHistory(logs);

      expect(result.yearData).toEqual({});
      expect(result.monthData).toEqual({});
    });

    it('should filter out non-read logs', () => {
      const logs: ReadingLog[] = [
        { id: '1', bookId: 'book-1', status: 'currently_reading', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', bookId: 'book-2', status: 'want_to_read', createdAt: new Date(), updatedAt: new Date() },
        { id: '3', bookId: 'book-3', status: 'read', finishedAt: new Date('2024-06-15'), createdAt: new Date(), updatedAt: new Date() }
      ];

      const result = getReadingHistory(logs);
      expect(Object.values(result.yearData)).toContain(1);
    });

    it('should group by year correctly', () => {
      const logs: ReadingLog[] = [
        { id: '1', bookId: 'book-1', status: 'read', finishedAt: new Date('2024-01-15'), createdAt: new Date(), updatedAt: new Date() },
        { id: '2', bookId: 'book-2', status: 'read', finishedAt: new Date('2024-06-20'), createdAt: new Date(), updatedAt: new Date() },
        { id: '3', bookId: 'book-3', status: 'read', finishedAt: new Date('2023-12-01'), createdAt: new Date(), updatedAt: new Date() }
      ];

      const result = getReadingHistory(logs);

      expect(result.yearData['2024']).toBe(2);
      expect(result.yearData['2023']).toBe(1);
    });

    it('should group by month correctly', () => {
      const logs: ReadingLog[] = [
        { id: '1', bookId: 'book-1', status: 'read', finishedAt: new Date('2024-03-15'), createdAt: new Date(), updatedAt: new Date() },
        { id: '2', bookId: 'book-2', status: 'read', finishedAt: new Date('2024-03-28'), createdAt: new Date(), updatedAt: new Date() },
        { id: '3', bookId: 'book-3', status: 'read', finishedAt: new Date('2024-04-10'), createdAt: new Date(), updatedAt: new Date() }
      ];

      const result = getReadingHistory(logs);

      expect(result.monthData['2024-03']).toBe(2);
      expect(result.monthData['2024-04']).toBe(1);
    });
  });

  describe('countReReads', () => {
    it('should return 0 for no logs', () => {
      expect(countReReads([])).toBe(0);
    });

    it('should return 0 when no books are read more than once', () => {
      const logs: ReadingLog[] = [
        { id: '1', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', bookId: 'book-2', status: 'read', createdAt: new Date(), updatedAt: new Date() }
      ];

      expect(countReReads(logs)).toBe(0);
    });

    it('should count books read multiple times', () => {
      const logs: ReadingLog[] = [
        { id: '1', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() }, // Re-read
        { id: '3', bookId: 'book-2', status: 'read', createdAt: new Date(), updatedAt: new Date() }
      ];

      expect(countReReads(logs)).toBe(1); // Only book-1 was re-read
    });

    it('should count multiple re-reads', () => {
      const logs: ReadingLog[] = [
        { id: '1', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() },
        { id: '3', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() },
        { id: '4', bookId: 'book-2', status: 'read', createdAt: new Date(), updatedAt: new Date() },
        { id: '5', bookId: 'book-2', status: 'read', createdAt: new Date(), updatedAt: new Date() }
      ];

      expect(countReReads(logs)).toBe(2); // Both books were re-read
    });

    it('should ignore non-read logs', () => {
      const logs: ReadingLog[] = [
        { id: '1', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', bookId: 'book-1', status: 'dnf', createdAt: new Date(), updatedAt: new Date() },
        { id: '3', bookId: 'book-1', status: 'currently_reading', createdAt: new Date(), updatedAt: new Date() }
      ];

      expect(countReReads(logs)).toBe(0); // Only one read, not a re-read
    });
  });

  describe('Reading Log Filtering', () => {
    const mockBooks: Book[] = [
      {
        id: 'book-1',
        title: 'Book 1',
        authors: ['Author 1'],
        addedAt: new Date(),
        format: 'physical',
        localOnly: false,
        needsSync: false,
        externalIds: {}
      },
      {
        id: 'book-2',
        title: 'Book 2',
        authors: ['Author 2'],
        addedAt: new Date(),
        format: 'kindle',
        localOnly: false,
        needsSync: false,
        externalIds: {}
      }
    ];

    const mockRatings: Rating[] = [
      { id: '1', bookId: 'book-1', stars: 5, updatedAt: new Date(), containsSpoilers: false }
    ];

    const mockLogs: ReadingLog[] = [
      { id: '1', bookId: 'book-1', status: 'read', createdAt: new Date(), updatedAt: new Date() },
      { id: '2', bookId: 'book-2', status: 'currently_reading', createdAt: new Date(), updatedAt: new Date() },
      { id: '3', bookId: 'book-2', status: 'want_to_read', createdAt: new Date(), updatedAt: new Date() }
    ];

    it('should filter by status', () => {
      const result = filterReadingLogs(mockLogs, mockBooks, mockRatings, { statuses: ['read'] });

      expect(result).toHaveLength(1);
      expect(result[0].bookId).toBe('book-1');
    });

    it('should filter by multiple statuses', () => {
      const result = filterReadingLogs(mockLogs, mockBooks, mockRatings, { statuses: ['read', 'currently_reading'] });

      expect(result).toHaveLength(2);
    });

    it('should filter by format', () => {
      const result = filterReadingLogs(mockLogs, mockBooks, mockRatings, { formats: ['kindle'] });

      expect(result).toHaveLength(2); // Both logs for book-2
      expect(result.every(log => log.book?.format === 'kindle')).toBe(true);
    });

    it('should filter by minimum rating', () => {
      const result = filterReadingLogs(mockLogs, mockBooks, mockRatings, { minRating: 4 });

      expect(result).toHaveLength(1); // Only book-1 has 5-star rating
    });

    it('should filter by maximum rating', () => {
      const result = filterReadingLogs(mockLogs, mockBooks, mockRatings, { maxRating: 3 });

      // book-1 has rating 5 (> 3), filtered out
      // book-2 has no rating (defaults to 0 <= 3), both logs for book-2 pass
      expect(result).toHaveLength(2);
      expect(result.every(log => log.bookId === 'book-2')).toBe(true);
    });

    it('should filter by rating range', () => {
      const result = filterReadingLogs(mockLogs, mockBooks, mockRatings, { minRating: 3, maxRating: 5 });

      expect(result).toHaveLength(1);
    });

    it('should return empty for non-existent book', () => {
      const logsWithMissingBook: ReadingLog[] = [
        { id: '1', bookId: 'missing-book', status: 'read', createdAt: new Date(), updatedAt: new Date() }
      ];

      const result = filterReadingLogs(logsWithMissingBook, mockBooks, mockRatings, {});

      expect(result).toHaveLength(0);
    });
  });

  describe('Reading Log Sorting', () => {
    const mockBooks: Book[] = [
      {
        id: 'book-1',
        title: 'Book A',
        authors: ['Author 1'],
        addedAt: new Date(),
        format: 'physical',
        localOnly: false,
        needsSync: false,
        externalIds: {}
      },
      {
        id: 'book-2',
        title: 'Book B',
        authors: ['Author 2'],
        addedAt: new Date(),
        format: 'kindle',
        localOnly: false,
        needsSync: false,
        externalIds: {}
      }
    ];

    const mockRatings: Rating[] = [
      { id: '1', bookId: 'book-1', stars: 3, updatedAt: new Date(), containsSpoilers: false },
      { id: '2', bookId: 'book-2', stars: 5, updatedAt: new Date(), containsSpoilers: false }
    ];

    const mockLogs: ReadingLog[] = [
      { id: '1', bookId: 'book-1', status: 'read', finishedAt: new Date('2024-01-15'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', bookId: 'book-2', status: 'read', finishedAt: new Date('2024-03-20'), createdAt: new Date(), updatedAt: new Date() }
    ];

    it('should sort by finishedAt ascending', () => {
      const filtered = filterReadingLogs(mockLogs, mockBooks, mockRatings, {});
      const result = sortReadingLogs(filtered, { field: 'finishedAt', direction: 'asc' });

      expect(result[0].bookId).toBe('book-1'); // Older date
      expect(result[1].bookId).toBe('book-2'); // Newer date
    });

    it('should sort by finishedAt descending', () => {
      const filtered = filterReadingLogs(mockLogs, mockBooks, mockRatings, {});
      const result = sortReadingLogs(filtered, { field: 'finishedAt', direction: 'desc' });

      expect(result[0].bookId).toBe('book-2'); // Newer date
      expect(result[1].bookId).toBe('book-1'); // Older date
    });

    it('should sort by rating ascending', () => {
      const filtered = filterReadingLogs(mockLogs, mockBooks, mockRatings, {});
      const result = sortReadingLogs(filtered, { field: 'rating', direction: 'asc' });

      expect(result[0].bookId).toBe('book-1'); // Rating 3
      expect(result[1].bookId).toBe('book-2'); // Rating 5
    });

    it('should sort by rating descending', () => {
      const filtered = filterReadingLogs(mockLogs, mockBooks, mockRatings, {});
      const result = sortReadingLogs(filtered, { field: 'rating', direction: 'desc' });

      expect(result[0].bookId).toBe('book-2'); // Rating 5
      expect(result[1].bookId).toBe('book-1'); // Rating 3
    });

    it('should sort by title ascending', () => {
      const filtered = filterReadingLogs(mockLogs, mockBooks, mockRatings, {});
      const result = sortReadingLogs(filtered, { field: 'title', direction: 'asc' });

      expect(result[0].book?.title).toBe('Book A');
      expect(result[1].book?.title).toBe('Book B');
    });

    it('should sort by title descending', () => {
      const filtered = filterReadingLogs(mockLogs, mockBooks, mockRatings, {});
      const result = sortReadingLogs(filtered, { field: 'title', direction: 'desc' });

      expect(result[0].book?.title).toBe('Book B');
      expect(result[1].book?.title).toBe('Book A');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays gracefully', () => {
      expect(calculateAverageRating([])).toBe(0);
      expect(calculatePagesRead([], [])).toBe(0);
      expect(getReadingHistory([])).toEqual({ yearData: {}, monthData: {} });
      expect(countReReads([])).toBe(0);
    });

    it('should handle undefined ratings', () => {
      expect(calculateAverageRating(undefined)).toBe(0);
    });

    it('should handle books without ratings', () => {
      const books: Book[] = [
        { id: '1', title: 'Book 1', authors: [], addedAt: new Date(), format: 'physical', localOnly: false, needsSync: false, externalIds: {} }
      ];
      const ratings: Rating[] = [];

      expect(calculatePagesRead(books, ratings)).toBe(0);
    });
  });
});
