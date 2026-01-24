/**
 * Unit Tests for Core Library Functions
 * Tests barcode utilities, API functions, and core logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import functions to test
import {
  validateISBN,
  formatISBN,
  isbn10ToIsbn13,
  isValidIsbn,
  normalizeIsbn,
  cleanISBN,
  isISBN10,
  isISBN13,
  defaultScanConfig,
  defaultManualEntryConfig,
  defaultBatchScanConfig
} from '../../src/lib/barcodeUtils';

describe('BarcodeUtils - ISBN Validation', () => {
  describe('validateISBN', () => {
    it('should validate correct ISBN-13', () => {
      const result = validateISBN('978-0-13-468599-1');
      expect(result.isValid).toBe(true);
      expect(result.isISBN13).toBe(true);
      expect(result.isISBN10).toBe(false);
    });

    it('should validate correct ISBN-13 with 979 prefix', () => {
      const result = validateISBN('979-1-234567-89-6');
      expect(result.isValid).toBe(true);
      expect(result.isISBN13).toBe(true);
    });

    it('should reject invalid ISBN-13 with wrong check digit', () => {
      const result = validateISBN('978-0-13-468599-2');
      expect(result.isValid).toBe(false);
      expect(result.isISBN13).toBe(false);
    });

    it('should validate correct ISBN-10', () => {
      // ISBN-10: 0134685997 is valid (check digit should be 7, not 1)
      const result = validateISBN('0-13-468599-7');
      expect(result.isValid).toBe(true);
      expect(result.isISBN10).toBe(true);
      expect(result.isISBN13).toBe(false);
    });

    it('should validate ISBN-10 with X check digit', () => {
      // ISBN-10: 020161622X is valid (The Pragmatic Programmer)
      const result = validateISBN('0-20-161622-X');
      expect(result.isValid).toBe(true);
      expect(result.isISBN10).toBe(true);
    });

    it('should reject invalid ISBN-10 with wrong check digit', () => {
      // ISBN-10: 0134685991 has wrong check digit (should be 7)
      const result = validateISBN('0-13-468599-1');
      expect(result.isValid).toBe(false);
      expect(result.isISBN10).toBe(false);
    });

    it('should reject non-ISBN strings', () => {
      const result = validateISBN('not-an-isbn');
      expect(result.isValid).toBe(false);
      expect(result.isISBN10).toBe(false);
      expect(result.isISBN13).toBe(false);
    });

    it('should reject strings of wrong length', () => {
      expect(validateISBN('12345').isValid).toBe(false);
      expect(validateISBN('123456789012345').isValid).toBe(false);
    });

    it('should handle ISBN with hyphens and spaces', () => {
      const result = validateISBN('978 0-13-468599-1');
      expect(result.isValid).toBe(true);
      expect(result.isISBN13).toBe(true);
    });
  });

  describe('isValidIsbn', () => {
    it('should return true for valid ISBN-13', () => {
      expect(isValidIsbn('978-0-13-468599-1')).toBe(true);
    });

    it('should return true for valid ISBN-10', () => {
      // Use a valid ISBN-10: 0134685997
      expect(isValidIsbn('0-13-468599-7')).toBe(true);
    });

    it('should return false for invalid ISBN', () => {
      expect(isValidIsbn('invalid-isbn')).toBe(false);
      expect(isValidIsbn('978-0-13-468599-2')).toBe(false);
    });
  });

  describe('isISBN10', () => {
    it('should detect ISBN-10 format', () => {
      // Use valid ISBN-10: 0134685997
      expect(isISBN10('0-13-468599-7')).toBe(true);
      expect(isISBN10('0134685997')).toBe(true);
    });

    it('should reject ISBN-13 as ISBN-10', () => {
      expect(isISBN10('978-0-13-468599-1')).toBe(false);
    });

    it('should handle ISBN-10 with X', () => {
      expect(isISBN10('0-14-103614-X')).toBe(true);
    });
  });

  describe('isISBN13', () => {
    it('should detect ISBN-13 format', () => {
      expect(isISBN13('978-0-13-468599-1')).toBe(true);
      expect(isISBN13('9780134685991')).toBe(true);
    });

    it('should reject ISBN-10 as ISBN-13', () => {
      expect(isISBN13('0-13-468599-1')).toBe(false);
    });
  });
});

describe('BarcodeUtils - ISBN Formatting', () => {
  describe('formatISBN', () => {
    it('should format ISBN-13 with 978 prefix', () => {
      const result = formatISBN('9780134685991');
      expect(result).toBe('978-0-1346-8599-1');
    });

    it('should format ISBN-13 with 979 prefix', () => {
      const result = formatISBN('9791032706206');
      expect(result).toBe('979-1-0327-0620-6');
    });

    it('should format ISBN-10', () => {
      const result = formatISBN('0134685991');
      expect(result).toBe('0-1346-8599-1');
    });

    it('should handle ISBN with existing hyphens', () => {
      // When reformatting an already formatted ISBN, it should keep it consistent
      const result = formatISBN('978-0-13-468599-1');
      expect(result).toBe('978-0-1346-8599-1');
    });

    it('should return input for invalid ISBN', () => {
      expect(formatISBN('not-an-isbn')).toBe('not-an-isbn');
    });
  });

  describe('cleanISBN', () => {
    it('should remove hyphens', () => {
      expect(cleanISBN('978-0-13-468599-1')).toBe('9780134685991');
    });

    it('should remove spaces', () => {
      expect(cleanISBN('978 0 13 468599 1')).toBe('9780134685991');
    });

    it('should handle combined hyphens and spaces', () => {
      expect(cleanISBN('978 - 0 13 - 4685 99 - 1')).toBe('9780134685991');
    });
  });

  describe('normalizeIsbn', () => {
    it('should normalize valid ISBN-13', () => {
      const result = normalizeIsbn('978-0-13-468599-1');
      expect(result).toBe('9780134685991');
    });

    it('should convert valid ISBN-10 to ISBN-13', () => {
      // normalizeIsbn converts ISBN-10 to ISBN-13 by adding 978 prefix and recalculating check digit
      // ISBN-10: 0134685997 -> ISBN-13: 9780134685991
      const result = normalizeIsbn('0-13-468599-7');
      expect(result).toBe('9780134685991');
    });

    it('should return null for invalid ISBN', () => {
      expect(normalizeIsbn('invalid-isbn')).toBeNull();
      // Invalid ISBN-13 with wrong check digit
      expect(normalizeIsbn('978-0-13-468599-2')).toBeNull();
    });

    it('should return null for invalid ISBN-10', () => {
      // Invalid ISBN-10 with wrong check digit (should be 7, not 1)
      expect(normalizeIsbn('0-13-468599-1')).toBeNull();
    });

    it('should convert valid ISBN-10 with X to ISBN-13', () => {
      // Valid ISBN-10: 020161622X -> 9780201616224
      const result = normalizeIsbn('0-20-161622-X');
      expect(result).toBe('9780201616224');
    });
  });

  describe('isbn10ToIsbn13', () => {
    it('should convert valid ISBN-10 to ISBN-13', () => {
      const result = isbn10ToIsbn13('0134685991');
      expect(result).toBe('9780134685991');
    });

    it('should return empty string for invalid input', () => {
      expect(isbn10ToIsbn13('12345')).toBe('');
      expect(isbn10ToIsbn13('not-an-isbn')).toBe('');
    });

    it('should handle ISBN-10 with X check digit', () => {
      // Use a valid ISBN-10: 020161622X -> 9780201616224
      const result = isbn10ToIsbn13('020161622X');
      expect(result).toBe('9780201616224');
    });
  });
});

describe('BarcodeUtils - Default Configurations', () => {
  describe('defaultScanConfig', () => {
    it('should have correct default values', () => {
      expect(defaultScanConfig.enabled).toBe(true);
      expect(defaultScanConfig.cameraFacing).toBe('environment');
      expect(defaultScanConfig.autoScan).toBe(true);
      expect(defaultScanConfig.scanInterval).toBe(500);
      expect(defaultScanConfig.formats).toContain('ean_13');
      expect(defaultScanConfig.formats.length).toBe(6);
    });
  });

  describe('defaultManualEntryConfig', () => {
    it('should have correct default values', () => {
      expect(defaultManualEntryConfig.autoFormat).toBe(true);
      expect(defaultManualEntryConfig.validateISBN).toBe(true);
      expect(defaultManualEntryConfig.autoLookup).toBe(true);
    });
  });

  describe('defaultBatchScanConfig', () => {
    it('should have correct default values', () => {
      expect(defaultBatchScanConfig.maxQueueSize).toBe(100);
      expect(defaultBatchScanConfig.autoProcess).toBe(false);
      expect(defaultBatchScanConfig.showProgress).toBe(true);
      expect(defaultBatchScanConfig.confirmBeforeAdd).toBe(false);
    });
  });
});

describe('BarcodeUtils - Edge Cases', () => {
  it('should handle empty string', () => {
    expect(validateISBN('').isValid).toBe(false);
    expect(formatISBN('')).toBe('');
    expect(cleanISBN('')).toBe('');
    expect(normalizeIsbn('')).toBeNull();
  });

  it('should handle strings with only special characters', () => {
    expect(validateISBN('---').isValid).toBe(false);
    expect(cleanISBN('---')).toBe('');
  });

  it('should handle very long strings', () => {
    expect(validateISBN('12345678901234567890').isValid).toBe(false);
  });

  it('should handle strings with letters in numeric fields', () => {
    expect(validateISBN('978-0-13-46859A-1').isValid).toBe(false);
  });

  it('should handle ISBN-13 starting with wrong prefix', () => {
    // ISBN-13 must start with 978 or 979
    expect(validateISBN('123-0-13-468599-1').isValid).toBe(false);
  });

  it('should handle ISBN-10 check digit calculation edge cases', () => {
    // X check digit should be treated as 10
    // Use a known valid ISBN-10 with X: 020161622X (The Pragmatic Programmer)
    expect(isValidIsbn('0-20-161622-X')).toBe(true);
    expect(isValidIsbn('0-20-161622-x')).toBe(true);
  });
});

// Export for testing - removed empty export
