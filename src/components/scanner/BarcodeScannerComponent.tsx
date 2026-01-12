/**
 * Barcode Scanner Component using react-qr-barcode-scanner
 * 
 * This component wraps the react-qr-barcode-scanner library while maintaining
 * compatibility with the existing useBarcodeScanner hook interface.
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { BarcodeStringFormat } from 'react-qr-barcode-scanner';
import type { ScanResult, ScanConfig } from '../../types';

// Scanner props interface matching our existing API
export interface ScannerProps {
  onScan?: (result: ScanResult) => void;
  onError?: (error: Error) => void;
  config?: Partial<ScanConfig>;
  className?: string;
  style?: React.CSSProperties;
  isFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
}

// Default formats for book barcodes
const defaultBookFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

// Import the library component
import BarcodeScannerLib from 'react-qr-barcode-scanner';

export function BarcodeScannerComponent({
  onScan,
  onError,
  config = {},
  className,
  style,
  isFlipped: externalFlipped,
  onFlipChange
}: ScannerProps) {
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'initializing' | 'ready' | 'streaming' | 'active' | 'error' | undefined>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<{readyState: number; videoWidth: number; videoHeight: number} | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [internalFlipped, setInternalFlipped] = useState(true); // Default to flipped (mirror)
  
  // Use external flipped state if provided, otherwise use internal
  const isFlipped = externalFlipped !== undefined ? externalFlipped : internalFlipped;
  const setFlipped = (value: boolean) => {
    if (onFlipChange) {
      onFlipChange(value);
    } else {
      setInternalFlipped(value);
    }
  };
  
  // Load flip preference from localStorage on mount
  useEffect(() => {
    if (externalFlipped === undefined) {
      const savedFlip = localStorage.getItem('scannerMirrorEnabled');
      if (savedFlip !== null) {
        setInternalFlipped(savedFlip === 'true');
      }
    }
  }, [externalFlipped]);
  
  // Refs for video monitoring
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const frameCountRef = useRef(0);
  const lastScanTimeRef = useRef<number>(0);
  const isScanningRef = useRef(false);
  
  const scanCooldown = 1000; // 1 second between same scans

  const scanConfig: ScanConfig = {
    enabled: true,
    cameraFacing: 'environment',
    autoScan: true,
    scanInterval: 500,
    formats: defaultBookFormats,
    ...config
  };

  // Enhanced video constraints for better barcode detection
  // Higher resolution helps with detecting smaller barcodes
  const videoConstraints = {
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    facingMode: scanConfig.cameraFacing,
    aspectRatio: { ideal: 1.777778 },
    frameRate: { ideal: 30, min: 15 },
    audio: false
  };

  // Save flip preference to localStorage when it changes (only if using internal state)
  useEffect(() => {
    if (externalFlipped === undefined) {
      localStorage.setItem('scannerMirrorEnabled', String(isFlipped));
    }
  }, [isFlipped, externalFlipped]);

  // Monitor video element readyState - essential for barcode detection
  useEffect(() => {
    const checkVideoState = setInterval(() => {
      if (!videoElementRef.current) {
        // Try to find video element in the DOM
        const container = containerRef.current;
        if (container) {
          const videoElement = container.querySelector('video');
          if (videoElement) {
            videoElementRef.current = videoElement as HTMLVideoElement;
          }
        }
        return;
      }

      const video = videoElementRef.current;
      const currentReadyState = video.readyState;
      const currentVideoWidth = video.videoWidth;
      const currentVideoHeight = video.videoHeight;

      // Update video info state for display
      setVideoInfo({
        readyState: currentReadyState,
        videoWidth: currentVideoWidth,
        videoHeight: currentVideoHeight
      });

      // Only allow scanning when video has enough data (readyState >= 2)
      if (currentReadyState >= 2 && !isScanningRef.current) {
        isScanningRef.current = true;
        setScanActive(true);
        setCameraStatus('ready');
      } else if (currentReadyState < 2 && isScanningRef.current) {
        isScanningRef.current = false;
        setScanActive(false);
        setCameraStatus('initializing');
      }
    }, 100);

    return () => {
      clearInterval(checkVideoState);
    };
  }, []);

  const handleUpdate = useCallback((err: unknown, result?: any) => {
    // Track frame count
    frameCountRef.current++;
    setFrameCount(frameCountRef.current);
    
    if (err) {
      // Handle expected "no barcode found" errors gracefully
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Suppress expected "no barcode" errors - these are not real errors
      if (errorMessage.includes('No MultiFormat Readers') || 
          errorMessage.includes('No barcode') || 
          errorMessage.includes('NotFound') ||
          errorMessage.includes('No MultiFormat Reader')) {
        return;
      }
      
      // Only handle actual errors (camera permission, etc.)
      if (errorMessage.includes('Permission') || 
          errorMessage.includes('NotAllowed') ||
          errorMessage.includes('NotFound') ||
          errorMessage.includes('Device') ||
          errorMessage.includes('Stream')) {
        setError(errorMessage);
        setCameraStatus('error');
        onError?.(new Error(errorMessage));
      }
      return;
    }

    if (result) {
      const now = Date.now();
      const resultText = result.getText ? result.getText() : result.text;
      
      // Debounce duplicate scans
      if (resultText === lastScan?.text && now - lastScanTimeRef.current < scanCooldown) {
        return;
      }

      lastScanTimeRef.current = now;

      const scanResult: ScanResult = {
        text: resultText,
        format: result.getBarcodeFormat ? result.getBarcodeFormat().toString() : (result.format || 'unknown'),
        timestamp: new Date()
      };

      setLastScan(scanResult);
      setCameraStatus('active');
      onScan?.(scanResult);
    }
  }, [lastScan, onScan, onError]);

  const handleError = useCallback((err: string | DOMException) => {
    const errorMessage = err instanceof DOMException ? err.message : String(err);
    setError(errorMessage);
    setCameraStatus('error');
    onError?.(new Error(errorMessage));
  }, [onError]);

  return (
    <div ref={containerRef} className={className} style={style}>
      <div style={{ 
        width: '100%', 
        height: '100%',
        transform: isFlipped ? 'scaleX(-1)' : 'scaleX(1)',
        transition: 'transform 0.3s ease'
      }}>
        <BarcodeScannerLib
          width="100%"
          height="100%"
          onUpdate={handleUpdate}
          onError={handleError}
          facingMode={scanConfig.cameraFacing}
          delay={1000}
          stopStream={false}
          videoConstraints={videoConstraints}
        />
      </div>
      
      {/* Flip toggle button */}
      <button
        type="button"
        onClick={() => setFlipped(!isFlipped)}
        className="absolute top-2 right-2 z-50 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
        title={isFlipped ? 'Mirror off' : 'Mirror on'}
        style={{ fontSize: '12px' }}
      >
        {isFlipped ? '🔄 Mirrored' : '🔒 Normal'}
      </button>
      
      {/* Status panel */}
      <div style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'rgba(0,0,0,0.7)', 
        color: 'white', 
        padding: '12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>Camera:</strong> {
              cameraStatus === 'initializing' ? 'Initializing...' :
              cameraStatus === 'ready' ? 'Ready' :
              cameraStatus === 'streaming' ? 'Streaming' :
              cameraStatus === 'active' ? 'Active' :
              cameraStatus === 'error' ? 'Error' : 'Unknown'
            }
          </div>
          
          <div>
            <strong>Video:</strong> {
              videoInfo ? (
                `${videoInfo.videoWidth > 0 ? videoInfo.videoWidth : '?'}×${videoInfo.videoHeight > 0 ? videoInfo.videoHeight : '?'} (readyState: ${videoInfo.readyState})`
              ) : 'Loading...'
            }
          </div>
          
          <div>
            <strong>Frames:</strong> {frameCount} {scanActive ? '✓' : '⏸'}
          </div>
        </div>
        
        {lastScan && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
            <strong>Last scan:</strong> {lastScan.text} ({lastScan.format})
          </div>
        )}
        
        {error && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)', color: '#ff6b6b' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default BarcodeScannerComponent;