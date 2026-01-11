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
  const canPlayTimeoutRef = useRef<number | null>(null);
  const loadedMetadataTimeoutRef = useRef<number | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const scanFrameRef = useRef<() => void>(() => {});
  const hasUserInteractionRef = useRef(false); // Track user interaction for browser requirements

  // Video track state monitoring
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
      console.warn('Video track muted - attempting recovery');
      
      // Track recovery attempts to prevent infinite loops
      const recoveryAttempts = (videoTrackRef.current as any)?.recoveryAttempts || 0;
      if (recoveryAttempts >= 3) {
        console.error('Video track recovery failed after 3 attempts');
        setState(prev => ({ 
          ...prev, 
          error: 'Camera stream recovery failed. Please restart the scanner.',
          isScanning: false,
          cameraStatus: 'error'
        }));
        isScanningRef.current = false;
        return;
      }

      // Mark that we're attempting recovery
      (videoTrackRef.current as any).recoveryAttempts = recoveryAttempts + 1;
      
      console.log(`Recovery attempt ${recoveryAttempts + 1} for video track`);
      
      // Attempt automatic recovery with proper cleanup and restart
      const attemptRecovery = async () => {
        try {
          // Update state to show recovery in progress
          setState(prev => ({ 
            ...prev, 
            error: 'Camera stream interrupted. Attempting to reconnect...',
            isScanning: false,
            cameraStatus: 'initializing'
          }));
          
          // Stop the problematic track
          if (streamRef.current) {
            const tracks = streamRef.current.getVideoTracks();
            for (const track of tracks) {
              track.stop();
            }
            streamRef.current = null;
          }
          
          // Comprehensive video element reset
          if (videoRef.current) {
            // Pause and reset video element
            videoRef.current.pause();
            
            // Clear any existing play promises
            if (playPromiseRef.current) {
              try {
                await playPromiseRef.current;
              } catch (e) {
                // Ignore play promise errors during reset
              }
              playPromiseRef.current = null;
            }
            
            // Clear video source and reset
            videoRef.current.srcObject = null;
            videoRef.current.load();
            
            // Reset video state
            videoRef.current.currentTime = 0;
          }
          
          // Small delay to allow device to reset
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Request new camera stream with flexible constraints
          // Try environment camera first, then fallback to any available camera
          let mediaStream: MediaStream | null = null;
          
          // Get available devices for fallback logic
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          
          // Priority 1: Try environment camera first
          try {
            const envConstraints: MediaStreamConstraints = {
              video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            };
            mediaStream = await navigator.mediaDevices.getUserMedia(envConstraints);
            console.log('Successfully acquired environment camera');
          } catch (envError) {
            console.warn('Environment camera not available, trying any available camera');
            
            // Priority 2: Try any available camera with specific device selection
            if (videoDevices.length > 0) {
              const deviceId = videoDevices[0].deviceId;
              const fallbackConstraints: MediaStreamConstraints = {
                video: {
                  deviceId: { exact: deviceId },
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }
              };
              mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
              console.log('Successfully acquired fallback camera');
            } else {
              throw new Error('No camera devices available');
            }
          }
          
          if (!mediaStream) {
            throw new Error('Failed to acquire camera stream');
          }
          
          // Update stream reference
          streamRef.current = mediaStream;
          
          // Reset recovery attempts on successful recovery
          (videoTrackRef.current as any).recoveryAttempts = 0;
          
          // Setup video track monitoring for the new stream
          setupVideoTrackMonitoring(mediaStream);
          
          // Attach new stream to video element with comprehensive reset
          if (videoRef.current) {
            // Final reset before attaching new stream
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            videoRef.current.srcObject = null;
            videoRef.current.load();
            
            // Attach new stream
            videoRef.current.srcObject = streamRef.current;
            
            // Wait for video to be ready with proper event handling
            await new Promise<void>((resolve, reject) => {
              const LOADEDMETADATA_TIMEOUT = 10000; // 10 seconds
              let resolved = false;
              
              const onLoadedMetadata = () => {
                resolved = true;
                if (videoRef.current) {
                  videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
                }
                resolve();
              };
              
              const onCanPlay = () => {
                if (videoRef.current) {
                  videoRef.current.removeEventListener('canplay', onCanPlay);
                }
                resolve();
              };
              
              if (!videoRef.current) {
                reject(new Error('Video element is null during recovery'));
                return;
              }
              
              videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
              videoRef.current.addEventListener('canplay', onCanPlay);
              
              // Timeout with proper null checks
              setTimeout(() => {
                if (!resolved && videoRef.current) {
                  videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
                  videoRef.current.removeEventListener('canplay', onCanPlay);
                  reject(new Error('Video recovery timeout'));
                }
              }, LOADEDMETADATA_TIMEOUT);
            });
            
            // Start playing the video with user gesture handling
            try {
              await videoRef.current.play();
              console.log('Video playback started successfully');
            } catch (playError) {
              console.error('Failed to play video during recovery:', playError);
              throw new Error('Video playback failed during recovery');
            }
          }
          
          // Update state to show successful recovery
          setState(prev => ({ 
            ...prev, 
            error: null,
            isScanning: true,
            cameraStatus: 'active'
          }));
          
          isScanningRef.current = true;
          videoReadyRef.current = true;
          
          console.log('Video track recovery successful');
          
          // Restart scanning
          scanFrameRef.current();
          
        } catch (error) {
          console.error('Video track recovery failed:', error);
          
          // Update state to show recovery failure
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to recover camera stream. Please restart the scanner.',
            isScanning: false,
            cameraStatus: 'error'
          }));
          
          isScanningRef.current = false;
        }
      };
      
      // Execute recovery
      attemptRecovery();
    };

    const handleTrackUnmute = () => {
      console.warn('Video track unmuted');
    };

    videoTrack.addEventListener('ended', handleTrackEnded);
    videoTrack.addEventListener('mute', handleTrackMute);
    videoTrack.addEventListener('unmute', handleTrackUnmute);

    // Return cleanup function
    return () => {
      videoTrack.removeEventListener('ended', handleTrackEnded);
      videoTrack.removeEventListener('mute', handleTrackMute);
      videoTrack.removeEventListener('unmute', handleTrackUnmute);
    };
  }, []);

  // Validate video element readiness with detailed logging
  const isVideoReady = useCallback((video: HTMLVideoElement): boolean => {
    // Check readyState - need at least HAVE_CURRENT_DATA (2) for frames to be available
    if (video.readyState < 2) {
      console.debug(`Video not ready: readyState=${video.readyState} (need >= 2)`);
      return false;
    }

    // Check if srcObject is set and active
    if (!video.srcObject) {
      console.debug('Video srcObject not set');
      return false;
    }

    const stream = video.srcObject as MediaStream;
    if (!stream.active) {
      console.debug('Video stream not active');
      return false;
    }

    // Check if video is paused (should be playing during scanning)
    if (video.paused) {
      console.debug('Video is paused');
      return false;
    }

    // Check video dimensions are valid
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.debug(`Video dimensions invalid: ${video.videoWidth}x${video.videoHeight}`);
      return false;
    }

    // All checks passed
    console.debug(`Video ready: ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}, active=${stream.active}`);
    return true;
  }, []);

  // Video error event handler setup with detailed error information
  const setupVideoErrorHandler = useCallback((video: HTMLVideoElement, onError: (error: string) => void) => {
    const handleMediaError = (e: Event) => {
      const target = e.target as HTMLVideoElement;
      const error = target.error;

      let errorMessage = 'Unknown video error';
      let errorCode = 0;
      
      if (error) {
        errorCode = error.code;
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video playback was aborted. Please try restarting the scanner.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error during video playback. Please check your connection and try again.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video decoding error. The video format may not be supported.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video source not supported. Please try a different camera or browser.';
            break;
          default:
            errorMessage = `Video error (code: ${error.code})`;
        }
      }

      console.error('Video element error:', errorMessage, { errorCode, error });
      
      // Provide additional context for debugging
      if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
        console.error('Network error suggests: camera disconnected, bandwidth issues, or server problems');
      } else if (errorCode === MediaError.MEDIA_ERR_DECODE) {
        console.error('Decode error suggests: unsupported video format or corrupted data');
      } else if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        console.error('Source not supported suggests: incompatible camera or codec issues');
      }
      
      onError(errorMessage);
    };

    video.addEventListener('error', handleMediaError);

    return () => {
      video.removeEventListener('error', handleMediaError);
    };
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

    const MAX_RETRIES = 3; // Increased retries
    const RETRY_DELAY = 1500; // 1.5 seconds between retries for better device recovery
    let attempts = 0;

    // Comprehensive cleanup function
    const cleanupAll = () => {
      // Clear all timeout refs
      if (canPlayTimeoutRef.current) {
        clearTimeout(canPlayTimeoutRef.current);
        canPlayTimeoutRef.current = null;
      }
      if (loadedMetadataTimeoutRef.current) {
        clearTimeout(loadedMetadataTimeoutRef.current);
        loadedMetadataTimeoutRef.current = null;
      }
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }

      // Clean up stream if it was created
      if (streamRef.current) {
        try {
          const tracks = streamRef.current.getTracks();
          for (const track of tracks) {
            track.stop();
          }
        } catch (e) {
          console.debug('Error stopping stream tracks:', e);
        }
        streamRef.current = null;
      }

      // Reset video element state with comprehensive cleanup
      if (videoElement) {
        try {
          videoElement.pause();
        } catch (e) {
          console.debug('Error pausing video element:', e);
        }
        
        try {
          videoElement.currentTime = 0;
        } catch (e) {
          console.debug('Error resetting video currentTime:', e);
        }
        
        try {
          videoElement.srcObject = null;
        } catch (e) {
          console.debug('Error clearing video srcObject:', e);
        }
        
        try {
          videoElement.load();
        } catch (e) {
          console.debug('Error calling video load():', e);
        }
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

        // Request camera permission and get stream
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: configState.cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        // Get user media with proper error handling
        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaError) {
          if (mediaError instanceof Error && mediaError.name === 'NotAllowedError') {
            setState(prev => ({ 
              ...prev, 
              isScanning: false,
              error: 'Camera permission denied. Please allow camera access to scan barcodes.'
            }));
            return false;
          } else if (mediaError instanceof Error && mediaError.name === 'NotFoundError') {
            setState(prev => ({ 
              ...prev, 
              isScanning: false,
              error: 'No camera found. Please connect a camera to scan barcodes.'
            }));
            return false;
          } else {
            throw mediaError; // Re-throw for generic handling
          }
        }
        
        streamRef.current = mediaStream;
        setState(prev => ({ ...prev, cameraStatus: 'ready' }));
        
        // Setup video track monitoring
        const cleanupTrackMonitoring = setupVideoTrackMonitoring(mediaStream);
        
        // Setup video error handler
        const cleanupErrorHandler = setupVideoErrorHandler(videoElement, (errorMessage) => {
          setState(prev => ({ ...prev, error: errorMessage }));
        });
        
        // Properly handle video element state before setting srcObject
        if (videoElement.srcObject) {
          // If there's an existing stream, stop all tracks first
          const existingStream = videoElement.srcObject as MediaStream;
          existingStream.getTracks().forEach((track: MediaStreamTrack) => {
            track.stop();
          });
        }
        
        // Comprehensive video element reset to prevent play() interruption
        videoElement.pause();
        videoElement.currentTime = 0;
        videoElement.srcObject = null;
        
        // Additional reset calls to ensure clean state
        videoElement.load();
        
        // Give the browser time to fully reset the video element
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Set the new stream FIRST, then wait for events
        videoElement.srcObject = streamRef.current;
        
        // Log video element state for debugging
        console.log(`Video element state before waiting: readyState=${videoElement.readyState}, videoWidth=${videoElement.videoWidth}, videoHeight=${videoElement.videoHeight}`);
        
        // Wait for loadedmetadata to ensure the stream is properly attached with extended timeout
        const LOADEDMETADATA_TIMEOUT = 10000; // 10 seconds timeout for slower devices
        let loadedMetadataResolved = false;
        
        const loadedMetadataPromise = new Promise<void>((resolve, reject) => {
          const onLoadedMetadata = () => {
            loadedMetadataResolved = true;
            videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };
          videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
          
          // Timeout handler with proper null check
          loadedMetadataTimeoutRef.current = window.setTimeout(() => {
            if (!loadedMetadataResolved) {
              videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
              reject(new Error('Video loadedmetadata timeout'));
            }
          }, LOADEDMETADATA_TIMEOUT);
        });

        try {
          await loadedMetadataPromise;
          console.log('Video loadedmetadata event received');
        } catch (timeoutError) {
          console.error('loadedmetadata timeout:', timeoutError);
          if (cleanupTrackMonitoring) cleanupTrackMonitoring();
          if (cleanupErrorHandler) cleanupErrorHandler();
          throw timeoutError; // Re-throw for retry logic
        } finally {
          if (loadedMetadataTimeoutRef.current) {
            clearTimeout(loadedMetadataTimeoutRef.current);
            loadedMetadataTimeoutRef.current = null;
          }
        }

        // Handle any existing play promise to prevent interruption
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch (e) {
            // Ignore errors from interrupted play requests
          }
          playPromiseRef.current = null;
        }

        // Start playing the video with extended timeout and better error handling
        const PLAY_TIMEOUT = 10000; // 10 seconds timeout for slower devices
        const currentPlayPromise = videoElement.play();
        playPromiseRef.current = currentPlayPromise;
        
        // Create a timeout promise
        const playTimeoutPromise = new Promise<never>((_, reject) => {
          playTimeoutRef.current = window.setTimeout(() => {
            reject(new Error('Video play timeout'));
          }, PLAY_TIMEOUT);
        });
        
        try {
          // Race between play and timeout
          await Promise.race([
            currentPlayPromise.then(() => 'success' as const),
            playTimeoutPromise
          ]);
          console.log('Video playback started successfully');
          
          // Mark that we have successful playback (implies user interaction requirement was met)
          hasUserInteractionRef.current = true;
        } catch (playError) {
          console.error('Video play failed:', playError);
          
          // Additional error handling for play failures
          if (playError instanceof Error && playError.message.includes('play timeout')) {
            // Try one more time with a fresh start
            console.log('Retrying video play...');
            try {
              videoElement.pause();
              videoElement.currentTime = 0;
              await new Promise(resolve => setTimeout(resolve, 200));
              const retryPlayPromise = videoElement.play();
              playPromiseRef.current = retryPlayPromise;
              
              // Wait for retry with shorter timeout
              await Promise.race([
                retryPlayPromise.then(() => 'success' as const),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Video play retry timeout')), 5000))
              ]);
              console.log('Video playback started on retry');
              hasUserInteractionRef.current = true;
            } catch (retryError) {
              console.error('Video play retry failed:', retryError);
              throw new Error('Failed to play video after retry');
            }
          } else if (playError instanceof Error && (
            playError.name === 'NotAllowedError' || 
            playError.message.includes('play() can only be initiated by a user gesture')
          )) {
            // User interaction required - this is expected in some browsers
            console.warn('Video play requires user interaction - this is normal in modern browsers');
            
            // Try to get user interaction by requesting focus
            videoElement.focus();
            
            // Try play one more time after getting focus
            try {
              await new Promise(resolve => setTimeout(resolve, 100));
              const gesturePlayPromise = videoElement.play();
              playPromiseRef.current = gesturePlayPromise;
              await Promise.race([
                gesturePlayPromise.then(() => 'success' as const),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('User gesture play timeout')), 3000))
              ]);
              hasUserInteractionRef.current = true;
              console.log('Video playback started after user interaction');
            } catch (gestureError) {
              // Final fallback - just proceed with scanning if we got metadata
              console.warn('Could not start video playback, proceeding with scanning anyway:', gestureError);
              // Still mark as ready since we have metadata
              hasUserInteractionRef.current = true;
            }
          } else {
            throw playError;
          }
        }
        
        // Clear the timeout if play succeeded
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
          playTimeoutRef.current = null;
        }

        videoReadyRef.current = true;
        isScanningRef.current = true;
        setState(prev => ({ ...prev, cameraStatus: 'active', isScanning: true }));

        // Start continuous scanning
        scanFrame();
        return true;

      } catch (error) {
        let errorMessage = 'Failed to start camera';
        let shouldRetry = false;
        let errorDetails = '';

        if (error instanceof Error) {
          errorDetails = error.message;
          
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera permission denied. Please allow camera access.';
          } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please connect a camera.';
          } else if (
            error.message.includes('timeout') ||
            error.message.includes('play') ||
            error.message.includes('canplay') ||
            error.message.includes('loadedmetadata')
          ) {
            errorMessage = 'Camera initialization failed. Please try again.';
            shouldRetry = true;
          } else if (error.message.includes('not allowed')) {
            errorMessage = 'Camera access not allowed. Please check browser permissions.';
            shouldRetry = true;
          } else {
            errorMessage = error.message;
            // Retry on unknown errors too, but less aggressively
            shouldRetry = attempts < 2;
          }
        }
        
        // Enhanced retry logic with better timeout detection
        if (shouldRetry && attempts < MAX_RETRIES) {
          console.log(`Camera initialization attempt ${attempts} failed (${errorDetails}), retrying...`);
          // Comprehensive cleanup before retry
          cleanupAll();
          // Wait before retrying with exponential backoff
          const backoffMs = RETRY_DELAY * Math.pow(1.5, attempts - 1);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return attemptStart(); // Recursive retry
        }
        
        // Final cleanup on failure
        cleanupAll();
        
        setState(prev => ({ 
          ...prev, 
          isScanning: false,
          error: errorMessage,
          cameraStatus: 'error'
        }));
        isScanningRef.current = false;
        return false;
      }
    };

    await attemptStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configState.cameraFacing, initializeReader, scanFrame, setupVideoTrackMonitoring, setupVideoErrorHandler]);

  // Stop scanning with comprehensive cleanup
  const stopScanning = useCallback(() => {
    isScanningRef.current = false;
    videoReadyRef.current = false;

    // Clear all pending timeouts with null checks
    if (canPlayTimeoutRef.current) {
      clearTimeout(canPlayTimeoutRef.current);
      canPlayTimeoutRef.current = null;
    }
    if (loadedMetadataTimeoutRef.current) {
      clearTimeout(loadedMetadataTimeoutRef.current);
      loadedMetadataTimeoutRef.current = null;
    }
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }

    // Cancel any pending play request
    if (playPromiseRef.current) {
      playPromiseRef.current.then(() => {
        // Play completed successfully, nothing to do
      }).catch((e) => {
        // Play was interrupted or failed, ignore the error
        console.debug('Play interrupted:', e);
      });
      playPromiseRef.current = null;
    }

    // Stop all tracks in the current stream
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        for (const track of tracks) {
          track.stop();
        }
      } catch (e) {
        console.debug('Error stopping stream tracks during cleanup:', e);
      }
      streamRef.current = null;
    }

    // Clean up video element with comprehensive null checks
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (e) {
        console.debug('Error pausing video element:', e);
      }
      
      try {
        videoRef.current.srcObject = null;
      } catch (e) {
        console.debug('Error clearing video srcObject:', e);
      }
      
      // Clear video ref last to ensure we don't have dangling references
      videoRef.current = null;
    }

    setState(prev => ({ ...prev, isScanning: false, cameraStatus: undefined }));
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
