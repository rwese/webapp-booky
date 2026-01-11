import { useState, useCallback, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import type { ScanResult, ScanState, ScanConfig, ManualEntryConfig, BatchScanState, ScanQueueItem } from '../types';
import { searchByISBN, searchGoogleBooksByISBN } from '../lib/api';

// Book lookup hook that listens for barcode scanner events
export function useBookLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookData, setBookData] = useState<any>(null);

  useEffect(() => {
    const handleBookLookup = async (event: CustomEvent) => {
      const { isbn } = event.detail;
      
      if (!isbn) return;

      setIsLoading(true);
      setError(null);
      setBookData(null);

      try {
        // Search both Open Library and Google Books
        const [openLibraryBook, googleBooksBook] = await Promise.all([
          searchByISBN(isbn),
          searchGoogleBooksByISBN(isbn)
        ]);

        // Prefer Open Library result, fall back to Google Books
        const book = openLibraryBook || googleBooksBook;

        if (book) {
          setBookData(book);
          window.dispatchEvent(new CustomEvent('book:found', { detail: book }));
        } else {
          setError('Book not found for this ISBN');
          window.dispatchEvent(new CustomEvent('book:notfound', { detail: { isbn } }));
        }
      } catch (err) {
        setError('Failed to lookup book');
        console.error('Book lookup error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const handleEvent = (event: Event) => {
      handleBookLookup(event as CustomEvent);
    };

    window.addEventListener('book:lookup', handleEvent);

    return () => {
      window.removeEventListener('book:lookup', handleEvent);
    };
  }, []);

  return {
    isLoading,
    error,
    bookData,
    clearBookData: () => setBookData(null)
  };
}

// Single barcode scanning hook
export function useBarcodeScanner(config?: Partial<ScanConfig>) {
  const [state, setState] = useState<ScanState>({
    isScanning: false,
    lastScan: null,
    error: null,
    cameraDevices: [],
    selectedDevice: null,
    flashEnabled: false
  });

  const [configState] = useState<ScanConfig>({
    enabled: true,
    cameraFacing: 'environment',
    autoScan: true,
    scanInterval: 500,
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
    ...config
  });

  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const videoReadyRef = useRef(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const scanFrameRef = useRef<() => void>(() => {});
  const recoveryInProgressRef = useRef(false); // Prevent concurrent recovery attempts
  const maxRecoveryAttempts = 3; // Maximum recovery attempts to prevent infinite loops
  const recoveryAttemptsRef = useRef(0); // Track current recovery attempt count
  const zxingDecodeStartedRef = useRef(false); // Prevent multiple ZXing decodeFromVideoElement calls

  // Simple recovery state validation
  const validateRecoveryState = useCallback(async (): Promise<boolean> => {
    try {
      if (!videoRef.current) {
        console.error('Recovery validation failed: video element is null');
        return false;
      }

      const video = videoRef.current;

      // Basic checks
      if (video.readyState < 2) {
        console.error(`Recovery validation failed: video readyState=${video.readyState}`);
        return false;
      }

      if (!video.srcObject) {
        console.error('Recovery validation failed: srcObject is null');
        return false;
      }

      const stream = video.srcObject as MediaStream;
      if (!stream.active) {
        console.error('Recovery validation failed: stream is not active');
        return false;
      }

      // Check video dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error(`Recovery validation failed: invalid dimensions ${video.videoWidth}x${video.videoHeight}`);
        return false;
      }

      return true;

    } catch (error) {
      console.error('Recovery validation failed with exception:', error);
      return false;
    }
  }, []);

  // Video track state monitoring - simplified version
  const setupVideoTrackMonitoring = useCallback((stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrackRef.current = videoTrack;

    const handleTrackEnded = () => {
      console.warn('Video track ended unexpectedly');
      setState(prev => ({ 
        ...prev, 
        error: 'Camera stream was interrupted. Please try again.',
        isScanning: false 
      }));
      isScanningRef.current = false;
    };

    const handleTrackMute = () => {
      console.warn('Video track muted');
      
      // Simple recovery with timeout protection
      const attemptRecovery = async () => {
        // Check max recovery attempts
        if (recoveryAttemptsRef.current >= maxRecoveryAttempts) {
          console.error(`Recovery failed: maximum attempts (${maxRecoveryAttempts}) reached`);
          setState(prev => ({ 
            ...prev, 
            error: 'Camera recovery failed after multiple attempts. Please restart the scanner.',
            isScanning: false 
          }));
          recoveryInProgressRef.current = false;
          return;
        }
        
        recoveryInProgressRef.current = true;
        recoveryAttemptsRef.current += 1;
        
        try {
          // Stop current stream
          if (streamRef.current) {
            const tracks = streamRef.current.getVideoTracks();
            for (let i = 0; i < tracks.length; i++) {
              tracks[i].stop();
            }
          }
          
          // Reset video element
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
          }
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Request new stream with simple constraints
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          streamRef.current = newStream;
          
          // Reattach stream
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
            await videoRef.current.play();
          }
          
          // Validate recovery
          const isValid = await validateRecoveryState();
          
          if (isValid) {
            setState(prev => ({ 
              ...prev, 
              error: null,
              isScanning: true 
            }));
            isScanningRef.current = true;
            recoveryAttemptsRef.current = 0;
            scanFrameRef.current();
          } else {
            throw new Error('Recovery validation failed');
          }
          
        } catch (error) {
          console.error('Recovery failed:', error);
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to recover camera stream.',
            isScanning: false 
          }));
        } finally {
          recoveryInProgressRef.current = false;
        }
      };

      // Execute recovery
      if (!recoveryInProgressRef.current) {
        attemptRecovery();
      }
    };

    videoTrack.addEventListener('ended', handleTrackEnded);
    videoTrack.addEventListener('mute', handleTrackMute);

    // Return cleanup function
    return () => {
      videoTrack.removeEventListener('ended', handleTrackEnded);
      videoTrack.removeEventListener('mute', handleTrackMute);
    };
  }, [validateRecoveryState]);

  // Simple video readiness check
  const isVideoReady = useCallback((video: HTMLVideoElement): boolean => {
    if (video.readyState < 2) {
      return false;
    }
    if (!video.srcObject) {
      return false;
    }
    const stream = video.srcObject as MediaStream;
    if (!stream.active) {
      return false;
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return false;
    }
    return true;
  }, []);

  // Initialize barcode reader
  const initializeReader = useCallback(async () => {
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      readerRef.current = new BrowserMultiFormatReader(hints);
      
      // Get available camera devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setState(prev => ({ ...prev, cameraDevices: videoDevices }));

      return true;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize scanner' 
      }));
      return false;
    }
  }, []);

  // Scan individual frame
  const scanFrame = useCallback(async () => {
    // Update the ref so recovery logic can access the latest function
    scanFrameRef.current = scanFrame;
    
    if (!isScanningRef.current || !videoRef.current || !readerRef.current) return;

    const now = Date.now();
    if (now - lastScanTimeRef.current < configState.scanInterval) {
      if (isScanningRef.current) {
        requestAnimationFrame(() => scanFrame());
      }
      return;
    }

    try {
      // Use comprehensive video readiness check
      if (!videoRef.current) {
        console.debug('Video element is null during scanFrame');
        if (isScanningRef.current) {
          requestAnimationFrame(() => scanFrame());
        }
        return;
      }

      if (!isVideoReady(videoRef.current)) {
        // Video not ready, try again later with progressive backoff
        const backoffMs = Math.min(500 * ((videoRef.current.readyState === 0) ? 2 : 1), 2000);
        if (isScanningRef.current) {
          setTimeout(() => scanFrame(), backoffMs);
        }
        return;
      }

      const result = await readerRef.current.decodeFromVideoElement(videoRef.current);
      
      if (result) {
        lastScanTimeRef.current = now;
        
        const scanResult: ScanResult = {
          text: result.getText(),
          format: result.getBarcodeFormat().toString(),
          timestamp: new Date()
        };

        setState(prev => ({ ...prev, lastScan: scanResult }));

        // Emit custom event for other components to listen
        window.dispatchEvent(new CustomEvent('barcode:scanned', { detail: scanResult }));

        // Auto-capture behavior
        if (configState.autoScan) {
          // Brief pause after successful scan
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      // No barcode found in this frame, continue scanning
      // Log occasional errors for debugging
      if (Math.random() < 0.01) { // Log 1% of errors to reduce noise
        console.debug('Frame scan error (expected):', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    if (isScanningRef.current) {
      requestAnimationFrame(() => scanFrame());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configState.scanInterval, configState.autoScan, isVideoReady]);

  // Start camera and scanning with retry logic and user interaction handling
  const startScanning = useCallback(async (videoElement: HTMLVideoElement) => {
    if (isScanningRef.current) return;

    let attempts = 0;

    // Simple cleanup function
    const cleanupAll = () => {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].stop();
        }
        streamRef.current = null;
      }
      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
      }
    };

    const attemptStart = async (): Promise<boolean> => {
      attempts++;
      
      try {
        setState(prev => ({ ...prev, isScanning: true, error: null, cameraStatus: 'initializing' }));
        videoRef.current = videoElement;

        if (!readerRef.current) {
          await initializeReader();
        }

        // Request camera permission with simple constraints (POC pattern)
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: configState.cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        console.debug('Requesting camera with constraints:', JSON.stringify(constraints));
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.debug('Camera access granted successfully');
        
        // Handle permission denied error
        if (!mediaStream) {
          setState(prev => ({
            ...prev,
            isScanning: false,
            error: 'Camera permission denied. Please allow camera access to scan barcodes.'
          }));
          return false;
        }

        if (!mediaStream) {
          setState(prev => ({
            ...prev,
            isScanning: false,
            error: 'Unable to access camera. Please check permissions and try again.'
          }));
          return false;
        }
        
        streamRef.current = mediaStream;
        setState(prev => ({ ...prev, cameraStatus: 'ready' }));
        
        // Setup video track monitoring
        const cleanupTrackMonitoring = setupVideoTrackMonitoring(mediaStream);
        
        // Set the video stream with POC-style event handling
        videoElement.srcObject = streamRef.current;
        
        console.debug('Waiting for video to be ready...');
        
        // POC-style promise-based video readiness with timeout
        await new Promise<void>((resolve, reject) => {
          let resolved = false;
          
          const resolveOnce = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          
          const rejectOnce = (err: Error) => {
            if (!resolved) {
              resolved = true;
              reject(err);
            }
          };

          const onLoadedMetadata = () => {
            console.debug('loadedmetadata event received');
            resolveOnce();
          };

          const onCanPlay = () => {
            console.debug('canplay event received');
          };

          const onError = (e: Event) => {
            console.error('Video error event:', e);
            rejectOnce(new Error('Video element error'));
          };

          videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
          videoElement.addEventListener('canplay', onCanPlay);
          videoElement.addEventListener('error', onError);

          // 10-second timeout protection (POC pattern)
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              console.error('Video readiness timeout');
              rejectOnce(new Error('Video loadedmetadata timeout'));
            }
          }, 10000);

          // Cleanup function
          const cleanup = () => {
            clearTimeout(timeoutId);
            videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
            videoElement.removeEventListener('canplay', onCanPlay);
            videoElement.removeEventListener('error', onError);
          };

          // Cleanup on completion
          (videoElement as any).__videoCleanup = cleanup;
        });

        console.debug('Video metadata loaded - ZXing library will handle video playback');

        // Don't call videoElement.play() here - let ZXing library handle video playback
        // This prevents "Trying to play video that is already playing" errors
        // The ZXing library's decodeFromVideoElement() will handle playing the video

        // Cleanup event listeners
        const cleanup = (videoElement as any).__videoCleanup;
        if (cleanup) {
          cleanup();
          delete (videoElement as any).__videoCleanup;
        }

        // Final comprehensive video readiness validation
        const isReady = isVideoReady(videoElement);
        if (!isReady) {
          console.debug('Video failed final readiness check');
          setState(prev => ({
            ...prev,
            isScanning: false,
            error: 'Camera stream not ready. Please try again.'
          }));
          cleanupAll();
          return false;
        }

        console.debug('Video ready and playing successfully');
        videoReadyRef.current = true;
        isScanningRef.current = true;
        setState(prev => ({ ...prev, cameraStatus: 'active', isScanning: true }));

        // Start continuous scanning
        scanFrame();
        return true;

      } catch (error) {
        let errorMessage = 'Failed to start camera';
        
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera permission denied. Please allow camera access.';
          } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please connect a camera.';
          }
        }
        
        // Cleanup on failure
        cleanupAll();
        
        setState(prev => ({ 
          ...prev, 
          isScanning: false,
          error: errorMessage
        }));
        isScanningRef.current = false;
        return false;
      }
    };

    await attemptStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configState.cameraFacing, initializeReader, scanFrame, setupVideoTrackMonitoring, isVideoReady]);

  // Stop scanning with simple cleanup
  const stopScanning = useCallback(() => {
    isScanningRef.current = false;
    videoReadyRef.current = false;
    zxingDecodeStartedRef.current = false; // Reset ZXing decode flag

    // Cancel any pending play request
    if (playPromiseRef.current) {
      playPromiseRef.current.then(() => {}).catch(() => {});
      playPromiseRef.current = null;
    }

    // Stop all tracks
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].stop();
      }
      streamRef.current = null;
    }

    // Clean up video element
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    setState(prev => ({ ...prev, isScanning: false }));
  }, []);

  // Toggle flashlight
  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as any;

    if (capabilities.torch) {
      const newFlashState = !state.flashEnabled;
      await track.applyConstraints({
        advanced: [{ torch: newFlashState } as any]
      });
      setState(prev => ({ ...prev, flashEnabled: newFlashState }));
    }
  }, [state.flashEnabled]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    const currentDevice = state.selectedDevice;
    const devices = state.cameraDevices;
    const currentIndex = devices.findIndex(d => d.deviceId === currentDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    if (nextDevice) {
      setState(prev => ({ ...prev, selectedDevice: nextDevice.deviceId }));
      stopScanning();
      // Would need to restart with new device
    }
  }, [state.selectedDevice, state.cameraDevices, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending play request
      if (playPromiseRef.current) {
        playPromiseRef.current.then(() => {
          // Play completed successfully, nothing to do
        }).catch((e) => {
          // Play was interrupted or failed, ignore the error
          console.debug('Play interrupted during cleanup:', e);
        });
        playPromiseRef.current = null;
      }
      stopScanning();
    };
  }, [stopScanning]);

  // Retry scanning after error
  const retryScanning = useCallback(async () => {
    if (videoRef.current) {
      setState(prev => ({ ...prev, error: null }));
      await startScanning(videoRef.current);
    }
  }, [startScanning]);

  return {
    state,
    config: configState,
    startScanning,
    stopScanning,
    toggleFlash,
    switchCamera,
    retryScanning,
    initializeReader
  };
}

// Manual ISBN entry hook
export function useManualISBNEntry(config?: Partial<ManualEntryConfig>) {
  const [isbn, setIsbn] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [configState] = useState<ManualEntryConfig>({
    autoFormat: true,
    validateISBN: true,
    autoLookup: true,
    ...config
  });

  // Auto-format ISBN with hyphens
  const formatISBN = useCallback((input: string): string => {
    if (!configState.autoFormat) return input;

    // Remove existing hyphens and spaces
    let cleaned = input.replace(/[-\s]/g, '');

    // Add hyphens for ISBN-13
    if (cleaned.length === 13 || (cleaned.length === 12 && !cleaned.startsWith('978'))) {
      if (cleaned.startsWith('978')) {
        // ISBN-13 format: 978-XX-XXX-XXXX-X
        return cleaned.replace(/^(\d{3})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
      } else if (cleaned.startsWith('979')) {
        // ISBN-13 format: 979-XX-XXX-XXXX-X
        return cleaned.replace(/^(\d{4})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
      }
    }

    // Add hyphens for ISBN-10
    if (cleaned.length === 10) {
      return cleaned.replace(/^(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4');
    }

    return input;
  }, [configState.autoFormat]);

  // Validate ISBN
  const validateISBN = useCallback((input: string): boolean => {
    if (!configState.validateISBN) return true;

    const cleaned = input.replace(/[-\s]/g, '');
    
    // ISBN-13 validation
    if (cleaned.length === 13 && /^\d+$/.test(cleaned)) {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return checkDigit === parseInt(cleaned[12]);
    }

    // ISBN-10 validation
    if (cleaned.length === 10) {
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned[i]) * (10 - i);
      }
      const checkDigit = cleaned[9].toUpperCase() === 'X' ? 10 : parseInt(cleaned[9]);
      return ((sum + checkDigit) % 11) === 0;
    }

    return false;
  }, [configState.validateISBN]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatISBN(input);
    setIsbn(formatted);

    if (configState.validateISBN) {
      const valid = validateISBN(formatted);
      setIsValid(valid);
      setError(valid ? null : 'Invalid ISBN format');
    }
  }, [formatISBN, validateISBN, configState.validateISBN]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setError('Please enter a valid ISBN');
      return null;
    }

    setIsValidating(true);
    setError(null);

    try {
      const cleanedISBN = isbn.replace(/[-\s]/g, '');
      
      // Emit event for book lookup
      window.dispatchEvent(new CustomEvent('book:lookup', { 
        detail: { isbn: cleanedISBN, isbn13: cleanedISBN.length === 13 ? cleanedISBN : null } 
      }));

      return cleanedISBN;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Lookup failed');
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [isbn, isValid]);

  const clearInput = useCallback(() => {
    setIsbn('');
    setIsValid(false);
    setError(null);
  }, []);

  return {
    isbn,
    setIsbn: handleChange,
    isValid,
    error,
    isValidating,
    handleSubmit,
    clearInput,
    formatISBN,
    validateISBN
  };
}

// Batch scanning hook
export function useBatchScanning() {
  const [state, setState] = useState<BatchScanState>({
    queue: [],
    isProcessing: false,
    currentProgress: 0,
    totalItems: 0,
    errors: []
  });

  const addToQueue = useCallback((isbn: string) => {
    const cleanedISBN = isbn.replace(/[-\s]/g, '');
    
    // Check for duplicates
    const exists = state.queue.some(item => 
      item.isbn === cleanedISBN || item.isbn13 === cleanedISBN
    );

    if (exists) {
      window.dispatchEvent(new CustomEvent('batch:duplicate', { detail: isbn }));
      return false;
    }

    const item: ScanQueueItem = {
      id: crypto.randomUUID(),
      isbn: cleanedISBN,
      isbn13: cleanedISBN.length === 13 ? cleanedISBN : undefined,
      status: 'pending',
      scannedAt: new Date()
    };

    setState(prev => ({
      ...prev,
      queue: [...prev.queue, item]
    }));

    return true;
  }, [state.queue]);

  const removeFromQueue = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.filter(item => item.id !== id)
    }));
  }, []);

  const clearQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      queue: [],
      errors: [],
      currentProgress: 0
    }));
  }, []);

  const processQueue = useCallback(async () => {
    if (state.isProcessing || state.queue.length === 0) return;

    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentProgress: 0,
      totalItems: prev.queue.length,
      errors: []
    }));

    let completed = 0;
    const pendingItems = state.queue.filter(item => item.status === 'pending');

    for (const item of pendingItems) {
      try {
        // Emit event for each book lookup
        window.dispatchEvent(new CustomEvent('book:lookup', { 
          detail: { isbn: item.isbn, isbn13: item.isbn13 } 
        }));

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update item status
        setState(prev => ({
          ...prev,
          currentProgress: completed + 1,
          queue: prev.queue.map(q => 
            q.id === item.id ? { ...q, status: 'success' } : q
          )
        }));

        completed++;
      } catch (error) {
        setState(prev => ({
          ...prev,
          queue: prev.queue.map(q => 
            q.id === item.id ? { 
              ...q, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Lookup failed'
            } : q
          ),
          errors: [...prev.errors, `${item.isbn}: Lookup failed`]
        }));
      }
    }

    setState(prev => ({
      ...prev,
      isProcessing: false,
      currentProgress: completed,
      totalItems: pendingItems.length
    }));

    // Emit completion event
    const errorCount = state.errors.length;
    window.dispatchEvent(new CustomEvent('batch:complete', { 
      detail: { total: pendingItems.length, completed, errors: errorCount } 
    }));

  }, [state.queue, state.isProcessing, state.errors.length]);

  const retryItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      queue: prev.queue.map(item => 
        item.id === id ? { ...item, status: 'pending', error: undefined } : item
      )
    }));
  }, []);

  return {
    state,
    addToQueue,
    removeFromQueue,
    clearQueue,
    processQueue,
    retryItem
  };
}

// Barcode format utilities
export const barcodeFormats = {
  EAN_13: 'ean_13',
  EAN_8: 'ean_8',
  UPC_A: 'upc_a',
  UPC_E: 'upc_e',
  CODE_128: 'code_128',
  CODE_39: 'code_39'
};

// ISBN utilities
export const isbnUtils = {
  isISBN10: (isbn: string): boolean => {
    const cleaned = isbn.replace(/[-\s]/g, '');
    return cleaned.length === 10 && /^\d{9}[\dX]$/i.test(cleaned);
  },

  isISBN13: (isbn: string): boolean => {
    const cleaned = isbn.replace(/[-\s]/g, '');
    return cleaned.length === 13 && /^\d{13}$/.test(cleaned);
  },

  toISBN13: (isbn10: string): string => {
    const cleaned = isbn10.replace(/[-\s]/g, '');
    if (cleaned.length !== 10) return cleaned;
    
    const prefix = '978';
    const baseISBN = prefix + cleaned.substring(0, 9);
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(baseISBN[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return baseISBN + checkDigit;
  },

  formatISBN: (isbn: string): string => {
    const cleaned = isbn.replace(/[-\s]/g, '');
    
    if (cleaned.length === 13) {
      return cleaned.replace(/^(\d{3})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
    }
    
    if (cleaned.length === 10) {
      return cleaned.replace(/^(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4');
    }
    
    return isbn;
  },

  cleanISBN: (isbn: string): string => {
    return isbn.replace(/[-\s]/g, '');
  }
};
