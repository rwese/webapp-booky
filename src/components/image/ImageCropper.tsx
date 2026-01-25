import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-cropper';
import 'react-cropper/node_modules/cropperjs/dist/cropper.css';
import { X, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ImageCropperProps {
  image: string | File;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number; // width/height ratio (6/9 = 0.666...)
  aspectLabel?: string;
  maxZoom?: number;
  minZoom?: number;
}

export type { ImageCropperProps };

// Constants for consistent aspect ratio across the application
const BOOK_COVER_ASPECT_RATIO = 6 / 9;
const BOOK_COVER_ASPECT_LABEL = '6:9';

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = BOOK_COVER_ASPECT_RATIO,
  aspectLabel = BOOK_COVER_ASPECT_LABEL,
  maxZoom = 3,
  minZoom = 1
}: ImageCropperProps) {
  const cropperRef = useRef<any>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aspectMode, setAspectMode] = useState<'fixed' | 'free'>('fixed');

  // Load image from File or URL
  useEffect(() => {
    if (image instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(image);
    } else {
      setImageSrc(image);
    }
  }, [image]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const onCropperReady = useCallback(() => {
    // Reset zoom to default when cropper is ready
    setZoom(1);
    setRotation(0);
  }, []);

  const handleZoomIn = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.zoom(0.1);
      setZoom(prev => Math.min(prev + 0.1, maxZoom));
    }
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.zoom(-0.1);
      setZoom(prev => Math.max(prev - 0.1, minZoom));
    }
  }, [minZoom]);

  const handleRotate = useCallback((degrees: number) => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.rotate(degrees);
      setRotation(prev => prev + degrees);
    }
  }, []);

  const handleReset = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.reset();
      setZoom(1);
      setRotation(0);
    }
  }, []);

  const toggleAspectMode = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      if (aspectMode === 'fixed') {
        cropper.setAspectRatio(NaN); // Free aspect
        setAspectMode('free');
      } else {
        cropper.setAspectRatio(aspectRatio);
        setAspectMode('fixed');
      }
    }
  }, [aspectMode, aspectRatio]);

  const handleApply = useCallback(async () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper || isProcessing) return;

    setIsProcessing(true);
    try {
      // Get cropped canvas with high quality
      const canvas = cropper.getCroppedCanvas({
        maxWidth: 4096,
        maxHeight: 4096,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      if (!canvas) {
        throw new Error('Failed to get cropped canvas');
      }

      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          0.95
        );
      });

      if (!blob) {
        throw new Error('Failed to create blob from canvas');
      }

      onCropComplete(blob);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onCropComplete]);

  // Handle keyboard navigation for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't handle if user is interacting with input controls
      if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCancel, handleApply, handleZoomIn, handleZoomOut]);

  if (!imageSrc) {
    return (
      <div 
        className="flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded-xl"
        role="status"
        aria-label="Loading image cropper"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const currentAspectRatio = aspectMode === 'fixed' ? aspectRatio : NaN;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-label="Image cropper"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden w-full max-w-lg mx-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Crop Cover Image
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close cropper"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative flex-1 min-h-[300px] bg-gray-100 dark:bg-gray-900 overflow-hidden">
          <Cropper
            ref={cropperRef}
            src={imageSrc}
            style={{ height: '100%', width: '100%' }}
            aspectRatio={currentAspectRatio}
            viewMode={1}
            dragMode="move"
            autoCropArea={1}
            cropBoxMovable={false}
            toggleDragModeOnDblclick={false}
            responsive={true}
            background={false}
            checkOrientation={true}
            ready={onCropperReady}
          />
          <style>{`
            .cropper-face {
              pointer-events: none !important;
            }
          `}</style>
        </div>

        {/* Controls */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-shrink-0 bg-white dark:bg-gray-800">
          {/* Zoom Controls */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Zoom
            </span>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Zoom out"
              disabled={zoom <= minZoom}
            >
              <ZoomOut size={18} />
            </button>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.1}
              value={zoom}
              onChange={(e) => {
                const newZoom = parseFloat(e.target.value);
                setZoom(newZoom);
                const cropper = cropperRef.current?.cropper;
                if (cropper) {
                  cropper.zoomTo(newZoom);
                }
              }}
              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              aria-label="Zoom level"
            />
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Zoom in"
              disabled={zoom >= maxZoom}
            >
              <ZoomIn size={18} />
            </button>
          </div>

          {/* Rotation Controls */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Rotate
            </span>
            <button
              type="button"
              onClick={() => handleRotate(-90)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Rotate left 90 degrees"
            >
              -90°
            </button>
            <button
              type="button"
              onClick={() => handleRotate(90)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Rotate right 90 degrees"
            >
              +90°
            </button>
          </div>

          {/* Aspect Ratio Toggle */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Aspect Ratio
            </span>
            <button
              type="button"
              onClick={toggleAspectMode}
              className={twMerge(clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                aspectMode === 'fixed' 
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              ))}
              aria-pressed={aspectMode === 'fixed'}
            >
              {aspectLabel}
            </button>
            <button
              type="button"
              onClick={toggleAspectMode}
              className={twMerge(clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                aspectMode === 'free'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              ))}
              aria-pressed={aspectMode === 'free'}
            >
              Free
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              disabled={isProcessing}
              aria-label="Reset crop settings"
            >
              <RotateCcw size={16} className="sm:size-[18]" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1 sm:gap-2 flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Processing...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Apply Crop
                </>
              )}
            </button>
          </div>
        </div>

        {/* Accessibility Instructions */}
        <div className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <p>Keyboard shortcuts: Arrow keys to pan, +/- to zoom, Enter to apply, Escape to cancel</p>
        </div>
      </div>
    </div>
  );
}

export default ImageCropper;
