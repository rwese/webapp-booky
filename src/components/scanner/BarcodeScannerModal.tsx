import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Flashlight, FlashlightOff, X, RotateCcw } from 'lucide-react';
import { useBarcodeScanner, useManualISBNEntry, useBatchScanning } from '../../hooks/useBarcodeScanner';
import { useModalStore, useToastStore } from '../../store/useStore';
import { clsx } from 'clsx';

// Barcode Scanner Modal Component
export function BarcodeScannerModal() {
  const { closeModal } = useModalStore();
  const { addToast } = useToastStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showBatchMode, setShowBatchMode] = useState(false);

  const { 
    state: scanState, 
    startScanning, 
    stopScanning, 
    toggleFlash,
    switchCamera 
  } = useBarcodeScanner();

  const manualISBN = useManualISBNEntry();
  const batchScan = useBatchScanning();

  // Handle successful scan
  useEffect(() => {
    if (scanState.lastScan) {
      addToast({
        type: 'success',
        message: `Scanned: ${scanState.lastScan.text}`,
        duration: 2000
      });

      // Emit event for book lookup
      window.dispatchEvent(new CustomEvent('book:lookup', { 
        detail: { isbn: scanState.lastScan.text } 
      }));

      // Close modal after successful scan (optional)
      // closeModal();
    }
  }, [scanState.lastScan, addToast]);

  // Start scanning when modal opens
  useEffect(() => {
    if (videoRef.current && !showManualEntry) {
      startScanning(videoRef.current);
    }

    return () => {
      stopScanning();
    };
  }, [showManualEntry, startScanning, stopScanning]);

  const handleClose = useCallback(() => {
    stopScanning();
    closeModal();
  }, [stopScanning, closeModal]);

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
          onClick={handleClose}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          aria-label="Close scanner"
        >
          <X size={24} />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Scanning Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-72 h-40 border-2 border-white/50 rounded-lg relative">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />
            
            {/* Scan line animation */}
            <div className="absolute inset-x-0 h-0.5 bg-primary-500 animate-scan-line" />
          </div>
        </div>

        {/* Error Display */}
        {scanState.error && (
          <div className="absolute bottom-20 left-4 right-4 bg-red-500/80 text-white p-3 rounded-lg">
            <p className="text-sm">{scanState.error}</p>
          </div>
        )}

        {/* Last Scan Result */}
        {scanState.lastScan && (
          <div className="absolute bottom-20 left-4 right-4 bg-green-500/80 text-white p-3 rounded-lg">
            <p className="text-sm font-medium">Last scan: {scanState.lastScan.text}</p>
            <p className="text-xs opacity-80">Format: {scanState.lastScan.format}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-black/50 text-white space-y-4">
        {/* Mode Tabs */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setShowManualEntry(false)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              !showManualEntry ? 'bg-primary-500 text-white' : 'bg-white/20'
            )}
          >
            Camera
          </button>
          <button
            onClick={() => setShowManualEntry(true)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              showManualEntry ? 'bg-primary-500 text-white' : 'bg-white/20'
            )}
          >
            Manual
          </button>
          <button
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
              onClick={toggleFlash}
              className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              aria-label={scanState.flashEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
            >
              {scanState.flashEnabled ? <Flashlight size={24} /> : <FlashlightOff size={24} />}
            </button>
            
            <button
              onClick={switchCamera}
              className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              aria-label="Switch camera"
            >
              <RotateCcw size={24} />
            </button>
          </div>
        )}

        {/* Manual Entry Mode */}
        {showManualEntry && !showBatchMode && (
          <ManualISBNEntry 
            {...manualISBN}
            onSubmit={(isbn) => {
              window.dispatchEvent(new CustomEvent('book:lookup', { detail: { isbn } }));
            }}
          />
        )}

        {/* Batch Mode */}
        {showBatchMode && (
          <BatchScanQueue 
            batchScan={batchScan}
            onAddIsbn={(isbn) => {
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
          onClick={clearInput}
          className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          aria-label="Clear input"
        >
          <X size={20} />
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
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
              <span className={clsx(
                'w-2 h-2 rounded-full',
                item.status === 'success' && 'bg-green-500',
                item.status === 'pending' && 'bg-yellow-500',
                item.status === 'error' && 'bg-red-500',
                item.status === 'duplicate' && 'bg-gray-500'
              )} />
              <span className="text-sm text-white">{item.isbn}</span>
            </div>
            <button
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
            onClick={() => batchScan.processQueue()}
            disabled={batchScan.state.isProcessing}
            className={clsx(
              'flex-1 py-2 rounded-lg font-medium transition-colors',
              batchScan.state.isProcessing
                ? 'bg-white/20 text-white/50 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            )}
          >
            {batchScan.state.isProcessing 
              ? `Processing ${batchScan.state.currentProgress}/${batchScan.state.totalItems}`
              : `Process ${batchScan.state.queue.length} books`
            }
          </button>
          <button
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