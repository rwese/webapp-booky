/**
 * Barcode and ISBN Utility Functions
 * 
 * Utility functions for barcode format handling and ISBN validation/formatting.
 */

// Barcode format constants
export const barcodeFormats = {
  EAN_13: 'ean_13' as const,
  EAN_8: 'ean_8' as const,
  UPC_A: 'upc_a' as const,
  UPC_E: 'upc_e' as const,
  CODE_128: 'code_128' as const,
  CODE_39: 'code_39' as const
};

export type BarcodeFormat = typeof barcodeFormats[keyof typeof barcodeFormats];

// ISBN validation
export const validateISBN = (input: string): { isValid: boolean; isISBN10: boolean; isISBN13: boolean } => {
  const cleaned = input.replace(/[-\s]/g, '');
  
  // ISBN-13 validation
  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const isValid = checkDigit === parseInt(cleaned[12]);
    return { isValid, isISBN10: false, isISBN13: isValid };
  }

  // ISBN-10 validation
  if (cleaned.length === 10 && /^\d{9}[\dX]$/i.test(cleaned)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * (10 - i);
    }
    const checkDigit = cleaned[9].toUpperCase() === 'X' ? 10 : parseInt(cleaned[9]);
    const isValid = ((sum + checkDigit) % 11) === 0;
    return { isValid, isISBN10: isValid, isISBN13: false };
  }

  return { isValid: false, isISBN10: false, isISBN13: false };
};

// ISBN formatting with hyphens
export const formatISBN = (input: string): string => {
  const cleaned = input.replace(/[-\s]/g, '');
  
  // ISBN-13 format: 978-XX-XXX-XXXX-X or 979-XX-XXX-XXXX-X
  if (cleaned.length === 13) {
    if (cleaned.startsWith('978')) {
      return cleaned.replace(/^(\d{3})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
    } else if (cleaned.startsWith('979')) {
      return cleaned.replace(/^(\d{4})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
    }
  }

  // ISBN-10 format: X-XXXX-XXXX-X
  if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4');
  }

  return input;
};

// ISBN-10 to ISBN-13 conversion
export const isbn10ToIsbn13 = (isbn10: string): string => {
  const cleaned = isbn10.replace(/[-\s]/g, '');
  if (cleaned.length !== 10) return '';
  
  const prefix = '978';
  const baseISBN = prefix + cleaned.substring(0, 9);
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(baseISBN[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return baseISBN + checkDigit;
};

// Validate ISBN format and check digit
export const isValidIsbn = (input: string): boolean => {
  const validation = validateISBN(input);
  return validation.isValid;
};

// Normalize ISBN (remove hyphens/spaces and validate)
export const normalizeIsbn = (input: string): string | null => {
  const cleaned = input.replace(/[-\s]/g, '');
  
  // Try as ISBN-13 first
  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
    const validation = validateISBN(cleaned);
    return validation.isValid ? cleaned : null;
  }
  
  // Try as ISBN-10
  if (cleaned.length === 10 && /^\d{9}[\dX]$/i.test(cleaned)) {
    const validation = validateISBN(cleaned);
    if (validation.isValid) {
      return isbn10ToIsbn13(cleaned);
    }
    return null;
  }
  
  return null;
};

// Clean ISBN (remove hyphens and spaces)
export const cleanISBN = (input: string): string => {
  return input.replace(/[-\s]/g, '');
};

// ISBN type detection
export const isISBN10 = (input: string): boolean => {
  const cleaned = input.replace(/[-\s]/g, '');
  return cleaned.length === 10 && /^\d{9}[\dX]$/i.test(cleaned);
};

export const isISBN13 = (input: string): boolean => {
  const cleaned = input.replace(/[-\s]/g, '');
  return cleaned.length === 13 && /^\d{13}$/.test(cleaned);
};

// Scan result types
export interface ScanResult {
  text: string;
  format: string;
  timestamp: Date;
}

// Scan configuration
export interface ScanConfig {
  enabled: boolean;
  cameraFacing: 'environment' | 'user';
  autoScan: boolean;
  scanInterval: number;
  formats: string[];
}

// Default scan configuration
export const defaultScanConfig: ScanConfig = {
  enabled: true,
  cameraFacing: 'environment',
  autoScan: true,
  scanInterval: 500,
  formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
};

// Scan state
export interface ScanState {
  isScanning: boolean;
  lastScan: ScanResult | null;
  error: string | null;
  cameraDevices: MediaDeviceInfo[];
  selectedDevice: string | null;
  flashEnabled: boolean;
  cameraStatus?: 'initializing' | 'ready' | 'streaming' | 'active' | 'error';
}

// Manual entry configuration
export interface ManualEntryConfig {
  autoFormat: boolean;
  validateISBN: boolean;
  autoLookup: boolean;
}

// Default manual entry configuration
export const defaultManualEntryConfig: ManualEntryConfig = {
  autoFormat: true,
  validateISBN: true,
  autoLookup: true
};

// Batch scan types
export interface ScanQueueItem {
  id: string;
  isbn: string; // ISBN-13 (canonical field)
  status: 'pending' | 'success' | 'error' | 'duplicate' | 'created';
  bookData?: any;
  error?: string;
  scannedAt: Date;
}

export interface BatchScanState {
  queue: ScanQueueItem[];
  isProcessing: boolean;
  currentProgress: number;
  totalItems: number;
  errors: string[];
}

export interface BatchScanConfig {
  maxQueueSize: number;
  autoProcess: boolean;
  showProgress: boolean;
  confirmBeforeAdd: boolean;
}

// Default batch scan configuration
export const defaultBatchScanConfig: BatchScanConfig = {
  maxQueueSize: 100,
  autoProcess: false,
  showProgress: true,
  confirmBeforeAdd: false
};
