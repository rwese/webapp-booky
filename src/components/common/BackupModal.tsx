/**
 * Backup Modal Component
 * UI for backup and restore operations
 */

import React, { useState, useCallback } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useBackup } from '../../hooks/useBackup';
import { Modal } from './Modal';
import type { ImportResult } from '../../types/backup';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const { isExporting, isImporting, error, exportBackup, importBackup, clearError } = useBackup();
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleExport = useCallback(async () => {
    const result = await exportBackup();
    if (result.success) {
      // Success handled in hook
    }
  }, [exportBackup]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      alert('Please select a valid backup ZIP file');
      return;
    }

    const result = await importBackup(file);
    setImportResult(result);
  }, [importBackup]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleClose = useCallback(() => {
    setImportResult(null);
    clearError();
    onClose();
  }, [clearError, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Backup & Restore" size="md">
      <div className="space-y-6">
        {/* Export Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Download size={20} />
            Export Backup
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Export your entire library including books, tags, collections, and cover images.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={20} />
                Export Backup
              </>
            )}
          </button>
        </div>

        {/* Import Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Upload size={20} />
            Import Backup
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Import from a previously exported backup file. Duplicate books will be skipped.
          </p>

          {!importResult ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {isImporting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={32} className="animate-spin text-primary-600" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Importing...</p>
                </div>
              ) : (
                <>
                  <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Drag and drop your backup ZIP file here, or
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors">
                    <Upload size={16} />
                    Choose File
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          ) : (
            /* Import Result */
            <div className={`border rounded-lg p-4 ${
              importResult.success
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {importResult.success ? (
                  <CheckCircle size={20} className="text-green-600" />
                ) : (
                  <AlertCircle size={20} className="text-red-600" />
                )}
                <span className={`font-medium ${
                  importResult.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {importResult.success ? 'Import Complete' : 'Import Completed with Errors'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{importResult.imported}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Imported</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{importResult.skipped}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Skipped</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{importResult.failed}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Failed</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-1">Errors:</p>
                  {importResult.errors.slice(0, 3).map((err: { bookId: string; title: string; error: string }, index: number) => (
                    <p key={`${err.bookId}-${index}`} className="text-xs text-red-600 dark:text-red-400">
                      • {err.title}: {err.error}
                    </p>
                  ))}
                  {importResult.errors.length > 3 && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      ...and {importResult.errors.length - 3} more errors
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setImportResult(null)}
                className="mt-3 w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Import Another File
              </button>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
