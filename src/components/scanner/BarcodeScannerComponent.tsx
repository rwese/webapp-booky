/**
 * Barcode Scanner Component using react-qr-barcode-scanner
 * 
 * This component wraps the react-qr-barcode-scanner library while maintaining
 * compatibility with the existing useBarcodeScanner hook interface.
 */

import React, { useRef, useCallback, useState } from 'react';
import { BarcodeStringFormat } from 'react-qr-barcode-scanner';
import type { ScanResult, ScanConfig } from '../../types';

// Scanner props interface matching our existing API
export interface ScannerProps {
  onScan?: (result: ScanResult) => void;
  onError?: (error: Error) => void;
  config?: Partial<ScanConfig>;
  className?: string;
  style?: React.CSSProperties;
}

// Format mapping from our types to library formats
const formatMapping: Record<string, BarcodeStringFormat> = {
  'ean_13': BarcodeStringFormat.EAN_13,
  'ean_8': BarcodeStringFormat.EAN_8, 
  'upc_a': BarcodeStringFormat.UPC_A,
  'upc_e': BarcodeStringFormat.UPC_E,
  'code_128': BarcodeStringFormat.CODE_128,
  'code_39': BarcodeStringFormat.CODE_39,
  'qr_code': BarcodeStringFormat.QR_CODE,
  'data_matrix': BarcodeStringFormat.DATA_MATRIX,
  'pdf_417': BarcodeStringFormat.PDF_417
};

// Convert our format list to library format
const getLibraryFormats = (formats: string[]): BarcodeStringFormat[] => {
  return formats
    .map(f => formatMapping[f])
    .filter((f): f is BarcodeStringFormat => f !== undefined);
};

// Default formats for book barcodes
const defaultBookFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

// Import the library component
import BarcodeScanner from 'react-qr-barcode-scanner';

export function BarcodeScannerComponent({
  onScan,
  onError,
  config = {},
  className,
  style
}: ScannerProps) {
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'initializing' | 'ready' | 'streaming' | 'active' | 'error' | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  
  // Debounce scan results to avoid duplicates
  const lastScanTimeRef = useRef<number>(0);
  const scanCooldown = 1000; // 1 second between same scans

  const scanConfig: ScanConfig = {
    enabled: true,
    cameraFacing: 'environment',
    autoScan: true,
    scanInterval: 500,
    formats: defaultBookFormats,
    ...config
  };

  const handleUpdate = useCallback((err: unknown, result?: any) => {
    if (err) {
      // Handle expected "no barcode found" errors gracefully
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Suppress expected "no barcode" errors - these are not real errors
      if (errorMessage.includes('No MultiFormat Readers') || 
          errorMessage.includes('No barcode') || 
          errorMessage.includes('NotFound') ||
          errorMessage.includes('No MultiFormat Reader')) {
        // These are expected - no barcode in frame, silently ignore
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
      
      // Debounce duplicate scans
      const resultText = result.getText ? result.getText() : result.text;
      
      // Debug output when barcode is detected
      console.debug('[BarcodeScanner] Code detected:', {
        text: resultText,
        format: result.getBarcodeFormat ? result.getBarcodeFormat().toString() : (result.format || 'unknown'),
        timestamp: new Date().toISOString()
      });
      
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
    console.debug('[BarcodeScanner] Camera error:', errorMessage);
    setError(errorMessage);
    setCameraStatus('error');
    onError?.(new Error(errorMessage));
  }, [onError]);

  return (
    <div className={className} style={style}>
      <BarcodeScanner
        width={500}
        height={500}
        onUpdate={handleUpdate}
        onError={handleError}
        facingMode={scanConfig.cameraFacing}
        formats={getLibraryFormats(scanConfig.formats)}
        delay={scanConfig.scanInterval}
        stopStream={true} // Enable proper cleanup
      />
      
      {/* Status indicator */}
      {cameraStatus && (
        <div className={`camera-status status-${cameraStatus}`}>
          {cameraStatus === 'initializing' && 'Initializing camera...'}
          {cameraStatus === 'ready' && 'Camera ready'}
          {cameraStatus === 'streaming' && 'Streaming'}
          {cameraStatus === 'active' && 'Active'}
          {cameraStatus === 'error' && `Error: ${error || 'Camera error'}`}
        </div>
      )}
      
      {/* Last scan result */}
      {lastScan && (
        <div className="last-scan-result">
          <strong>Last scan:</strong> {lastScan.text} ({lastScan.format})
        </div>
      )}
    </div>
  );
}

export default BarcodeScannerComponent;
