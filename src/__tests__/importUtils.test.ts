import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createRatingFromImport, 
  validateImportBook,
  transformImportBook 
} from '../lib/importUtils';
import type { ImportBookData } from '../types';

// Helper to create ImportBookData
function createImportBook(overrides: Partial<ImportBookData> = {}): ImportBookData {
  return {
    id: 'test-id',
    title: 'Test Book',
    author: 'Test Author',
    readingStatus: 'Want to Read',
    tags: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    categoryIds: [],
    readingSessionIds: [],
    ...overrides
  };
}

describe('createRatingFromImport', () => {
  describe('half-star rating support', () => {
    it('should create rating with 0.5 stars', () => {
      const book = createImportBook({ rating: 0.5 });
      const rating = createRatingFromImport('book-1', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(0.5);
      expect(rating!.bookId).toBe('book-1');
      expect(rating!.containsSpoilers).toBe(false);
    });

    it('should create rating with 1.5 stars', () => {
      const book = createImportBook({ rating: 1.5 });
      const rating = createRatingFromImport('book-2', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(1.5);
    });

    it('should create rating with 2.5 stars', () => {
      const book = createImportBook({ rating: 2.5 });
      const rating = createRatingFromImport('book-3', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(2.5);
    });

    it('should create rating with 3.5 stars', () => {
      const book = createImportBook({ rating: 3.5 });
      const rating = createRatingFromImport('book-4', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(3.5);
    });

    it('should create rating with 4.5 stars', () => {
      const book = createImportBook({ rating: 4.5 });
      const rating = createRatingFromImport('book-5', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(4.5);
    });

    it('should create rating with 5.0 stars', () => {
      const book = createImportBook({ rating: 5.0 });
      const rating = createRatingFromImport('book-6', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(5.0);
    });
  });

  describe('whole star ratings', () => {
    it('should create rating with 1 star', () => {
      const book = createImportBook({ rating: 1 });
      const rating = createRatingFromImport('book-7', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(1);
    });

    it('should create rating with 3 stars', () => {
      const book = createImportBook({ rating: 3 });
      const rating = createRatingFromImport('book-8', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(3);
    });

    it('should create rating with 4 stars', () => {
      const book = createImportBook({ rating: 4 });
      const rating = createRatingFromImport('book-9', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(4);
    });
  });

  describe('review import support', () => {
    it('should create rating with review text', () => {
      const book = createImportBook({ 
        rating: 4.0,
        review: 'This was an amazing book!'
      });
      const rating = createRatingFromImport('book-10', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(4.0);
      expect(rating!.review).toBe('This was an amazing book!');
    });

    it('should create rating with review and containsSpoilers flag', () => {
      const book = createImportBook({ 
        rating: 3.5,
        review: 'Great plot twist at the end!',
        containsSpoilers: true
      });
      const rating = createRatingFromImport('book-11', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.stars).toBe(3.5);
      expect(rating!.review).toBe('Great plot twist at the end!');
      expect(rating!.containsSpoilers).toBe(true);
    });

    it('should default containsSpoilers to false when not provided', () => {
      const book = createImportBook({ 
        rating: 5.0,
        review: 'Perfect read!'
      });
      const rating = createRatingFromImport('book-12', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.containsSpoilers).toBe(false);
    });

    it('should handle reviewCreatedAt date', () => {
      const book = createImportBook({ 
        rating: 4.0,
        review: 'Wonderful!',
        reviewCreatedAt: '2024-06-15T10:30:00Z'
      });
      const rating = createRatingFromImport('book-13', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.reviewCreatedAt).toBeInstanceOf(Date);
      expect(rating!.reviewCreatedAt?.toISOString()).toBe('2024-06-15T10:30:00.000Z');
    });

    it('should handle invalid reviewCreatedAt gracefully', () => {
      const book = createImportBook({ 
        rating: 3.0,
        review: 'Good book',
        reviewCreatedAt: 'invalid-date'
      });
      const rating = createRatingFromImport('book-14', book);
      
      expect(rating).not.toBeNull();
      expect(rating!.reviewCreatedAt).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should return null when rating is undefined', () => {
      const book = createImportBook({ rating: undefined });
      const rating = createRatingFromImport('book-15', book);
      
      expect(rating).toBeNull();
    });

    it('should return null when rating is 0', () => {
      const book = createImportBook({ rating: 0 });
      const rating = createRatingFromImport('book-16', book);
      
      expect(rating).toBeNull();
    });

    it('should return null when rating is less than 0.5', () => {
      const book = createImportBook({ rating: 0.25 });
      const rating = createRatingFromImport('book-17', book);
      
      expect(rating).toBeNull();
    });

    it('should return null when rating is greater than 5', () => {
      const book = createImportBook({ rating: 5.5 });
      const rating = createRatingFromImport('book-18', book);
      
      expect(rating).toBeNull();
    });

    it('should return null when rating has invalid precision (e.g., 3.2)', () => {
      const book = createImportBook({ rating: 3.2 });
      const rating = createRatingFromImport('book-19', book);
      
      expect(rating).toBeNull();
    });

    it('should return null when rating has too many decimals (e.g., 3.52)', () => {
      const book = createImportBook({ rating: 3.52 });
      const rating = createRatingFromImport('book-20', book);
      
      expect(rating).toBeNull();
    });

    it('should return null when rating is negative', () => {
      const book = createImportBook({ rating: -1 });
      const rating = createRatingFromImport('book-21', book);
      
      expect(rating).toBeNull();
    });

    it('should return null when rating is 6', () => {
      const book = createImportBook({ rating: 6 });
      const rating = createRatingFromImport('book-22', book);
      
      expect(rating).toBeNull();
    });
  });
});

describe('validateImportBook', () => {
  describe('rating validation', () => {
    it('should pass validation for 0.5 rating', () => {
      const book = createImportBook({ rating: 0.5 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for 1.5 rating', () => {
      const book = createImportBook({ rating: 1.5 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });

    it('should pass validation for 2.5 rating', () => {
      const book = createImportBook({ rating: 2.5 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });

    it('should pass validation for 3.5 rating', () => {
      const book = createImportBook({ rating: 3.5 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });

    it('should pass validation for 4.5 rating', () => {
      const book = createImportBook({ rating: 4.5 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });

    it('should pass validation for 5.0 rating', () => {
      const book = createImportBook({ rating: 5.0 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });

    it('should fail validation for rating 0', () => {
      const book = createImportBook({ rating: 0 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rating must be between 0.5 and 5.0 in 0.5 increments');
    });

    it('should fail validation for rating greater than 5', () => {
      const book = createImportBook({ rating: 5.5 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rating must be between 0.5 and 5.0 in 0.5 increments');
    });

    it('should fail validation for rating with invalid precision (3.2)', () => {
      const book = createImportBook({ rating: 3.2 });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rating must be between 0.5 and 5.0 in 0.5 increments');
    });

    it('should pass validation when rating is undefined', () => {
      const book = createImportBook({ rating: undefined });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('required fields', () => {
    it('should fail when title is missing', () => {
      const book = createImportBook({ title: '' });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing title');
    });

    it('should fail when author is missing', () => {
      const book = createImportBook({ author: '' });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing author');
    });
  });

  describe('ISBN validation', () => {
    it('should pass validation for valid ISBN-13', () => {
      const book = createImportBook({ isbn: '978-0-13-468599-1' });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });

    it('should pass validation for valid ISBN-10', () => {
      const book = createImportBook({ isbn: '0-13-468599-X' });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(true);
    });

    it('should fail validation for invalid ISBN', () => {
      const book = createImportBook({ isbn: '12345' });
      const result = validateImportBook(book);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid ISBN format');
    });
  });
});

describe('transformImportBook', () => {
  it('should transform book with half-star rating', () => {
    const book = createImportBook({ 
      rating: 3.5,
      isbn: '978-0-13-468599-1',
      pageCount: 350
    });
    
    const result = transformImportBook(book);
    
    expect(result.book.title).toBe('Test Book');
    expect(result.rating).toBeDefined();
    expect(result.rating!.stars).toBe(3.5);
  });

  it('should transform book with review', () => {
    const book = createImportBook({ 
      rating: 4.0,
      review: 'Great book!',
      reviewCreatedAt: '2024-06-01T12:00:00Z'
    });
    
    const result = transformImportBook(book);
    
    expect(result.rating).toBeDefined();
    expect(result.rating!.review).toBe('Great book!');
    expect(result.rating!.reviewCreatedAt).toBeInstanceOf(Date);
  });

  it('should not include rating when rating is undefined', () => {
    const book = createImportBook({ rating: undefined });
    
    const result = transformImportBook(book);
    
    expect(result.rating).toBeUndefined();
  });

  it('should handle book without rating in validation errors', () => {
    const book = createImportBook({ 
      rating: undefined,
      title: '',
      author: ''
    });
    
    const result = transformImportBook(book);
    
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
