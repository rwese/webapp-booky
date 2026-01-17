import { describe, it, expect } from 'vitest';
import {
  compareBooks,
  mergeBooks,
  getMergePreview,
  getMergeSummary,
  getDefaultFieldActions,
  validateMergeResult,
  type MergeAction,
  type MergeStrategy,
} from '../lib/mergeUtils';
import type { Book, BookFormat } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockBook(overrides: Partial<Book> = {}): Book {
  const now = new Date();
  return {
    id: 'test-id-123',
    title: 'Test Book',
    subtitle: 'A Test Subtitle',
    authors: ['Test Author'],
    isbn13: '9781234567890',
    coverUrl: 'https://example.com/cover.jpg',
    localCoverPath: undefined,
    description: 'A test description',
    publisher: 'Test Publisher',
    publishedYear: 2023,
    publishedDate: '2023-01-15',
    pageCount: 300,
    format: 'physical' as BookFormat,
    addedAt: now,
    externalIds: {
      openLibrary: 'OL12345M',
      googleBooks: 'abc123',
    },
    lastSyncedAt: undefined,
    needsSync: false,
    localOnly: true,
    subjects: ['Fiction', 'Test'],
    languageCode: 'en',
    categories: ['Novel'],
    averageRating: 4.5,
    seriesName: undefined,
    seriesVolume: undefined,
    edition: undefined,
    ...overrides,
  };
}

// ============================================================================
// compareBooks Tests
// ============================================================================

describe('compareBooks', () => {
  it('should identify matching fields as non-conflicting', () => {
    const book1 = createMockBook({ title: 'Same Title', authors: ['Same Author'] });
    const book2 = createMockBook({ title: 'Same Title', authors: ['Same Author'] });

    const comparisons = compareBooks(book1, book2);
    const titleComparison = comparisons.find((c) => c.field === 'title');
    const authorsComparison = comparisons.find((c) => c.field === 'authors');

    expect(titleComparison?.hasConflict).toBe(false);
    expect(titleComparison?.hasExisting).toBe(true);
    expect(titleComparison?.hasFetched).toBe(true);
    expect(authorsComparison?.hasConflict).toBe(false);
  });

  it('should identify different fields as conflicts', () => {
    const existing = createMockBook({ title: 'Existing Title' });
    const fetched = createMockBook({ title: 'Fetched Title' });

    const comparisons = compareBooks(existing, fetched);
    const titleComparison = comparisons.find((c) => c.field === 'title');

    expect(titleComparison?.hasConflict).toBe(true);
    expect(titleComparison?.existing).toBe('Existing Title');
    expect(titleComparison?.fetched).toBe('Fetched Title');
  });

  it('should identify empty vs populated fields correctly', () => {
    const existing = createMockBook({ description: 'Existing description' });
    const fetched = createMockBook({ description: undefined });

    const comparisons = compareBooks(existing, fetched);
    const descComparison = comparisons.find((c) => c.field === 'description');

    expect(descComparison?.hasExisting).toBe(true);
    expect(descComparison?.hasFetched).toBe(false);
    expect(descComparison?.hasConflict).toBe(false);
  });

  it('should handle array fields correctly', () => {
    const existing = createMockBook({ authors: ['Author A', 'Author B'] });
    const fetched = createMockBook({ authors: ['Author C'] });

    const comparisons = compareBooks(existing, fetched);
    const authorsComparison = comparisons.find((c) => c.field === 'authors');

    expect(authorsComparison?.hasConflict).toBe(true);
    expect(authorsComparison?.existing).toEqual(['Author A', 'Author B']);
    expect(authorsComparison?.fetched).toEqual(['Author C']);
  });

  it('should return comparisons for all merge fields', () => {
    const book1 = createMockBook();
    const book2 = createMockBook();

    const comparisons = compareBooks(book1, book2);

    // Should have entries for all MERGE_FIELDS
    expect(comparisons.length).toBeGreaterThan(10);
    expect(comparisons.some((c) => c.field === 'title')).toBe(true);
    expect(comparisons.some((c) => c.field === 'authors')).toBe(true);
    expect(comparisons.some((c) => c.field === 'publisher')).toBe(true);
  });
});

// ============================================================================
// getMergePreview Tests
// ============================================================================

describe('getMergePreview', () => {
  it('should correctly identify empty fields that will be filled', () => {
    const existing = createMockBook({ description: undefined, subjects: [] });
    const fetched = createMockBook({
      description: 'New description',
      subjects: ['New Subject'],
    });

    const preview = getMergePreview(existing, fetched);

    expect(preview.emptyFields).toContain('description');
    expect(preview.emptyFields).toContain('subjects');
    expect(preview.emptyFields.length).toBeGreaterThan(0);
  });

  it('should correctly identify conflicts', () => {
    const existing = createMockBook({ title: 'Existing Title', publisher: 'Publisher A' });
    const fetched = createMockBook({ title: 'Fetched Title', publisher: 'Publisher B' });

    const preview = getMergePreview(existing, fetched);

    expect(preview.conflicts).toContain('title');
    expect(preview.conflicts).toContain('publisher');
  });

  it('should return empty conflicts when books are identical', () => {
    const book = createMockBook();
    const preview = getMergePreview(book, book);

    expect(preview.conflicts.length).toBe(0);
  });

  it('should count total and fields with data correctly', () => {
    const existing = createMockBook({ title: 'Title' });
    const fetched = createMockBook({ title: 'Title', subtitle: undefined });

    const preview = getMergePreview(existing, fetched);

    expect(preview.totalFields).toBeGreaterThan(0);
    expect(preview.fieldsWithData).toBeGreaterThan(0);
  });
});

// ============================================================================
// mergeBooks Tests
// ============================================================================

describe('mergeBooks', () => {
  it('should keep existing values with keep-existing strategy', () => {
    const existing = createMockBook({ title: 'Existing Title', publisher: 'Existing Publisher' });
    const fetched = createMockBook({ title: 'Fetched Title', publisher: 'Fetched Publisher' });

    const merged = mergeBooks(existing, fetched, 'keep-existing');

    expect(merged.title).toBe('Existing Title');
    expect(merged.publisher).toBe('Existing Publisher');
  });

  it('should use fetched values with keep-fetched strategy', () => {
    const existing = createMockBook({ title: 'Existing Title', publisher: 'Existing Publisher' });
    const fetched = createMockBook({ title: 'Fetched Title', publisher: 'Fetched Publisher' });

    const merged = mergeBooks(existing, fetched, 'keep-fetched');

    expect(merged.title).toBe('Fetched Title');
    expect(merged.publisher).toBe('Fetched Publisher');
  });

  it('should fill empty fields with fill-empty strategy', () => {
    const existing = createMockBook({ title: 'Title', description: undefined });
    const fetched = createMockBook({ title: 'Title', description: 'New Description' });

    const merged = mergeBooks(existing, fetched, 'fill-empty');

    expect(merged.title).toBe('Title');
    expect(merged.description).toBe('New Description');
  });

  it('should not overwrite existing values with fill-empty strategy', () => {
    const existing = createMockBook({ title: 'Existing Title', description: 'Existing Desc' });
    const fetched = createMockBook({ title: 'Fetched Title', description: 'Fetched Desc' });

    const merged = mergeBooks(existing, fetched, 'fill-empty');

    expect(merged.title).toBe('Existing Title');
    expect(merged.description).toBe('Existing Desc');
  });

  it('should respect field-specific actions with selective strategy', () => {
    const existing = createMockBook({
      title: 'Existing Title',
      publisher: 'Existing Publisher',
      description: 'Existing Description',
    });
    const fetched = createMockBook({
      title: 'Fetched Title',
      publisher: 'Fetched Publisher',
      description: 'Fetched Description',
    });

    const fieldActions: Record<string, MergeAction> = {
      title: 'keep-existing',
      publisher: 'copy-fetched',
      description: 'apply-if-empty',
    };

    const merged = mergeBooks(existing, fetched, 'selective', fieldActions);

    expect(merged.title).toBe('Existing Title');
    expect(merged.publisher).toBe('Fetched Publisher');
    expect(merged.description).toBe('Existing Description');
  });

  it('should preserve immutable fields', () => {
    const existing = createMockBook();
    const fetched = createMockBook({ id: 'different-id' });

    const merged = mergeBooks(existing, fetched, 'keep-fetched');

    expect(merged.id).toBe(existing.id);
    expect(merged.addedAt).toBe(existing.addedAt);
  });

  it('should merge externalIds', () => {
    const existing = createMockBook({
      externalIds: { openLibrary: 'OL123', googleBooks: 'GB123' },
    });
    const fetched = createMockBook({
      externalIds: { openLibrary: 'OL456', oclcNumber: 'OCLC123' },
    });

    const merged = mergeBooks(existing, fetched, 'keep-fetched');

    expect(merged.externalIds.openLibrary).toBe('OL456');
    expect(merged.externalIds.googleBooks).toBe('GB123');
    expect(merged.externalIds.oclcNumber).toBe('OCLC123');
  });

  it('should set needsSync flag after merge', () => {
    const existing = createMockBook({ needsSync: false });
    const fetched = createMockBook();

    const merged = mergeBooks(existing, fetched, 'keep-existing');

    expect(merged.needsSync).toBe(true);
    expect(merged.lastSyncedAt).toBeUndefined();
  });

  it('should merge arrays with deduplication', () => {
    const existing = createMockBook({ authors: ['Author A', 'Author B'] });
    const fetched = createMockBook({ authors: ['Author B', 'Author C'] });

    const merged = mergeBooks(existing, fetched, 'selective', {
      authors: 'copy-fetched',
    });

    expect(merged.authors).toContain('Author A');
    expect(merged.authors).toContain('Author B');
    expect(merged.authors).toContain('Author C');
    expect(merged.authors?.length).toBe(3);
  });
});

// ============================================================================
// getMergeSummary Tests
// ============================================================================

describe('getMergeSummary', () => {
  it('should correctly count changes, conflicts, and filled fields', () => {
    const existing = createMockBook({
      title: 'Existing',
      description: undefined,
      subjects: [],
    });
    const fetched = createMockBook({
      title: 'Fetched',
      description: 'New Desc',
      subjects: ['New Subject'],
    });

    const summary = getMergeSummary(existing, fetched);

    expect(summary.willChange).toBeGreaterThan(0);
    expect(summary.conflicts).toBeGreaterThan(0);
    expect(summary.emptyFilled).toBeGreaterThan(0);
  });
});

// ============================================================================
// getDefaultFieldActions Tests
// ============================================================================

describe('getDefaultFieldActions', () => {
  it('should return copy-fetched for empty existing fields', () => {
    const existing = createMockBook({ description: undefined });
    const fetched = createMockBook({ description: 'New Description' });

    const actions = getDefaultFieldActions(existing, fetched, 'selective');

    expect(actions.description).toBe('copy-fetched');
  });

  it('should return keep-existing for conflicting fields with selective strategy', () => {
    const existing = createMockBook({ title: 'Existing' });
    const fetched = createMockBook({ title: 'Fetched' });

    const actions = getDefaultFieldActions(existing, fetched, 'selective');

    expect(actions.title).toBe('keep-existing');
  });

  it('should return copy-fetched for keep-fetched strategy', () => {
    const existing = createMockBook({ title: 'Existing' });
    const fetched = createMockBook({ title: 'Fetched' });

    const actions = getDefaultFieldActions(existing, fetched, 'keep-fetched');

    expect(actions.title).toBe('copy-fetched');
  });
});

// ============================================================================
// validateMergeResult Tests
// ============================================================================

describe('validateMergeResult', () => {
  it('should validate a correct book', () => {
    const book = createMockBook();

    const result = validateMergeResult(book);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should detect missing required fields', () => {
    const book = createMockBook({ title: '' });

    const result = validateMergeResult(book);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('should detect invalid rating values', () => {
    const book = createMockBook({ averageRating: 6 });

    const result = validateMergeResult(book);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('averageRating'))).toBe(true);
  });

  it('should detect invalid page count', () => {
    const book = createMockBook({ pageCount: -1 });

    const result = validateMergeResult(book);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('pageCount'))).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('mergeUtils edge cases', () => {
  it('should handle completely empty books', () => {
    const emptyBook: Book = {
      id: 'test',
      title: '',
      authors: [],
      format: 'physical',
      addedAt: new Date(),
      externalIds: {},
      needsSync: true,
      localOnly: true,
    };
    const populatedBook = createMockBook();

    const merged = mergeBooks(emptyBook, populatedBook, 'keep-fetched');

    expect(merged.title).toBe(populatedBook.title);
    expect(merged.authors).toEqual(populatedBook.authors);
  });

  it('should handle books with all identical fields', () => {
    const book = createMockBook();

    const merged = mergeBooks(book, book, 'keep-fetched');

    // When merging identical books, needsSync is set to true (marking as modified)
    // but all other fields should remain the same
    expect(merged.title).toBe(book.title);
    expect(merged.authors).toEqual(book.authors);
    expect(merged.publisher).toBe(book.publisher);
    expect(merged.needsSync).toBe(true); // Merge always marks as needing sync
  });

  it('should handle special characters in text fields', () => {
    const existing = createMockBook({
      title: 'Title with "quotes" & <brackets>',
      description: 'Description with\nnewlines',
    });
    const fetched = createMockBook({
      title: 'Other "quotes" & <brackets>',
      description: 'Other\nnewlines',
    });

    const merged = mergeBooks(existing, fetched, 'keep-existing');

    expect(merged.title).toBe(existing.title);
    expect(merged.description).toBe(existing.description);
  });

  it('should handle very long text fields', () => {
    const longDescription = 'a'.repeat(10000);
    const existing = createMockBook({ description: longDescription });
    const fetched = createMockBook({ description: 'Short' });

    const merged = mergeBooks(existing, fetched, 'keep-existing');

    expect(merged.description).toBe(longDescription);
  });
});
