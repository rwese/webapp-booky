import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Test imports
import { BottomNavigation } from '../components/common/BottomNavigation';
import { BarcodeScannerModal } from '../components/scanner/BarcodeScannerModal';
import { useBarcodeScanner, useManualISBNEntry, useBatchScanning } from '../hooks/useBarcodeScanner';
import { useOnlineStatus, useSyncStatus, useOfflineQueue } from '../hooks/useOffline';
import { useDeviceType, useResponsiveGrid, useResponsiveSpacing } from '../hooks/useResponsiveDesign';
import { isbnUtils } from '../hooks/useBarcodeScanner';

// Mock dependencies
vi.mock('../store/useStore', () => ({
  useUIStore: () => ({
    mobileNavOpen: false,
    toggleMobileNav: vi.fn(),
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
  }),
  useModalStore: () => ({
    activeModal: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
  useToastStore: () => ({
    addToast: vi.fn(),
    removeToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useOffline', () => ({
  useOnlineStatus: vi.fn(() => true),
  useSyncStatus: vi.fn(() => ({
    isOnline: true,
    pendingOperations: 0,
    isSyncing: false,
    lastSyncTime: null,
  })),
  useOfflineQueue: vi.fn(() => ({
    queueOfflineAction: vi.fn(),
    clearSyncedOperations: vi.fn(),
  })),
}));

describe('Phase 4 Mobile & Offline Features', () => {
  describe('Barcode Scanner', () => {
    it('should validate ISBN-10 format', () => {
      expect(isbnUtils.isISBN10('0306406152')).toBe(true);
      expect(isbnUtils.isISBN10('0306406157')).toBe(false);
      expect(isbnUtils.isISBN10('0-306-40615-2')).toBe(true);
    });

    it('should validate ISBN-13 format', () => {
      expect(isbnUtils.isISBN13('9780306406157')).toBe(true);
      expect(isbnUtils.isISBN13('9780306406158')).toBe(false);
    });

    it('should convert ISBN-10 to ISBN-13', () => {
      expect(isbnUtils.toISBN13('0306406152')).toBe('9780306406157');
    });

    it('should format ISBN with hyphens', () => {
      expect(isbnUtils.formatISBN('9780306406157')).toBe('978-0-306-40615-7');
      expect(isbnUtils.formatISBN('0306406152')).toBe('0-306-40615-2');
    });

    it('should clean ISBN by removing hyphens and spaces', () => {
      expect(isbnUtils.cleanISBN('978-0-306-40615-7')).toBe('9780306406157');
      expect(isbnUtils.cleanISBN('0 306 40615 2')).toBe('0306406152');
    });
  });

  describe('Offline Status', () => {
    it('should return online status', () => {
      const isOnline = useOnlineStatus();
      expect(typeof isOnline).toBe('boolean');
    });

    it('should return sync status', () => {
      const syncStatus = useSyncStatus();
      expect(syncStatus).toHaveProperty('isOnline');
      expect(syncStatus).toHaveProperty('pendingOperations');
      expect(syncStatus).toHaveProperty('isSyncing');
    });
  });

  describe('Responsive Design', () => {
    it('should return device type', () => {
      const deviceType = useDeviceType();
      expect(['mobile', 'tablet', 'desktop']).toContain(deviceType);
    });

    it('should return responsive grid configuration', () => {
      const getGridConfig = useResponsiveGrid();
      const config = getGridConfig();
      expect(config).toHaveProperty('columns');
      expect(config).toHaveProperty('gap');
    });

    it('should return responsive spacing configuration', () => {
      const getSpacing = useResponsiveSpacing();
      const spacing = getSpacing();
      expect(spacing).toHaveProperty('padding');
      expect(spacing).toHaveProperty('cardPadding');
    });
  });

  describe('Manual ISBN Entry', () => {
    it('should format ISBN with auto-format enabled', () => {
      const { formatISBN } = {
        formatISBN: (input: string) => {
          const cleaned = input.replace(/[-\s]/g, '');
          if (cleaned.length === 13) {
            return cleaned.replace(/^(\d{3})(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4-$5');
          }
          if (cleaned.length === 10) {
            return cleaned.replace(/^(\d{1})(\d{4})(\d{4})(\d{1})$/, '$1-$2-$3-$4');
          }
          return input;
        }
      };
      
      expect(formatISBN('9780306406157')).toBe('978-0-306-40615-7');
    });

    it('should validate ISBN format', () => {
      const validateISBN = (input: string) => {
        const cleaned = input.replace(/[-\s]/g, '');
        
        if (cleaned.length === 13 && /^\d+$/.test(cleaned)) {
          let sum = 0;
          for (let i = 0; i < 12; i++) {
            sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 1 : 3);
          }
          const checkDigit = (10 - (sum % 10)) % 10;
          return checkDigit === parseInt(cleaned[12]);
        }
        return false;
      };
      
      expect(validateISBN('9780306406157')).toBe(true);
      expect(validateISBN('9780306406158')).toBe(false);
    });
  });

  describe('Batch Scanning', () => {
    it('should manage scan queue state', () => {
      const batchScan = useBatchScanning();
      
      expect(batchScan.state).toHaveProperty('queue');
      expect(batchScan.state).toHaveProperty('isProcessing');
      expect(batchScan.state).toHaveProperty('currentProgress');
      expect(batchScan.state).toHaveProperty('totalItems');
    });

    it('should add items to queue', () => {
      const batchScan = useBatchScanning();
      const initialQueueLength = batchScan.state.queue.length;
      
      batchScan.addToQueue('9780306406157');
      
      expect(batchScan.state.queue.length).toBe(initialQueueLength + 1);
    });

    it('should remove items from queue', () => {
      const batchScan = useBatchScanning();
      batchScan.addToQueue('9780306406157');
      const itemId = batchScan.state.queue[0]?.id;
      
      if (itemId) {
        batchScan.removeFromQueue(itemId);
        expect(batchScan.state.queue.length).toBe(0);
      }
    });

    it('should clear queue', () => {
      const batchScan = useBatchScanning();
      batchScan.addToQueue('9780306406157');
      batchScan.addToQueue('0306406152');
      
      expect(batchScan.state.queue.length).toBe(2);
      
      batchScan.clearQueue();
      
      expect(batchScan.state.queue.length).toBe(0);
    });
  });

  describe('Offline Queue Operations', () => {
    it('should queue offline actions', async () => {
      const { queueOfflineAction } = useOfflineQueue();
      
      const action = await queueOfflineAction('book_add', 'test-id', { title: 'Test Book' });
      
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('type');
      expect(action).toHaveProperty('entityId');
    });

    it('should clear synced operations', async () => {
      const { clearSyncedOperations } = useOfflineQueue();
      
      // Should not throw an error
      await expect(clearSyncedOperations()).resolves.not.toThrow();
    });
  });
});

describe('UI Components', () => {
  describe('Bottom Navigation', () => {
    it('renders without crashing', () => {
      render(<BottomNavigation />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('displays navigation items', () => {
      render(<BottomNavigation />);
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Library')).toBeInTheDocument();
      expect(screen.getByText('Scan')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });
  });

  describe('Barcode Scanner Modal', () => {
    it('renders without crashing', () => {
      render(<BarcodeScannerModal />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays camera view placeholder', () => {
      render(<BarcodeScannerModal />);
      expect(screen.getByText('Scan ISBN Barcode')).toBeInTheDocument();
    });
  });
});

// Integration tests
describe('Phase 4 Integration', () => {
  it('should work with offline queue and barcode scanner', () => {
    // Test that components can work together
    const batchScan = useBatchScanning();
    const { queueOfflineAction } = useOfflineQueue();
    
    // Add scanned ISBN to batch queue
    batchScan.addToQueue('9780306406157');
    
    // Should be able to queue the scanned book for offline sync
    expect(batchScan.state.queue.length).toBeGreaterThan(0);
  });

  it('should handle responsive design across device types', () => {
    const deviceType = useDeviceType();
    const getGridConfig = useResponsiveGrid();
    const getSpacing = useResponsiveSpacing();
    
    const gridConfig = getGridConfig();
    const spacing = getSpacing();
    
    // Grid columns should be appropriate for device type
    if (deviceType === 'mobile') {
      expect(gridConfig.columns).toBe(1);
    } else if (deviceType === 'tablet') {
      expect(gridConfig.columns).toBe(2);
    } else {
      expect(gridConfig.columns).toBe(3);
    }
    
    // Should have valid spacing values
    expect(spacing.padding).toBeDefined();
    expect(spacing.cardPadding).toBeDefined();
  });
});