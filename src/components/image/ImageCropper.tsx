import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, Check, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface ImageCropperProps {
  image: string | File;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number; // width/height ratio (16/9 = 1.777...)
  aspectLabel?: string;
  maxZoom?: number;
  minZoom?: number;
  cropperSize?: { width: number; height: number };
}

export type { ImageCropperProps };

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = 16 / 9,
  aspectLabel = '16:9',
  maxZoom = 3,
  minZoom = 1,
  cropperSize = { width: 300, height: 200 }
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aspectMode, setAspectMode] = useState<'fixed' | 'free'>('fixed');
  const containerRef = useRef<HTMLDivElement>(null);

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
        onCancel();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCrop(prev => ({ ...prev, x: prev.x + 20 }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCrop(prev => ({ ...prev, x: prev.x - 20 }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCrop(prev => ({ ...prev, y: prev.y + 20 }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCrop(prev => ({ ...prev, y: prev.y - 20 }));
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(prev => Math.min(prev + 0.1, maxZoom));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(prev => Math.max(prev - 0.1, minZoom));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, maxZoom, minZoom]);

  const onCropCompleteHandler = useCallback(
    (croppedArea: { x: number; y: number; width: number; height: number }) => {
      setCroppedAreaPixels(croppedArea);
    },
    []
  );

  const createImage = useCallback((url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', error => reject(error));
      image.src = url;
    }), []);

  const getCroppedImg = useCallback(async (
    imageSrc: string,
    cropPixels: { x: number; y: number; width: number; height: number },
    rotation: number
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2D context');
    }

    // Calculate the size after rotation
    const radRotation = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radRotation));
    const cos = Math.abs(Math.cos(radRotation));

    const width = image.width * cos + image.height * sin;
    const height = image.width * sin + image.height * cos;

    canvas.width = width;
    canvas.height = height;

    // Translate and rotate the context
    ctx.translate(width / 2, height / 2);
    ctx.rotate(radRotation);
    ctx.translate(-width / 2, -height / 2);

    // Draw the image
    ctx.drawImage(image, 0, 0);

    // Crop and scale
    const data = ctx.getImageData(
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height
    );

    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;

    ctx.putImageData(data, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      }, 'image/jpeg', 0.95);
    });
  }, [createImage]);

  const handleApply = useCallback(async () => {
    if (!croppedAreaPixels || !imageSrc || isProcessing) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, rotation, isProcessing, onCropComplete, getCroppedImg]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, maxZoom));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, minZoom));
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const toggleAspectMode = () => {
    setAspectMode(prev => (prev === 'fixed' ? 'free' : 'fixed'));
  };

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

  const currentAspectRatio = aspectMode === 'fixed' ? aspectRatio : undefined;

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
      role="dialog"
      aria-label="Image cropper"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Crop Cover Image
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close cropper"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Cropper Container */}
      <div 
        ref={containerRef}
        className="relative bg-gray-900"
        style={{ height: '400px' }}
        role="application"
        aria-label="Image cropping area"
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={currentAspectRatio}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropCompleteHandler}
          cropShape="rect"
          showGrid={true}
          objectFit="cover"
          maxZoom={maxZoom}
          minZoom={minZoom}
        />
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4">
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
            onChange={(e) => setZoom(parseFloat(e.target.value))}
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
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={isProcessing}
            aria-label="Reset crop settings"
          >
            <RotateCcw size={18} />
            Reset
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
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
      <div className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">
        <p>Keyboard shortcuts: Arrow keys to pan, +/- to zoom, Enter to apply, Escape to cancel</p>
      </div>
    </div>
  );
}

export default ImageCropper;
