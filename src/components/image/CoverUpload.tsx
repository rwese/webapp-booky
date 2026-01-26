import React, { useState, useRef, useCallback } from 'react';
import { CameraCapture } from '../camera/CameraCapture';
import {
  Upload,
  X,
  RefreshCw,
  Camera
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  isValidCoverImage
} from '../../lib/coverImageUtils';
import { coverImageOperations } from '../../lib/db';

interface CoverUploadProps {
  value?: string; // Current cover URL
  onChange: (coverUrl: string, localCoverPath?: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CoverUpload({
  value,
  onChange,
  error,
  disabled = false
}: CoverUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUsingCamera, setIsUsingCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!isValidCoverImage(file)) {
      onChange('', '');
      return;
    }

    setIsProcessing(true);
    try {
      // Store the image directly in IndexedDB
      const imageId = `book-cover-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await coverImageOperations.store(file, imageId);
      const coverUrl = await coverImageOperations.getUrl(imageId);
      if (coverUrl) {
        onChange(coverUrl, imageId);
      }
    } catch (err) {
      console.error('Error storing cover image:', err);
    } finally {
      setIsProcessing(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onChange]);

  // Handle camera capture
  const handleCameraCapture = useCallback(async (blob: Blob, _fileName: string) => {
    setIsProcessing(true);
    try {
      // Store the captured image directly
      const imageId = `book-cover-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await coverImageOperations.store(blob, imageId);
      const coverUrl = await coverImageOperations.getUrl(imageId);
      if (coverUrl) {
        onChange(coverUrl, imageId);
      }
    } catch (err) {
      console.error('Error storing captured image:', err);
    } finally {
      setIsProcessing(false);
      setIsUsingCamera(false);
    }
  }, [onChange]);

  // Handle camera cancellation
  const handleCameraCancel = useCallback(() => {
    setIsUsingCamera(false);
  }, []);

  // Handle cover removal
  const handleRemove = useCallback(() => {
    onChange('', '');
  }, [onChange]);

  return (
    <div className="space-y-2">
      <h3 className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Cover Image
      </h3>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Camera View */}
      {isUsingCamera && (
        <div className="relative">
          <CameraCapture
            onCapture={handleCameraCapture}
            onCancel={handleCameraCancel}
            aspectRatio={16 / 9}
          />
        </div>
      )}

      {/* Cover Preview/Upload View */}
      {!isUsingCamera && (
        <>
          {value ? (
            // Show current cover with options
            <div className="relative group">
              <div className="relative aspect-[6/9] w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                <img
                  src={value}
                  alt="Book cover"
                  className="w-full h-full object-cover"
                />

                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    disabled={disabled}
                  >
                    <Camera size={18} />
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    disabled={disabled}
                  >
                    <X size={18} />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Upload area
            <div
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={twMerge(
                clsx(
                  'relative aspect-[6/9] w-full border-2 border-dashed rounded-xl transition-colors',
                  'flex flex-col items-center justify-center gap-3 cursor-pointer',
                  'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800',
                  'border-gray-300 dark:border-gray-600',
                  !disabled && 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  disabled && 'opacity-50 cursor-not-allowed'
                )
              )}
              onClick={() => !disabled && fileInputRef.current?.click()}
              onKeyDown={(e) => !disabled && e.key === 'Enter' && fileInputRef.current?.click()}
              aria-disabled={disabled}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled}
                aria-label="Upload cover image"
              />

              <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-700">
                {isProcessing ? (
                  <RefreshCw size={24} className="animate-spin text-gray-400" />
                ) : (
                  <Upload size={24} className="text-gray-400" />
                )}
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Click to upload cover image
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  JPEG, PNG, GIF, WebP up to 5MB
                </p>

                {/* Camera button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsUsingCamera(true); }}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    <Camera size={18} />
                    Or take a photo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Hidden file input when there's a cover (for replacement) */}
          {value && !disabled && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Replace cover image"
            />
          )}
        </>
      )}
    </div>
  );
}

export default CoverUpload;
