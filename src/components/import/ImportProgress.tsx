import React from 'react';
import type { ImportProgress, ImportResult } from '../../types';

interface ImportProgressProps {
  progress: ImportProgress;
  result?: ImportResult;
  onComplete: () => void;
  onRetry?: () => void;
}

export function ImportProgressDisplay({ progress, result, onComplete, onRetry }: ImportProgressProps) {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'reading':
        return 'Reading import data...';
      case 'processing':
        return 'Processing books...';
      case 'importing':
        return 'Importing books...';
      case 'completed':
        return 'Import completed!';
      case 'error':
        return 'Import failed';
      default:
        return 'Preparing import...';
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Status Header */}
      <div className="text-center mb-6">
        <div className={`text-lg font-semibold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
        {progress.currentBook && (
          <p className="text-gray-600 text-sm mt-1">
            {progress.currentBook}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${
            progress.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Progress Stats */}
      <div className="flex justify-between text-sm text-gray-600 mb-4">
        <span>{progress.current} of {progress.total}</span>
        <span>{percentage}%</span>
      </div>

      {/* Results Summary */}
      {result && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-3">Import Results</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-100 rounded p-2">
              <div className="text-xl font-bold text-green-600">{result.imported}</div>
              <div className="text-xs text-green-700">Imported</div>
            </div>
            <div className="bg-yellow-100 rounded p-2">
              <div className="text-xl font-bold text-yellow-600">{result.skipped}</div>
              <div className="text-xs text-yellow-700">Skipped</div>
            </div>
            <div className="bg-red-100 rounded p-2">
              <div className="text-xl font-bold text-red-600">{result.failed}</div>
              <div className="text-xs text-red-700">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Errors List */}
      {progress.errors.length > 0 && (
        <div className="bg-red-50 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-red-800 mb-2">
            Errors ({progress.errors.length})
          </h4>
          <div className="max-h-40 overflow-y-auto">
            {progress.errors.slice(0, 10).map((error, index) => (
              <div key={index} className="text-sm text-red-700 py-1 border-b border-red-100 last:border-0">
                <span className="font-medium">{error.title}:</span> {error.error}
              </div>
            ))}
            {progress.errors.length > 10 && (
              <p className="text-sm text-red-600 mt-2">
                ... and {progress.errors.length - 10} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-3">
        {progress.status === 'completed' && (
          <button onClick={onComplete} className="btn btn-primary">
            Done
          </button>
        )}
        
        {progress.status === 'error' && onRetry && (
          <button onClick={onRetry} className="btn btn-primary">
            Retry
          </button>
        )}
        
        {progress.status === 'error' && (
          <button onClick={onComplete} className="btn btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// Compact progress indicator for inline use
export function ImportProgressIndicator({ progress }: { progress: ImportProgress }) {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-600 w-16 text-right">
        {progress.current}/{progress.total}
      </span>
    </div>
  );
}
