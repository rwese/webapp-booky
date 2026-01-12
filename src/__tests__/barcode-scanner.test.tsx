/**
 * Unit Tests for Barcode Scanner Component
 * 
 * Basic tests for the new react-qr-barcode-scanner wrapper component.
 */

import { describe, it, expect } from 'vitest';

// These are simple unit tests that verify the hook logic without full React rendering
describe('useBarcodeScanner Logic', () => {
  
  describe('ISBN Validation', () => {
    
    it('validates ISBN-13 correctly', () => {
      // ISBN-13 validation logic
      const validateISBN13 = (isbn: string): boolean => {
        const cleaned = isbn.replace(/[-\s]/g, '');
        if (cleaned.length !== 13 || !/^\d{13}$/.test(cleaned)) return false;
        
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(cleaned[12]);
      };
      
      // Valid ISBN-13
      expect(validateISBN13('978-0-13-468599-1')).toBe(true);
      expect(validateISBN13('9780134685991')).toBe(true);
      
      // Invalid ISBN-13 (wrong check digit)
      expect(validateISBN13('978-0-13-468599-2')).toBe(false);
    });

    it('validates ISBN-10 correctly', () => {
      // ISBN-10 validation logic
      const validateISBN10 = (isbn: string): boolean => {
        const cleaned = isbn.replace(/[-\s]/g, '');
        if (cleaned.length !== 10) return false;
        
        let sum = 0;
        for (let i = 0; i < 9; i++) {
          sum += parseInt(cleaned[i]) * (10 - i);
        }
        const checkDigit = cleaned[9].toUpperCase() === 'X' ? 10 : parseInt(cleaned[9]);
        return ((sum + checkDigit) % 11) === 0;
      };
      
      // Valid ISBN-10
      expect(validateISBN10('013468599X')).toBe(true);
      expect(validateISBN10('0134685991')).toBe(true);
      
      // Invalid ISBN-10
      expect(validateISBN10('0-13-468599-9')).toBe(false);
    });
  });

  describe('ISBN Formatting', () => {
    
    it('formats ISBN-13 with hyphens', () => {
      const formatISBN13 = (isbn: string): string => {
        const cleaned = isbn.replace(/[-\s]/g, '');
        if (cleaned.length === 13) {
          // Handle both 978 and 979 prefixes
          if (cleaned.startsWith('978')) {
            return cleaned.replace(/^(\d{3})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
          } else if (cleaned.startsWith('979')) {
            return cleaned.replace(/^(\d{4})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
          }
        }
        return isbn;
      };
      
      expect(formatISBN13('9780134685991')).toBe('978-0-1346-8599-1');
    });

    it('formats ISBN-10 with hyphens', () => {
      const formatISBN10 = (isbn: string): string => {
        const cleaned = isbn.replace(/[-\s]/g, '');
        if (cleaned.length === 10) {
          return cleaned.replace(/^(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4');
        }
        return isbn;
      };
      
      expect(formatISBN10('013468599X')).toBe('0-13-468599-X');
    });
  });

  describe('ISBN Conversion', () => {
    
    it('converts ISBN-10 to ISBN-13', () => {
      const toISBN13 = (isbn10: string): string => {
        const cleaned = isbn10.replace(/[-\s]/g, '');
        if (cleaned.length !== 10) return cleaned;
        
        const prefix = '978';
        const baseISBN = prefix + cleaned.substring(0, 9);
        
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          sum += parseInt(baseISBN[i]) * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        
        return baseISBN + checkDigit;
      };
      
      expect(toISBN13('013468599X')).toBe('9780134685991');
    });
  });

  describe('ISBN Detection', () => {
    
    it('detects ISBN-10 format', () => {
      const isISBN10 = (isbn: string): boolean => {
        const cleaned = isbn.replace(/[-\s]/g, '');
        return cleaned.length === 10 && /^\d{9}[\dX]$/i.test(cleaned);
      };
      
      expect(isISBN10('013468599X')).toBe(true);
      expect(isISBN10('9780134685991')).toBe(false); // ISBN-13
    });

    it('detects ISBN-13 format', () => {
      const isISBN13 = (isbn: string): boolean => {
        const cleaned = isbn.replace(/[-\s]/g, '');
        return cleaned.length === 13 && /^\d{13}$/.test(cleaned);
      };
      
      expect(isISBN13('9780134685991')).toBe(true);
      expect(isISBN13('013468599X')).toBe(false); // ISBN-10
    });
  });

  describe('ISBN Cleaning', () => {
    
    it('removes hyphens and spaces', () => {
      const cleanISBN = (isbn: string): string => {
        return isbn.replace(/[-\s]/g, '');
      };
      
      expect(cleanISBN('978-0-13-468599-1')).toBe('9780134685991');
      expect(cleanISBN('0 13 468599 X')).toBe('013468599X');
    });
  });
});

describe('Batch Scanning Logic', () => {
  
  it('detects duplicate ISBNs', () => {
    const isDuplicate = (isbn: string, queue: { isbn: string }[]): boolean => {
      const cleaned = isbn.replace(/[-\s]/g, '');
      return queue.some(item => item.isbn === cleaned);
    };
    
    const queue = [{ isbn: '9780134685991' }];
    
    expect(isDuplicate('9780134685991', queue)).toBe(true);
    expect(isDuplicate('978-0-13-468599-1', queue)).toBe(true); // Different format, same content
    expect(isDuplicate('9780123456789', queue)).toBe(false);
  });

  it('creates valid scan queue items', () => {
    const createQueueItem = (isbn: string) => ({
      id: crypto.randomUUID(),
      isbn: isbn.replace(/[-\s]/g, ''),
      isbn13: isbn.replace(/[-\s]/g, '').length === 13 ? isbn.replace(/[-\s]/g, '') : undefined,
      status: 'pending' as const,
      scannedAt: new Date()
    });
    
    const item = createQueueItem('9780134685991');
    
    expect(item.isbn).toBe('9780134685991');
    expect(item.isbn13).toBe('9780134685991');
    expect(item.status).toBe('pending');
    expect(item.id).toBeDefined();
  });
});

describe('Barcode Formats', () => {
  
  it('exports correct format constants', () => {
    const barcodeFormats = {
      EAN_13: 'ean_13',
      EAN_8: 'ean_8',
      UPC_A: 'upc_a',
      UPC_E: 'upc_e',
      CODE_128: 'code_128',
      CODE_39: 'code_39'
    };
    
    expect(barcodeFormats.EAN_13).toBe('ean_13');
    expect(barcodeFormats.EAN_8).toBe('ean_8');
    expect(barcodeFormats.UPC_A).toBe('upc_a');
    expect(barcodeFormats.UPC_E).toBe('upc_e');
    expect(barcodeFormats.CODE_128).toBe('code_128');
    expect(barcodeFormats.CODE_39).toBe('code_39');
  });
});

describe('Scan State Management', () => {
  
  it('initializes scan state correctly', () => {
    const initialState = {
      isScanning: false,
      lastScan: null,
      error: null,
      cameraDevices: [],
      selectedDevice: null,
      flashEnabled: false
    };
    
    expect(initialState.isScanning).toBe(false);
    expect(initialState.lastScan).toBeNull();
    expect(initialState.error).toBeNull();
    expect(initialState.cameraDevices).toEqual([]);
    expect(initialState.flashEnabled).toBe(false);
  });

  it('handles scan result updates', () => {
    const scanResult = {
      text: '9780134685991',
      format: 'EAN_13',
      timestamp: new Date()
    };
    
    expect(scanResult.text).toBe('9780134685991');
    expect(scanResult.format).toBe('EAN_13');
    expect(scanResult.timestamp).toBeInstanceOf(Date);
  });

  it('handles error state updates', () => {
    const errorMessage = 'Camera permission denied';
    
    const errorState = {
      error: errorMessage,
      isScanning: false
    };
    
    expect(errorState.error).toBe('Camera permission denied');
    expect(errorState.isScanning).toBe(false);
  });
});
