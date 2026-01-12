/**
 * Playwright Tests for Barcode Scanner using react-qr-barcode-scanner
 * 
 * Automated tests for the new barcode scanner functionality.
 * Run with: npm run test:e2e -- tests/e2e/webcam.spec.js
 */

import { test, expect } from '@playwright/test';

test.describe('Barcode Scanner with react-qr-barcode-scanner', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock navigator.mediaDevices.getUserMedia for testing without real camera
    await page.evaluate(() => {
      // Create mock MediaStreamTrack
      class MockMediaStreamTrack {
        kind = 'video';
        enabled = true;
        readyState = 'live';
        
        stop() {
          this.readyState = 'ended';
        }
        
        getSettings() {
          return {
            width: 1280,
            height: 720,
            facingMode: 'environment',
            frameRate: 30
          };
        }
      }
      
      // Create mock MediaStream
      class MockMediaStream {
        tracks = [];
        active = true;
        id = 'mock-stream-' + Date.now();
        
        constructor() {
          this.tracks = [new MockMediaStreamTrack()];
        }
        
        getTracks() {
          return this.tracks;
        }
        
        getVideoTracks() {
          return this.tracks.filter(t => t.kind === 'video');
        }
      }
      
      // Mock getUserMedia
      const mockGetUserMedia = async (_constraints) => {
        // Simulate async camera access
        await new Promise(resolve => setTimeout(resolve, 100));
        return new MockMediaStream();
      };
      
      // Inject mock
      if (navigator.mediaDevices) {
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          value: mockGetUserMedia,
          writable: true,
          configurable: true
        });
      }
    });
  });

  test.describe('Barcode Scanner Modal', () => {
    
    test('should have barcode scanner accessible from main app', async ({ page }) => {
      await page.goto('/');
      
      // Check if scan barcode button exists on main page
      const scanButton = page.locator('button:has-text("Scan barcode")');
      await expect(scanButton).toBeVisible();
    });

    test('should open scanner modal when scan button is clicked', async ({ page }) => {
      await page.goto('/');
      
      // Click scan barcode button
      await page.click('button:has-text("Scan barcode")');
      
      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });
      
      // Check that modal contains scanner elements
      await expect(page.locator('text=Scan ISBN Barcode')).toBeVisible();
    });

    test('should show camera mode by default', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      
      // Check that camera mode is active
      await expect(page.locator('button:has-text("Camera")')).toHaveClass(/bg-primary-500/);
    });

    test('should switch to manual entry mode', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      
      // Click manual entry tab
      await page.click('button:has-text("Manual")');
      
      // Check that manual entry input is visible
      await expect(page.locator('input[placeholder="Enter ISBN..."]')).toBeVisible();
    });

    test('should switch to batch mode', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      
      // Click batch tab
      await page.click('button:has-text("Batch")');
      
      // Check that batch input is visible
      await expect(page.locator('input[placeholder="Add ISBN to queue..."]')).toBeVisible();
    });
  });

  test.describe('Manual ISBN Entry', () => {
    
    test('should accept valid ISBN-13', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.click('button:has-text("Manual")');
      
      // Enter valid ISBN-13
      await page.fill('input[placeholder="Enter ISBN..."]', '978-0-13-468599-1');
      
      // Look up button should be enabled
      await expect(page.locator('button:has-text("Look Up Book")')).toBeEnabled();
    });

    test('should accept valid ISBN-10', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.click('button:has-text("Manual")');
      
      // Enter valid ISBN-10
      await page.fill('input[placeholder="Enter ISBN..."]', '0-13-468599-X');
      
      // Look up button should be enabled
      await expect(page.locator('button:has-text("Look Up Book")')).toBeEnabled();
    });

    test('should reject invalid ISBN format', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.click('button:has-text("Manual")');
      
      // Enter invalid ISBN
      await page.fill('input[placeholder="Enter ISBN..."]', 'invalid-isbn');
      
      // Look up button should be disabled
      await expect(page.locator('button:has-text("Look Up Book")')).toBeDisabled();
      
      // Error message should appear
      await expect(page.locator('text=Invalid ISBN format')).toBeVisible();
    });

    test('should auto-format ISBN with hyphens', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.click('button:has-text("Manual")');
      
      // Enter ISBN without hyphens
      await page.fill('input[placeholder="Enter ISBN..."]', '9780134685991');
      
      // Should auto-format with hyphens
      await expect(page.locator('input[placeholder="Enter ISBN..."]')).toHaveValue('978-0-13-468599-1');
    });
  });

  test.describe('Batch Scanning', () => {
    
    test('should add ISBN to batch queue', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.click('button:has-text("Batch")');
      
      // Add ISBN to queue
      await page.fill('input[placeholder="Add ISBN to queue..."]', '978-0-13-468599-1');
      await page.click('button:has-text("Add")');
      
      // ISBN should appear in queue
      await expect(page.locator('text=9780134685991')).toBeVisible();
      
      // Batch count should update
      await expect(page.locator('button:has-text("Batch (1)")')).toBeVisible();
    });

    test('should prevent duplicate ISBNs in batch queue', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.click('button:has-text("Batch")');
      
      // Add same ISBN twice
      await page.fill('input[placeholder="Add ISBN to queue..."]', '978-0-13-468599-1');
      await page.click('button:has-text("Add")');
      
      // Try to add duplicate
      await page.fill('input[placeholder="Add ISBN to queue..."]', '9780134685991'); // Without hyphen
      await page.click('button:has-text("Add")');
      
      // Should only have one entry (deduplication)
      const queueItems = await page.locator('.bg-white\\/10:has-text("9780134685991")').count();
      expect(queueItems).toBe(1);
    });

    test('should clear batch queue', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.click('button:has-text("Batch")');
      
      // Add some ISBNs
      await page.fill('input[placeholder="Add ISBN to queue..."]', '978-0-13-468599-1');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder="Add ISBN to queue..."]', '978-0-12-345678-9');
      await page.click('button:has-text("Add")');
      
      // Clear queue
      await page.click('button:has-text("Clear")');
      
      // Queue should be empty
      await expect(page.locator('text=9780134685991')).not.toBeVisible();
      await expect(page.locator('text=9780123456789')).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    
    test('should handle permission denied errors gracefully', async ({ page }) => {
      // Mock permission denied
      await page.evaluate(() => {
        if (navigator.mediaDevices) {
          const error = new Error('Permission denied');
          error.name = 'NotAllowedError';
          Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
            value: async () => { throw error; },
            writable: true,
            configurable: true
          });
        }
      });
      
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      
      // Should show error state (may take a moment)
      await page.waitForTimeout(500);
      
      // Check for error indicators in the scanner
      const errorContent = await page.locator('.camera-status.status-error').isVisible();
      expect(errorContent).toBeTruthy();
    });

    test('should handle camera not found errors', async ({ page }) => {
      // Mock camera not found
      await page.evaluate(() => {
        if (navigator.mediaDevices) {
          const error = new Error('Requested device not found');
          error.name = 'NotFoundError';
          Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
            value: async () => { throw error; },
            writable: true,
            configurable: true
          });
        }
      });
      
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      
      // Should show error state
      await page.waitForTimeout(500);
      
      const errorContent = await page.locator('.camera-status.status-error').isVisible();
      expect(errorContent).toBeTruthy();
    });
  });

  test.describe('Scanner Component', () => {
    
    test('should render barcode scanner component', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      
      // Check that the scanner component is rendered
      await expect(page.locator('.react-qr-barcode-scanner')).toBeVisible();
    });

    test('should have correct video attributes', async ({ page }) => {
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      
      // Wait for video to render
      await page.waitForSelector('video', { state: 'attached' });
      
      const video = page.locator('video');
      
      // Check required attributes for webcam functionality
      await expect(video).toHaveAttribute('playsinline');
      await expect(video).toHaveAttribute('muted');
    });
  });

  test.describe('Console Error Validation', () => {
    
    test('should not have critical console errors', async ({ page }) => {
      const consoleErrors = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.waitForTimeout(500);
      
      // Filter out expected media-related errors
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('getUserMedia') &&
        !error.includes('NotAllowedError') &&
        !error.includes('NotFoundError') &&
        !error.includes('Permission denied') &&
        !error.includes('No barcode')
      );
      
      expect(criticalErrors).toHaveLength(0);
    });

    test('should not have uncaught exceptions', async ({ page }) => {
      const exceptions = [];
      
      page.on('pageerror', error => {
        exceptions.push(error);
      });
      
      await page.goto('/');
      await page.click('button:has-text("Scan barcode")');
      await page.waitForTimeout(500);
      
      expect(exceptions).toHaveLength(0);
    });
  });
});
