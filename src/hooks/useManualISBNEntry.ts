/**
 * Manual ISBN Entry Hook
 * 
 * Hook for managing manual ISBN input with validation and formatting.
 */

import { useState, useCallback } from 'react';
import { validateISBN, formatISBN, ManualEntryConfig, defaultManualEntryConfig } from '../lib/barcodeUtils';

export function useManualISBNEntry(config?: Partial<ManualEntryConfig>) {
  const [isbn, setIsbn] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [configState] = useState<ManualEntryConfig>({
    ...defaultManualEntryConfig,
    ...config
  });

  const validate = useCallback((input: string): boolean => {
    if (!configState.validateISBN) return true;
    return validateISBN(input).isValid;
  }, [configState.validateISBN]);

  const format = useCallback((input: string): string => {
    if (!configState.autoFormat) return input;
    return formatISBN(input);
  }, [configState.autoFormat]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = format(input);
    setIsbn(formatted);

    if (configState.validateISBN) {
      const valid = validate(formatted);
      setIsValid(valid);
      setError(valid ? null : 'Invalid ISBN format');
    }
  }, [format, validate, configState.validateISBN]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setError('Please enter a valid ISBN');
      return null;
    }

    setError(null);

    try {
      const cleanedISBN = isbn.replace(/[-\s]/g, '');
      
      // Emit event for book lookup
      window.dispatchEvent(new CustomEvent('book:lookup', { 
        detail: { isbn: cleanedISBN, isbn13: cleanedISBN.length === 13 ? cleanedISBN : null } 
      }));

      return cleanedISBN;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Lookup failed');
      return null;
    }
  }, [isbn, isValid]);

  const clearInput = useCallback(() => {
    setIsbn('');
    setIsValid(false);
    setError(null);
  }, []);

  return {
    isbn,
    setIsbn: handleChange,
    isValid,
    error,
    handleSubmit,
    clearInput,
    formatISBN: format,
    validateISBN: validate
  };
}
