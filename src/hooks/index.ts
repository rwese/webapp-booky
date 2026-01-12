/**
 * Barcode Scanner Hooks Index
 *
 * Barrel export file for all barcode scanning related hooks.
 */

export { useBarcodeScanner } from './useBarcodeScanner';
export { useManualISBNEntry } from './useManualISBNEntry';
export { useBatchScanning } from './useBatchScanning';
export { useBookLookup } from './useBookLookup';
export { useBookMetadataRefresh } from './useBookMetadataRefresh';

// Re-export utilities
export * from '../lib/barcodeUtils';
