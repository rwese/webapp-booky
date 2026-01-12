import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Flashlight, FlashlightOff, X, RotateCcw, Check, AlertCircle, Clock, BookOpen, Plus } from 'lucide-react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useManualISBNEntry } from '../../hooks/useManualISBNEntry';
import { useBatchScanning } from '../../hooks/useBatchScanning';
import { useBookLookup } from '../../hooks/useBookLookup';
import { useModalStore, useToastStore } from '../../store/useStore';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { BarcodeScannerComponent } from './BarcodeScannerComponent';

// Barcode Scanner Modal Component
export function BarcodeScannerModal() {
  const { closeModal } = useModalStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [lastScan, setLastScan] = useState<any>(null);
  const processedScanRef = useRef<string | null>(null);

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
  const bookLookup = useBookLookup();

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

    // If batch mode is active, add to queue
    if (showBatchMode) {
      if (batchScan.addToQueue(lastScan.text)) {
        addToast({ type: 'success', message: 'Added to batch queue' });
      }
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

  const onScan = useCallback((result: any) => {
    console.log('[BarcodeScannerModal] Scan detected:', result.text, result.format);
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
              if (batchScan.addToQueue(isbn)) {
                addToast({ type: 'success', message: 'Added to queue' });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// Manual ISBN Entry Component
function ManualISBNEntry({ 
  isbn, 
  setIsbn, 
  isValid, 
  error, 
  handleSubmit, 
  clearInput 
}: any) {
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
function BatchScanQueue({ 
  batchScan, 
  onAddIsbn 
}: { 
  batchScan: any; 
  onAddIsbn: (isbn: string) => void;
}) {
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
          placeholder="Add ISBN to queue..."
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

      {/* Queue List */}
      <div className="max-h-48 overflow-y-auto space-y-2">
        {batchScan.state.queue.map((item: any) => (
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
              <span className="text-sm text-white">{item.isbn}</span>
              {/* Show book title if available */}
              {item.bookData?.title && (
                <span className="text-xs text-gray-400 truncate max-w-[120px]">
                  {item.bookData.title}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => batchScan.removeFromQueue(item.id)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        ))}
      </div>

      {/* Queue Actions */}
      {batchScan.state.queue.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => batchScan.processQueue()}
            disabled={batchScan.state.isProcessing}
            className={clsx(
              'flex-1 py-2 rounded-lg font-medium transition-colors',
              batchScan.state.isProcessing
                ? 'bg-white/20 text-white/50 cursor-not-allowed'
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            )}
          >
            {batchScan.state.isProcessing 
              ? `Looking up ${batchScan.state.currentProgress}/${batchScan.state.totalItems}`
              : `Lookup ${batchScan.state.queue.filter((i: any) => i.status === 'pending').length} books`
            }
          </button>
          
          {/* Start Book Creation Button - shows when there are successfully looked up books */}
          {batchScan.state.queue.some((item: any) => item.status === 'success') && (
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
              <Plus size={16} className="inline mr-1" />
              Create {batchScan.state.queue.filter((item: any) => item.status === 'success').length} books
            </button>
          )}
          
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
