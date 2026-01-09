import React, { useState, useEffect } from 'react';
import type { ImportBookData, ImportProgress } from '../../types';
import { bookImportService } from '../../lib/importService';
import { formatImportStatus, formatRatingForDisplay, validateImportBook } from '../../lib/importUtils';

interface ImportPreviewProps {
  importData: ImportBookData[];
  onImport: (options: { skipDuplicates: boolean }) => void;
  onCancel: () => void;
}

export function ImportPreview({ importData, onImport, onCancel }: ImportPreviewProps) {
  const [preview, setPreview] = useState<{
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    books: Array<{
      data: ImportBookData;
      isValid: boolean;
      errors: string[];
      isDuplicate: boolean;
      duplicateInfo?: string;
    }>;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  useEffect(() => {
    loadPreview();
  }, [importData]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const previewData = await bookImportService.previewImport(importData);
      setPreview(previewData);
    } catch (error) {
      console.error('Error loading preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    onImport({ skipDuplicates });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Analyzing import data...</span>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Failed to load preview</p>
        <button onClick={onCancel} className="mt-4 btn btn-secondary">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      {/* Summary Section */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3">Import Summary</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="bg-white rounded p-3 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{preview.total}</div>
            <div className="text-sm text-gray-600">Total Books</div>
          </div>
          <div className="bg-white rounded p-3 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{preview.valid}</div>
            <div className="text-sm text-gray-600">Valid</div>
          </div>
          <div className="bg-white rounded p-3 shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{preview.duplicates}</div>
            <div className="text-sm text-gray-600">Duplicates</div>
          </div>
          <div className="bg-white rounded p-3 shadow-sm">
            <div className="text-2xl font-bold text-red-600">{preview.invalid}</div>
            <div className="text-sm text-gray-600">Invalid</div>
          </div>
        </div>

        {/* Options */}
        <div className="mt-4 flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-gray-700">Skip duplicate books</span>
          </label>
        </div>
      </div>

      {/* Books List */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-700">Books to Import</h4>
        {preview.books.map((book, index) => (
          <BookPreviewItem key={index} book={book} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button 
          onClick={handleImport}
          disabled={preview.valid === 0}
          className="btn btn-primary"
        >
          Import {preview.valid} Books
          {skipDuplicates && preview.duplicates > 0 && ` (${preview.duplicates} duplicates skipped)`}
        </button>
      </div>
    </div>
  );
}

interface BookPreviewItemProps {
  book: {
    data: ImportBookData;
    isValid: boolean;
    errors: string[];
    isDuplicate: boolean;
    duplicateInfo?: string;
  };
}

function BookPreviewItem({ book }: BookPreviewItemProps) {
  const { data, isValid, errors, isDuplicate, duplicateInfo } = book;

  const statusColor = isDuplicate 
    ? 'bg-yellow-50 border-yellow-200' 
    : isValid 
      ? 'bg-white border-gray-200' 
      : 'bg-red-50 border-red-200';

  const statusIcon = isDuplicate 
    ? '⚠️' 
    : isValid 
      ? '✅' 
      : '❌';

  return (
    <div className={`rounded-lg border p-4 ${statusColor}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{statusIcon}</span>
            <h4 className="font-medium text-gray-900">{data.title}</h4>
          </div>
          <p className="text-gray-600 mt-1">by {data.author}</p>
          
          {/* Book Details */}
          <div className="flex flex-wrap gap-3 mt-2 text-sm">
            {data.isbn && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                ISBN: {data.isbn}
              </span>
            )}
            {data.pageCount && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {data.pageCount} pages
              </span>
            )}
            {data.publicationYear && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {data.publicationYear}
              </span>
            )}
            <span className="bg-gray-100 px-2 py-1 rounded">
              {formatImportStatus(data.readingStatus)}
            </span>
            {data.rating && (
              <span className="bg-yellow-100 px-2 py-1 rounded">
                {formatRatingForDisplay(data.rating)}
              </span>
            )}
          </div>

          {/* Tags */}
          {data.tags && data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {data.tags.map((tag, index) => (
                <span 
                  key={index}
                  className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Errors or Duplicate Info */}
          {isDuplicate && duplicateInfo && (
            <p className="text-yellow-700 text-sm mt-2">
              ⚠️ {duplicateInfo}
            </p>
          )}
          
          {!isValid && errors.length > 0 && (
            <div className="text-red-600 text-sm mt-2">
              {errors.map((error, index) => (
                <p key={index}>• {error}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
