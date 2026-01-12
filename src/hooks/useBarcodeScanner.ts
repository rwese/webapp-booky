/**
 * Barcode Scanner Hook
 * 
 * Hook for managing barcode scanning functionality using react-qr-barcode-scanner.
 */

import { useCallback, useState, useRef } from 'react';
import type { ScanResult, ScanConfig, ScanState } from '../types';
import { defaultScanConfig } from '../lib/barcodeUtils';

// Re-export types for convenience
export type { ScanResult, ScanConfig, ScanState } from '../types';

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
    ...defaultScanConfig,
    ...config
  });

  const lastScanTimeRef = useRef<number>(0);
  const scanCooldown = 1000; // 1 second between duplicate scans

  const handleScan = useCallback((result: ScanResult) => {
    console.debug('[useBarcodeScanner] Processing scan result:', {
      text: result.text,
      format: result.format,
      timestamp: result.timestamp.toISOString()
    });
    
    const now = Date.now();
    
    // Debounce duplicate scans
    if (result.text === state.lastScan?.text && now - lastScanTimeRef.current < scanCooldown) {
      console.debug('[useBarcodeScanner] Duplicate scan detected, skipping:', result.text);
      return;
    }

    lastScanTimeRef.current = now;

    setState(prev => ({ ...prev, lastScan: result }));
    
    // Note: The barcode:scanned event is emitted by the BarcodeScannerModal component
    // to ensure proper timing and avoid duplicate events
  }, [state.lastScan]);

  const handleError = useCallback((error: Error) => {
    console.warn('[useBarcodeScanner] Scanner error:', error.message);
    setState(prev => ({ 
      ...prev, 
      error: error.message 
    }));
  }, []);

  const startScanning = useCallback(async () => {
    console.debug('[useBarcodeScanner] Starting scanner...');
    setState(prev => ({ 
      ...prev, 
      isScanning: true, 
      error: null 
    }));

    // Get available camera devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.debug(`[useBarcodeScanner] Found ${videoDevices.length} camera devices`);
      setState(prev => ({ ...prev, cameraDevices: videoDevices }));
    } catch (err) {
      console.warn('[useBarcodeScanner] Failed to enumerate devices:', err);
      setState(prev => ({ ...prev, cameraDevices: [] }));
    }
  }, []);

  const stopScanning = useCallback(() => {
    console.debug('[useBarcodeScanner] Stopping scanner...');
    setState(prev => ({ 
      ...prev, 
      isScanning: false 
    }));
  }, []);

  const toggleFlash = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      flashEnabled: !prev.flashEnabled 
    }));
  }, []);

  const switchCamera = useCallback(async () => {
    const devices = state.cameraDevices;
    const currentIndex = devices.findIndex(d => d.deviceId === state.selectedDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    if (nextDevice) {
      setState(prev => ({ 
        ...prev, 
        selectedDevice: nextDevice.deviceId 
      }));
      stopScanning();
    }
  }, [state.cameraDevices, state.selectedDevice, stopScanning]);

  const retryScanning = useCallback(async () => {
    setState(prev => ({ ...prev, error: null }));
    await startScanning();
  }, [startScanning]);

  return {
    state,
    config: configState,
    startScanning,
    stopScanning,
    toggleFlash,
    switchCamera,
    retryScanning,
    handleScan,
    handleError
  };
}
