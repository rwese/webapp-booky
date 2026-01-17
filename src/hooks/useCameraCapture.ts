/**
 * Camera Capture Hook
 * 
 * Hook for managing camera capture functionality using the MediaDevices API.
 * Provides camera preview, photo capture, and device management.
 */

import { useCallback, useState, useRef, useEffect } from 'react';

export interface CameraCaptureConfig {
  cameraFacing: 'user' | 'environment';
  width: number;
  height: number;
  aspectRatio: number;
}

export interface CameraCaptureState {
  isStreaming: boolean;
  isCapturing: boolean;
  error: string | null;
  cameraDevices: MediaDeviceInfo[];
  selectedDevice: string | null;
  facingMode: 'user' | 'environment' | 'unknown';
  hasPermission: boolean | null;
}

const defaultConfig: CameraCaptureConfig = {
  cameraFacing: 'environment',
  width: 1920,
  height: 1080,
  aspectRatio: 16 / 9
};

export function useCameraCapture(config?: Partial<CameraCaptureConfig>) {
  const [state, setState] = useState<CameraCaptureState>({
    isStreaming: false,
    isCapturing: false,
    error: null,
    cameraDevices: [],
    selectedDevice: null,
    facingMode: defaultConfig.cameraFacing,
    hasPermission: null
  });

  const [configState] = useState<CameraCaptureConfig>({
    ...defaultConfig,
    ...config
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

  // Enumerate available camera devices
  const enumerateDevices = useCallback(async () => {
    try {
      // Request permissions first to ensure devices are enumerable
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      setState(prev => ({ ...prev, cameraDevices: videoDevices }));
      
      return videoDevices;
    } catch (err) {
      console.warn('[useCameraCapture] Failed to enumerate devices:', err);
      setState(prev => ({ ...prev, cameraDevices: [], error: 'Unable to access camera devices' }));
      return [];
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }

      setState(prev => ({ ...prev, error: null, isStreaming: true }));

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: configState.width },
          height: { ideal: configState.height },
          facingMode: deviceId ? undefined : configState.cameraFacing,
          deviceId: deviceId ? { ideal: deviceId } : undefined,
          aspectRatio: { ideal: configState.aspectRatio },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Get actual device ID if not specified
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      // Update state with permission granted
      setState(prev => ({
        ...prev,
        isStreaming: true,
        hasPermission: true,
        selectedDevice: settings.deviceId || prev.selectedDevice,
        error: null
      }));

      return stream;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      console.warn('[useCameraCapture] Camera error:', errorMessage);
      
      // Check for specific permission errors
      let userFriendlyError = errorMessage;
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowed')) {
        userFriendlyError = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (errorMessage.includes('NotFound') || errorMessage.includes('Devices not found')) {
        userFriendlyError = 'No camera found. Please connect a camera and try again.';
      } else if (errorMessage.includes('NotReadable') || errorMessage.includes('Track start failed')) {
        userFriendlyError = 'Camera is in use by another application. Please close other apps using the camera.';
      }
      
      setState(prev => ({
        ...prev,
        isStreaming: false,
        hasPermission: false,
        error: userFriendlyError
      }));
      
      return null;
    }
  }, [configState]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false, isCapturing: false }));
  }, []);

  // Capture photo from video stream
  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!streamRef.current || !videoRef.current) {
      console.warn('[useCameraCapture] Cannot capture: no active stream');
      setState(prev => ({ ...prev, error: 'Camera not active' }));
      return null;
    }

    setState(prev => ({ ...prev, isCapturing: true, error: null }));

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvasRef.current = canvas;

      // Set canvas size to match video
      canvas.width = video.videoWidth || configState.width;
      canvas.height = video.videoHeight || configState.height;

      // Draw video frame to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Handle mirroring for front camera
      if (state.facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob with compression
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              console.warn('[useCameraCapture] Canvas toBlob returned null');
              resolve(null);
            }
          },
          'image/jpeg',
          0.92 // High quality JPEG compression
        );
      });

      setState(prev => ({ ...prev, isCapturing: false }));
      return blob;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture photo';
      console.error('[useCameraCapture] Capture error:', errorMessage);
      setState(prev => ({ ...prev, isCapturing: false, error: errorMessage }));
      return null;
    }
  }, [configState, state.facingMode]);

  // Switch between front and back cameras
  const switchCamera = useCallback(async () => {
    const newFacingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    
    setState(prev => ({
      ...prev,
      facingMode: newFacingMode
    }));

    // Restart camera with new facing mode
    await startCamera();
  }, [state.facingMode, startCamera]);

  // Switch to specific device
  const switchToDevice = useCallback(async (deviceId: string) => {
    
    setState(prev => ({
      ...prev,
      selectedDevice: deviceId,
      facingMode: 'unknown' // Unknown when using specific device
    }));

    await startCamera(deviceId);
  }, [startCamera]);

  // Get video stream for attaching to video element
  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

  // Attach stream to video element
  const attachToVideo = useCallback((videoElement: HTMLVideoElement) => {
    videoRef.current = videoElement;
    
    if (streamRef.current && videoElement) {
      videoElement.srcObject = streamRef.current;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(err => {
          console.warn('[useCameraCapture] Video play failed:', err);
        });
      };
    }
  }, []);

  // Retry camera after error
  const retryCamera = useCallback(async () => {
    setState(prev => ({ ...prev, error: null }));
    await enumerateDevices();
    await startCamera();
  }, [enumerateDevices, startCamera]);

  // Request permission explicitly
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => {
        track.stop();
      });
      
      setState(prev => ({
        ...prev,
        hasPermission: true,
        error: null
      }));
      
      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        hasPermission: false,
        error: 'Camera permission denied'
      }));
      
      return false;
    }
  }, []);

  return {
    state,
    config: configState,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    switchToDevice,
    enumerateDevices,
    getStream,
    attachToVideo,
    retryCamera,
    requestPermission,
    streamRef,
    videoRef,
    canvasRef
  };
}

export default useCameraCapture;
