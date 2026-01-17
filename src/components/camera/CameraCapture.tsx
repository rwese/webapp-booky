/**
 * Camera Capture Component
 * 
 * Component for capturing photos using the device camera.
 * Provides full-screen preview, capture button, and camera switching.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Camera, RotateCcw, Check, X, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useCameraCapture, CameraCaptureConfig } from '../../hooks/useCameraCapture';

export interface CameraCaptureProps {
  onCapture: (blob: Blob, fileName: string) => void;
  onCancel: () => void;
  config?: Partial<CameraCaptureConfig>;
  className?: string;
  aspectRatio?: number;
}

export function CameraCapture({
  onCapture,
  onCancel,
  config,
  className,
  aspectRatio = 6 / 9
}: CameraCaptureProps) {
  const {
    state,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    enumerateDevices,
    attachToVideo,
    retryCamera,
    requestPermission,
    videoRef,
    canvasRef
  } = useCameraCapture(config);

  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize camera on mount
  useEffect(() => {
    const initCamera = async () => {
      await enumerateDevices();
      await startCamera();
    };
    
    initCamera();
    
    return () => {
      stopCamera();
    };
  }, [enumerateDevices, startCamera, stopCamera]);

  // Handle camera switching
  const handleSwitchCamera = useCallback(async () => {
    await switchCamera();
  }, [switchCamera]);

  // Handle photo capture
  const handleCapture = useCallback(async () => {
    setIsProcessing(true);
    try {
      const blob = await capturePhoto();
      if (blob) {
        // Create preview URL
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPreview(previewUrl);
      }
    } catch (err) {
      console.error('[CameraCapture] Capture failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [capturePhoto]);

  // Handle using the captured photo
  const handleUsePhoto = useCallback(() => {
    if (capturedPreview) {
      // Extract blob from the preview URL
      fetch(capturedPreview)
        .then(res => res.blob())
        .then(blob => {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `cover-capture-${timestamp}.jpg`;
          onCapture(blob, fileName);
        })
        .catch(err => {
          console.error('[CameraCapture] Failed to create blob from preview:', err);
        });
    }
  }, [capturedPreview, onCapture]);

  // Handle retake (clear captured preview)
  const handleRetake = useCallback(() => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
      setCapturedPreview(null);
    }
  }, [capturedPreview]);

  // Handle permission request
  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermission();
    if (granted) {
      setShowPermissionPrompt(false);
      await startCamera();
    }
  }, [requestPermission, startCamera]);

  // Attach video stream when streaming starts
  useEffect(() => {
    if (state.isStreaming && videoRef.current) {
      attachToVideo(videoRef.current);
    }
  }, [state.isStreaming, attachToVideo, videoRef]);

  // Calculate aspect ratio styling
  const aspectRatioStyle = {
    aspectRatio: aspectRatio,
    maxHeight: '70vh'
  };

  return (
    <div 
      ref={containerRef}
      className={twMerge(
        clsx(
          'relative bg-black rounded-xl overflow-hidden',
          className
        )
      )}
      style={aspectRatioStyle}
    >
      {/* Permission Prompt */}
      {showPermissionPrompt && (
        <div className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center p-6 text-white">
          <CameraIcon size={64} className="mb-4 text-primary-400" />
          <h3 className="text-xl font-semibold mb-2">Camera Access Required</h3>
          <p className="text-center text-gray-300 mb-6">
            To capture cover images with your camera, please allow camera access.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleRequestPermission}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
            >
              Allow Camera Access
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {state.error && !showPermissionPrompt && (
        <div className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center p-6 text-white">
          <X size={64} className="mb-4 text-red-400" />
          <h3 className="text-xl font-semibold mb-2">Camera Error</h3>
          <p className="text-center text-gray-300 mb-6">{state.error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retryCamera}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw size={20} />
              Try Again
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {state.isStreaming && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <RefreshCw size={32} className="animate-spin text-white" />
        </div>
      )}

      {/* Video Preview */}
      {!capturedPreview && state.isStreaming && (
        <>
          {/* Video Element */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
            style={{ 
              transform: state.facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' 
            }}
          />

          {/* Camera Controls */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-auto">
              {/* Close Button */}
              <button
                type="button"
                onClick={onCancel}
                className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                aria-label="Close camera"
              >
                <X size={24} />
              </button>

              {/* Camera Switch Button */}
              {state.cameraDevices.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  aria-label="Switch camera"
                >
                  <RotateCcw size={24} />
                </button>
              )}
            </div>

            {/* Bottom Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center items-center pointer-events-auto">
              {/* Capture Button */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={state.isCapturing || isProcessing}
                className={twMerge(
                  clsx(
                    'p-4 rounded-full transition-all',
                    'bg-white hover:bg-gray-100 active:scale-95',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    state.isCapturing || isProcessing ? 'animate-pulse' : ''
                  )
                )}
                aria-label="Take photo"
              >
                <Camera size={32} className="text-black" />
              </button>
            </div>

            {/* Camera Status */}
            <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
              {state.facingMode === 'user' ? 'Front Camera' : 'Rear Camera'}
            </div>
          </div>
        </>
      )}

      {/* Captured Preview Overlay */}
      {capturedPreview && (
        <div className="absolute inset-0 bg-black z-30">
          <img
            src={capturedPreview}
            alt="Captured cover preview"
            className="w-full h-full object-contain"
          />
          
          {/* Preview Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center items-center gap-4 pointer-events-auto bg-gradient-to-t from-black/80 to-transparent">
            {/* Retake Button */}
            <button
              type="button"
              onClick={handleRetake}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium text-white transition-colors flex items-center gap-2"
            >
              <RotateCcw size={20} />
              Retake
            </button>

              {/* Use Photo Button */}
              <button
                type="button"
                onClick={handleUsePhoto}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium text-white transition-colors flex items-center gap-2"
              >
                <Check size={20} />
                Use Photo
              </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for capture processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default CameraCapture;
