import React, { useState, useRef, useCallback } from 'react';
import { ImageCropper } from './ImageCropper';
import { 
  Upload, 
  X, 
  Crop as CropIcon, 
  RefreshCw, 
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  isValidCoverImage, 
  getImageDimensions, 
  imageNeedsCropping,
  processCroppedImage 
} from '../../lib/coverImageUtils';

interface CoverUploadProps {
  value?: string; // Current cover URL
  onChange: (coverUrl: string, coverFile?: File) => void;
  bookTitle: string;
  error?: string;
  disabled?: boolean;
}

export function CoverUpload({
  value,
  onChange,
  bookTitle,
  error,
  disabled = false
}: CoverUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous state
    setCropError(null);
    setSelectedFile(null);
    setPreviewUrl(null);

    // Validate file
    if (!isValidCoverImage(file)) {
      setCropError('Please select a valid image file (JPEG, PNG, GIF, WebP) under 5MB');
      return;
    }

    try {
      // Check if image needs cropping
      const dimensions = await getImageDimensions(file);
      const needsCropping = imageNeedsCropping(
        dimensions.width, 
        dimensions.height, 
        16 / 9, 
        2000
      );

      if (needsCropping) {
        // Show cropping UI
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setIsCropping(true);
      } else {
        // Image is suitable, use directly
        setIsProcessing(true);
        const { localPath } = await processCroppedImage(file, file.name, bookTitle);
        onChange(localPath, file);
        setIsProcessing(false);
      }
    } catch (err) {
      setCropError('Failed to process image');
      console.error('Error processing image:', err);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [bookTitle, onChange]);

  // Handle crop completion
  const handleCropComplete = useCallback(async (croppedBlob: Blob) => {
    setIsProcessing(true);
    try {
      const { localPath, file } = await processCroppedImage(
        croppedBlob, 
        bookTitle,
        selectedFile?.name
      );
      onChange(localPath, file);
      
      // Reset cropping state
      setIsCropping(false);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } catch (err) {
      setCropError('Failed to apply crop');
      console.error('Error applying crop:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [bookTitle, selectedFile, previewUrl, onChange]);

  // Handle crop cancellation
  const handleCropCancel = useCallback(() => {
    setIsCropping(false);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  // Handle cover removal
  const handleRemove = useCallback(() => {
    onChange('');
    setSelectedFile(null);
    setPreviewUrl(null);
  }, [onChange]);

  // Handle re-crop
  const handleReCrop = useCallback(() => {
    if (value) {
      setSelectedFile(null);
      setPreviewUrl(value);
      setIsCropping(true);
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Cover Image
      </label>

      {/* Error message */}
      {(error || cropError) && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error || cropError}
        </p>
      )}

      {/* Cropping View */}
      {isCropping && (
        <div className="relative">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Adjust the crop area for your cover image
            </p>
            <button
              type="button"
              onClick={handleCropCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              disabled={isProcessing}
            >
              <X size={20} />
            </button>
          </div>
          
          {isProcessing ? (
            <div className="flex items-center justify-center p-12 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <div className="text-center">
                <RefreshCw size={32} className="animate-spin mx-auto text-primary-600" />
                <p className="mt-2 text-gray-600 dark:text-gray-400">Processing image...</p>
              </div>
            </div>
          ) : (
            <ImageCropper
              image={previewUrl || selectedFile!}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
              aspectRatio={16 / 9}
              aspectLabel="16:9"
            />
          )}
        </div>
      )}

      {/* Cover Preview/Upload View */}
      {!isCropping && (
        <>
          {value ? (
            // Show current cover with options
            <div className="relative group">
              <div className="relative aspect-[16/9] w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                <img
                  src={value}
                  alt="Book cover"
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleReCrop}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    disabled={disabled}
                  >
                    <CropIcon size={18} />
                    Re-crop
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
              className={twMerge(
                clsx(
                  'relative aspect-[16/9] w-full border-2 border-dashed rounded-xl transition-colors',
                  'flex flex-col items-center justify-center gap-3 cursor-pointer',
                  'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800',
                  'border-gray-300 dark:border-gray-600',
                  disabled && 'opacity-50 cursor-not-allowed'
                )
              )}
              onClick={() => !disabled && fileInputRef.current?.click()}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  !disabled && fileInputRef.current?.click();
                }
              }}
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
