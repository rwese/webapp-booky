import { useState, useRef, useCallback, useEffect } from 'react';
import type { ScanResult, ScanQueueItem, Book } from '../../types';
import { CameraOff, Flashlight, FlashlightOff, X, RotateCcw, Check, AlertCircle, Clock, BookOpen, RefreshCw } from 'lucide-react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useManualISBNEntry } from '../../hooks/useManualISBNEntry';
import { useBatchScanning } from '../../hooks/useBatchScanning';
import { useModalStore, useToastStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { BarcodeScannerComponent } from './BarcodeScannerComponent';

// Haptic and audio feedback helper
function provideScanFeedback() {
  // Vibrate if available (50ms pulse)
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
  
  // Play beep sound using Web Audio API
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // High-pitched beep (1800Hz) for success
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1800, audioContext.currentTime);
    
    // Short duration with quick fade
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    // Audio not available, ignore
  }
}

// Barcode Scanner Modal Component
export function BarcodeScannerModal() {
  const { closeModal } = useModalStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const processedScanRef = useRef<string | null>(null);
  const [isCameraMirrored, setIsCameraMirrored] = useState(true); // Default to mirrored
  
  // Load mirror preference from localStorage on mount
  useEffect(() => {
    const savedMirror = localStorage.getItem('scannerMirrorEnabled');
    if (savedMirror !== null) {
      setIsCameraMirrored(savedMirror === 'true');
    }
  }, []);

  // Save mirror preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('scannerMirrorEnabled', String(isCameraMirrored));
  }, [isCameraMirrored]);

  const { 
    state: scanState, 
    startScanning, 
    stopScanning, 
    toggleFlash,
    switchCamera,
    retryScanning,
    handleScan,
    handleError
  } = useBarcodeScanner();

  const manualISBN = useManualISBNEntry();
  const batchScan = useBatchScanning();

  // Camera status indicator
  const getCameraStatusIndicator = () => {
    switch (scanState.cameraStatus) {
      case 'initializing':
        return (
          <div className="absolute top-4 left-4 bg-yellow-500/80 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Initializing camera...
          </div>
        );
      case 'ready':
        return (
          <div className="absolute top-4 left-4 bg-blue-500/80 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full" />
            Camera ready
          </div>
        );
      case 'streaming':
        return (
          <div className="absolute top-4 left-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Streaming
          </div>
        );
      case 'active':
        return (
          <div className="absolute top-4 left-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full" />
            Active
          </div>
        );
      case 'error':
        return (
          <div className="absolute top-4 left-4 bg-red-500/80 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full" />
            Camera error
          </div>
        );
      default:
        return null;
    }
  };

  // Handle successful scan
  // Start scanning when modal opens
  useEffect(() => {
    if (!showManualEntry) {
      startScanning();
    }

    return () => {
      stopScanning();
    };
  }, [showManualEntry, startScanning, stopScanning]);

  const handleClose = useCallback(() => {
    stopScanning();
    closeModal();
  }, [stopScanning, closeModal]);

  // Handle successful scan
  useEffect(() => {
    if (!lastScan) return;

    // Check if we've already processed this scan
    if (processedScanRef.current === lastScan.text) return;
    processedScanRef.current = lastScan.text;

    // Provide haptic and audio feedback for successful scan
    provideScanFeedback();

    // If batch mode is active, add to queue with auto-lookup
    if (showBatchMode) {
      batchScan.lookupAndAddToQueue(lastScan.text).then((result) => {
        if (result === 'success') {
          addToast({ type: 'success', message: 'Book found!' });
        } else if (result === 'error') {
          addToast({ type: 'error', message: 'Book not found' });
        } else if (result === 'duplicate') {
          addToast({ type: 'warning', message: 'Already in queue' });
        }
      });
    } else {
      // Single mode: navigate to AddBook page and populate fields
      const isbn = lastScan.text;
      const format = lastScan.format;
      
      // Navigate to AddBook page if not already there
      navigate('/add', { replace: true });
      
      // Use setTimeout to ensure navigation completes before emitting event
      setTimeout(() => {
        // Emit event for book lookup
        window.dispatchEvent(new CustomEvent('barcode:scanned', { 
          detail: { text: isbn, format } 
        }));
        
        // Close the scanner modal
        handleClose();
      }, 100);
    }
  }, [lastScan, showBatchMode, batchScan, addToast, navigate, handleClose]);

  const onScan = useCallback((result: ScanResult) => {
    setLastScan(result);
    handleScan(result);
  }, [handleScan]);

  const onError = useCallback((error: Error) => {
    handleError(error);
  }, [handleError]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode Scanner"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 text-white">
        <h2 className="text-lg font-semibold">Scan ISBN Barcode</h2>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          aria-label="Close scanner"
        >
          <X size={24} />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        {!showManualEntry && (
          <BarcodeScannerComponent
            onScan={onScan}
            onError={onError}
            className="w-64 h-48"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            isFlipped={isCameraMirrored}
            onFlipChange={setIsCameraMirrored}
          />
        )}
        {getCameraStatusIndicator()}
      </div>

      {/* Controls */}
      <div className="p-4 bg-black/50 text-white space-y-4">
        {/* Mode Tabs */}
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => setShowManualEntry(false)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              !showManualEntry ? 'bg-primary-500 text-white' : 'bg-white/20'
            )}
          >
            Camera
          </button>
          <button
            type="button"
            onClick={() => setShowManualEntry(true)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              showManualEntry ? 'bg-primary-500 text-white' : 'bg-white/20'
            )}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setShowBatchMode(!showBatchMode)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              showBatchMode ? 'bg-primary-500 text-white' : 'bg-white/20'
            )}
          >
            Batch ({batchScan.state.queue.length})
          </button>
        </div>

        {/* Camera Controls */}
        {!showManualEntry && !showBatchMode && (
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setIsCameraMirrored(!isCameraMirrored)}
              className={clsx(
                'p-3 rounded-full transition-colors',
                isCameraMirrored ? 'bg-primary-500 text-white' : 'bg-white/20 text-white'
              )}
              aria-label={isCameraMirrored ? 'Disable camera mirror' : 'Enable camera mirror'}
              title={isCameraMirrored ? 'Camera mirrored (tap to disable)' : 'Camera normal (tap to enable mirror)'}
            >
              {isCameraMirrored ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <title>Mirrored camera</title>
                  <path d="M20 3l-4 4-4-4M4 21l4-4 4-4" />
                  <path d="M12 3v18" />
                  <path d="M4 21h16" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <title>Normal camera</title>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </svg>
              )}
            </button>
            
            <button
              type="button"
              onClick={toggleFlash}
              className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              aria-label={scanState.flashEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
            >
              {scanState.flashEnabled ? <Flashlight size={24} /> : <FlashlightOff size={24} />}
            </button>
            
            <button
              type="button"
              onClick={switchCamera}
              className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              aria-label="Switch camera"
            >
              <RotateCcw size={24} />
            </button>

            {scanState.error && (
              <button
                type="button"
                onClick={retryScanning}
                className="p-3 bg-yellow-500/80 rounded-full hover:bg-yellow-500 transition-colors"
                aria-label="Retry scanning"
              >
                <CameraOff size={24} />
              </button>
            )}
          </div>
        )}

        {/* Manual Entry Mode */}
        {showManualEntry && !showBatchMode && (
          <ManualISBNEntry 
            {...manualISBN}
            onSubmit={(isbn: string) => {
              // Provide feedback for manual entry
              provideScanFeedback();
              
              // Navigate to AddBook page and populate fields
              navigate('/add', { replace: true });
              
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('barcode:scanned', { 
                  detail: { text: isbn, format: 'manual' } 
                }));
                handleClose();
              }, 100);
            }}
          />
        )}

        {/* Batch Mode */}
        {showBatchMode && (
          <BatchScanQueue 
            batchScan={batchScan}
            onAddIsbn={(isbn: string) => {
              // Provide feedback when adding to batch queue
              provideScanFeedback();
              
              batchScan.lookupAndAddToQueue(isbn).then((result) => {
                if (result === 'success') {
                  addToast({ type: 'success', message: 'Book found!' });
                } else if (result === 'error') {
                  addToast({ type: 'error', message: 'Book not found' });
                } else if (result === 'duplicate') {
                  addToast({ type: 'warning', message: 'Already in queue' });
                } else if (result === false) {
                  addToast({ type: 'info', message: 'Already in queue' });
                }
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

// Manual ISBN Entry Component
interface ManualISBNEntryProps {
  isbn: string;
  setIsbn: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isValid: boolean;
  error: string | null;
  handleSubmit: () => Promise<string | null>;
  clearInput: () => void;
  formatISBN: (input: string) => string;
  validateISBN: (input: string) => boolean;
  onSubmit?: (isbn: string) => void;
}

function ManualISBNEntry({ 
  isbn, 
  setIsbn, 
  isValid, 
  error, 
  handleSubmit, 
  clearInput,
  formatISBN: _formatISBN,
  validateISBN: _validateISBN,
  onSubmit: _onSubmit
}: ManualISBNEntryProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={isbn}
          onChange={(e) => setIsbn(e)}
          onKeyDown={handleKeyDown}
          placeholder="Enter ISBN..."
          className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-primary-500"
          aria-label="ISBN input"
        />
        <button
          type="button"
          onClick={clearInput}
          className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          aria-label="Clear input"
        >
          <X size={20} />
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isValid}
        className={clsx(
          'w-full py-3 rounded-lg font-medium transition-colors',
          isValid 
            ? 'bg-primary-500 text-white hover:bg-primary-600' 
            : 'bg-white/20 text-white/50 cursor-not-allowed'
        )}
      >
        Look Up Book
      </button>
    </div>
  );
}

// Batch Scan Queue Component
interface BatchScanQueueProps {
  batchScan: {
    state: {
      queue: Array<{
        id: string;
        isbn: string;
        status: 'pending' | 'success' | 'error' | 'duplicate' | 'created';
        bookData?: Book;
        error?: string;
        scannedAt: Date;
      }>;
      isProcessing: boolean;
      currentProgress: number;
      totalItems: number;
      errors: string[];
    };
    lookupAndAddToQueue: (isbn: string) => Promise<'success' | 'error' | 'duplicate' | false>;
    removeFromQueue: (id: string) => void;
    clearQueue: () => void;
    processQueue: () => Promise<void>;
    createBooks: () => Promise<void>;
    retryItem: (id: string) => void;
  };
  onAddIsbn: (isbn: string) => void;
}

function BatchScanQueue({ 
  batchScan, 
  onAddIsbn 
}: BatchScanQueueProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAddIsbn(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Add Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Scan or enter ISBN..."
          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-primary-500 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-400 text-center">
        Books will be looked up automatically. Use retry button if lookup fails.
      </div>

      {/* Queue List */}
      <div className="max-h-48 overflow-y-auto space-y-2">
        {batchScan.state.queue.map((item: ScanQueueItem) => (
          <div 
            key={item.id}
            className="flex items-center justify-between p-2 bg-white/10 rounded-lg"
          >
            <div className="flex items-center gap-2">
              {/* Status Icon */}
              {item.status === 'success' && (
                <Check size={16} className="text-green-500" />
              )}
              {item.status === 'pending' && (
                <Clock size={16} className="text-yellow-500" />
              )}
              {item.status === 'error' && (
                <AlertCircle size={16} className="text-red-500" />
              )}
              {item.status === 'duplicate' && (
                <BookOpen size={16} className="text-gray-500" />
              )}
              {item.status === 'created' && (
                <Check size={16} className="text-blue-500" />
              )}
              <div className="flex flex-col">
                <span className="text-sm text-white">{item.isbn}</span>
                {/* Show book title if available */}
                {item.bookData?.title && (
                  <span className="text-xs text-gray-400 truncate max-w-[150px]">
                    {item.bookData.title}
                  </span>
                )}
                {/* Show error message if failed */}
                {item.status === 'error' && item.error && (
                  <span className="text-xs text-red-400 truncate max-w-[150px]">
                    {item.error}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Retry button for failed items */}
              {item.status === 'error' && (
                <button
                  type="button"
                  onClick={() => batchScan.retryItem(item.id)}
                  className="p-1 hover:bg-white/20 rounded"
                  title="Retry lookup"
                >
                  <RefreshCw size={14} className="text-yellow-500" />
                </button>
              )}
              <button
                type="button"
                onClick={() => batchScan.removeFromQueue(item.id)}
                className="p-1 hover:bg-white/20 rounded"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Queue Actions */}
      {batchScan.state.queue.length > 0 && (
        <div className="flex gap-2">
          {/* Create All Books Button - shows when there are successfully looked up books */}
          {batchScan.state.queue.some((item: ScanQueueItem) => item.status === 'success' || item.status === 'created') && (
            <button
              type="button"
              onClick={() => batchScan.createBooks()}
              disabled={batchScan.state.isProcessing}
              className={clsx(
                'flex-1 py-2 rounded-lg font-medium transition-colors',
                batchScan.state.isProcessing
                  ? 'bg-white/20 text-white/50 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              )}
            >
              {batchScan.state.isProcessing 
                ? `Creating ${batchScan.state.currentProgress}/${batchScan.state.totalItems}`
                : `Save ${batchScan.state.queue.filter((item: ScanQueueItem) => item.status === 'success').length} books`
              }
            </button>
          )}
          
          {/* Clear Queue Button */}
          <button
            type="button"
            onClick={() => batchScan.clearQueue()}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default BarcodeScannerModal;
