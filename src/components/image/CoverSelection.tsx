import { useState } from 'react';
import { Check, Upload, X } from 'lucide-react';
import { Button } from '../common/Button';
import { CoverImageCandidate } from '../../types';
import { clsx } from 'clsx';

interface CoverSelectionProps {
  candidates: CoverImageCandidate[];
  onSelect: (candidate: CoverImageCandidate) => void;
  onCustomUpload: () => void;
  onCancel: () => void;
  selectedCoverUrl?: string;
}

export function CoverSelection({
  candidates,
  onSelect,
  onCustomUpload,
  onCancel,
  selectedCoverUrl
}: CoverSelectionProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handlePreview = async (candidate: CoverImageCandidate) => {
    setIsLoading(candidate.url);
    try {
      // Create a temporary image to check if it loads
      const img = new Image();
      img.src = candidate.url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      setPreviewUrl(candidate.url);
    } catch (error) {
      console.error('Failed to load preview:', error);
    } finally {
      setIsLoading(null);
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
  };

  const formatDimensions = (width?: number, height?: number) => {
    if (!width || !height) return 'Size unknown';
    return `${width} × ${height}`;
  };

  const formatSourceName = (source: CoverImageCandidate['source']) => {
    switch (source) {
      case 'openLibrary': return 'Open Library';
      case 'googleBooks': return 'Google Books';
      case 'upload': return 'Custom Upload';
      default: return source;
    }
  };

  // Find the preferred/primary candidate for "Continue with Best" button
  const preferredCandidate = candidates.find(c => c.isPreferred) || candidates[0];

  return (
    <div className="space-y-4">
      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full">
            <button
              type="button"
              onClick={closePreview}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img
              src={previewUrl}
              alt="Cover preview"
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Select Cover Image
        </h3>
        <span className="text-sm text-gray-500">
          {candidates.length} option{candidates.length !== 1 ? 's' : ''} available
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Choose the best cover image for your book. Click to preview at full size.
      </p>

      {/* Cover Grid */}
      {candidates.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {candidates.map((candidate) => {
            const isSelected = selectedCoverUrl === candidate.url;
            const isLoadingPreview = isLoading === candidate.url;

            return (
              <button
                type="button"
                key={candidate.url}
                className={clsx(
                  'relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all text-left',
                  isSelected
                    ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                )}
                onClick={() => handlePreview(candidate)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePreview(candidate);
                  }
                }}
                aria-label={`Preview cover from ${formatSourceName(candidate.source)}, ${formatDimensions(candidate.width, candidate.height)}`}
              >
                {/* Cover Image */}
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700">
                  <img
                    src={candidate.url}
                    alt={`Cover from ${formatSourceName(candidate.source)}`}
                    className={clsx(
                      'w-full h-full object-cover',
                      isLoadingPreview && 'opacity-50'
                    )}
                    loading="lazy"
                  />
                  {isLoadingPreview && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                    </div>
                  )}
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-1">
                    <Check size={14} />
                  </div>
                )}

                {/* Preferred Badge */}
                {candidate.isPreferred && !isSelected && (
                  <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                    Best
                  </div>
                )}

                {/* Info Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white font-medium truncate">
                    {formatSourceName(candidate.source)}
                  </p>
                  <p className="text-xs text-gray-300">
                    {formatDimensions(candidate.width, candidate.height)}
                  </p>
                </div>

                {/* Select Button (shows on hover) */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'secondary' : 'primary'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(candidate);
                    }}
                    disabled={isSelected}
                  >
                    {isSelected ? (
                      <>
                        <Check size={14} className="mr-1" />
                        Selected
                      </>
                    ) : (
                      'Select'
                    )}
                  </Button>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No cover images found from external sources
          </p>
        </div>
      )}

      {/* Custom Upload Option */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Or upload your own cover image:
        </p>
        <Button
          variant="secondary"
          onClick={onCustomUpload}
          className="w-full"
        >
          <Upload size={16} className="mr-2" />
          Upload Custom Cover
        </Button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {/* Continue with Best button - accepts the preferred/default cover */}
        {preferredCandidate && (
          <Button 
            variant="primary" 
            onClick={() => onSelect(preferredCandidate)}
            disabled={selectedCoverUrl === preferredCandidate.url}
          >
            <Check size={16} className="mr-1" />
            Continue with Best
          </Button>
        )}
      </div>
    </div>
  );
}
