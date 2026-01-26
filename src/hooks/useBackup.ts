/**
 * Backup Hook
 * React hook for backup and restore operations
 */

import { useState, useCallback } from 'react';
import { exportBackup, importBackup } from '../lib/backup';
import type { ImportResult } from '../types/backup';

export function useBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastExport, setLastExport] = useState<Date | null>(null);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const { data, filename } = await exportBackup();

      // Download the ZIP file
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setLastExport(new Date());
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImport = useCallback(async (file: File) => {
    setIsImporting(true);
    setError(null);

    try {
      const result = await importBackup(file);
      setLastImport(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      setError(errorMessage);
      return {
        success: false,
        imported: 0,
        skipped: 0,
        failed: 1,
        errors: [{ bookId: 'unknown', title: 'Unknown', error: errorMessage }]
      };
    } finally {
      setIsImporting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isExporting,
    isImporting,
    lastExport,
    lastImport,
    error,
    exportBackup: handleExport,
    importBackup: handleImport,
    clearError
  };
}
