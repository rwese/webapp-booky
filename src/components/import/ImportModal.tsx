import React, { useState, useCallback } from 'react';
import { ImportPreview } from './ImportPreview';
import { ImportProgressDisplay } from './ImportProgress';
import { bookImportService } from '../../lib/importService';
import type { ImportBookData, ImportProgress, ImportResult } from '../../types';

type ImportStep = 'select' | 'preview' | 'importing' | 'complete';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importData?: ImportBookData[];
}

export function ImportModal({ isOpen, onClose, importData: initialData }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [importData, setImportData] = useState<ImportBookData[]>(initialData || []);
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0,
    current: 0,
    status: 'idle',
    errors: []
  });
  const [result, setResult] = useState<ImportResult | undefined>();

  // Handle ZIP file import
  const handleZipFile = useCallback(async (file: File) => {
    setStep('importing');
    
    const progressCallback = (progressData: ImportProgress) => {
      setProgress(progressData);
    };

    bookImportService.setProgressCallback(progressCallback);

    try {
      const importResult = await bookImportService.importFromZip(file, {
        skipDuplicates: true,
        onProgress: progressCallback
      });

      setResult(importResult);
      setStep('complete');
    } catch (error) {
      console.error('ZIP import failed:', error);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        errors: [{ 
          bookId: 'unknown', 
          title: 'Import failed', 
          error: error instanceof Error ? error.message : 'Unknown error. Make sure the ZIP contains a valid metadata.json file.' 
        }]
      }));
    }
  }, []);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Check if it's a ZIP file
    if (file.name.endsWith('.zip')) {
      await handleZipFile(file);
      return;
    }

    // Handle JSON file (metadata.json)
    if (file.name !== 'metadata.json') {
      alert('Please select either a ZIP file or the metadata.json file from the booknotes-export folder');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const books = data.books || data;
        
        if (Array.isArray(books) && books.length > 0) {
          setImportData(books);
          setStep('preview');
        } else {
          alert('No books found in the selected file');
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Failed to parse the JSON file. Please check the format.');
      }
    };
    reader.readAsText(file);
  }, [handleZipFile]);

  const handleImport = useCallback(async (options: { skipDuplicates: boolean }) => {
    setStep('importing');
    
    const progressCallback = (progressData: ImportProgress) => {
      setProgress(progressData);
    };

    bookImportService.setProgressCallback(progressCallback);

    try {
      const importResult = await bookImportService.importBooks(importData, {
        skipDuplicates: options.skipDuplicates,
        onProgress: progressCallback
      });

      setResult(importResult);
      setStep('complete');
    } catch (error) {
      console.error('Import failed:', error);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        errors: [{ bookId: 'unknown', title: 'Import failed', error: error instanceof Error ? error.message : 'Unknown error' }]
      }));
    }
  }, [importData]);

  const handleReset = () => {
    setStep('select');
    setImportData([]);
    setProgress({
      total: 0,
      current: 0,
      status: 'idle',
      errors: []
    });
    setResult(undefined);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Import Books</h2>
          <button 
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {step === 'select' && (
            <div className="text-center py-8">
              <div className="mb-6">
                <div className="text-4xl mb-2">📚</div>
                <h3 className="text-lg font-semibold mb-2">Import from booknotes-export</h3>
                <p className="text-gray-600">
                  Select a ZIP file or the metadata.json file from your booknotes-export folder
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                <h4 className="font-medium mb-2">Supported formats:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1 rounded">.zip</code> - ZIP archive (recommended - includes cover images)</li>
                  <li>• <code className="bg-gray-200 px-1 rounded">metadata.json</code> - JSON file with book data</li>
                </ul>
                <div className="mt-3 text-sm text-gray-500">
                  Expected ZIP structure:
                  <ul className="ml-4 space-y-1 mt-1">
                    <li>• <code className="bg-gray-200 px-1 rounded">metadata.json</code> - Contains book data</li>
                    <li>• <code className="bg-gray-200 px-1 rounded">cover_images/</code> - Folder with cover images</li>
                  </ul>
                </div>
              </div>

              <div className="mb-4">
                <label className="btn btn-primary cursor-pointer">
                  Select File
                  <input
                    type="file"
                    accept=".zip,.json"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="text-sm text-gray-500">
                The import will include books, ratings, reading status, tags, and cover images.
              </p>
            </div>
          )}

          {step === 'preview' && importData && (
            <ImportPreview
              importData={importData}
              onImport={handleImport}
              onCancel={handleReset}
            />
          )}

          {step === 'importing' && (
            <ImportProgressDisplay
              progress={progress}
              result={result}
              onComplete={handleClose}
            />
          )}

          {step === 'complete' && result && (
            <div className="text-center py-8">
              {result.success ? (
                <>
                  <div className="text-5xl mb-4">🎉</div>
                  <h3 className="text-xl font-semibold mb-2">Import Successful!</h3>
                  <p className="text-gray-600 mb-4">
                    Successfully imported {result.imported} books
                    {result.skipped > 0 && ` (${result.skipped} duplicates skipped)`}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">⚠️</div>
                  <h3 className="text-xl font-semibold mb-2">Import Completed with Issues</h3>
                  <p className="text-gray-600 mb-4">
                    Imported {result.imported} books, but {result.failed} failed
                  </p>
                </>
              )}

              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4 mb-4 text-left max-h-40 overflow-y-auto">
                  <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                  {result.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700 py-1">
                      • {error.title}: {error.error}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleClose} className="btn btn-primary">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple import button component for easy integration
export function ImportButton({ onImport }: { onImport: (data: ImportBookData[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleImportComplete = (data: ImportBookData[]) => {
    onImport(data);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary flex items-center gap-2"
      >
        <span>📥</span>
        Import Books
      </button>
      
      <ImportModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
