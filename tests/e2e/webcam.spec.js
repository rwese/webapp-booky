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

      // Check if scan barcode button exists (use first() to avoid strict mode violation)
      const scanButton = page.locator('button[aria-label="Scan barcode"]').first();
      await expect(scanButton).toBeVisible();
    });

    test('should open scanner modal when scan button is clicked', async ({ page }) => {
      await page.goto('/');

      // Click scan barcode button (floating action button) - use first() to avoid strict mode violation
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // Check that modal contains scanner elements
      await expect(page.getByRole('heading', { name: 'Scan ISBN Barcode' })).toBeVisible();
    });

    test('should show camera mode by default', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Check that camera mode button is visible - the modal uses regular buttons, not tabs
      const cameraButton = page.getByRole('button', { name: 'Camera' });
      await expect(cameraButton).toBeVisible();

      // Check that camera button has active styling
      await expect(cameraButton).toHaveClass(/bg-primary-500/);
    });

    test('should switch to manual entry mode', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Click manual entry button - the modal uses regular buttons, not tabs
      await page.getByRole('button', { name: 'Manual' }).click();

      // Check that manual entry input is visible
      await expect(page.getByPlaceholder('Enter ISBN...')).toBeVisible();
    });

    test('should switch to batch mode', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Click batch button - the modal uses regular buttons, not tabs
      await page.getByRole('button', { name: 'Batch' }).click();

      // Check that batch input is visible
      await expect(page.getByPlaceholder('Add ISBN to queue...')).toBeVisible();
    });
  });

  test.describe('Manual ISBN Entry', () => {
     
    test('should accept valid ISBN-13', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.getByRole('button', { name: 'Manual' }).click();

      // Enter valid ISBN-13
      await page.getByPlaceholder('Enter ISBN...').fill('978-0-13-468599-1');

      // Look up button should be enabled
      await expect(page.getByRole('button', { name: /Look Up Book/i })).toBeEnabled();
    });

    test('should accept valid ISBN-10', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.getByRole('button', { name: 'Manual' }).click();

      // Enter valid ISBN-10
      await page.getByPlaceholder('Enter ISBN...').fill('0-13-468599-X');

      // Look up button should be enabled
      await expect(page.getByRole('button', { name: /Look Up Book/i })).toBeEnabled();
    });

    test('should reject invalid ISBN format', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.getByRole('button', { name: 'Manual' }).click();

      // Enter invalid ISBN
      await page.getByPlaceholder('Enter ISBN...').fill('invalid-isbn');

      // Look up button should be disabled
      await expect(page.getByRole('button', { name: /Look Up Book/i })).toBeDisabled();

      // Error message should appear
      await expect(page.getByText('Invalid ISBN format')).toBeVisible();
    });

    test('should auto-format ISBN with hyphens', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.getByRole('button', { name: 'Manual' }).click();

      // Enter ISBN without hyphens
      await page.getByPlaceholder('Enter ISBN...').fill('9780134685991');

      // Should auto-format with hyphens
      await expect(page.getByPlaceholder('Enter ISBN...')).toHaveValue('978-0-13-468599-1');
    });
  });

  test.describe('Batch Scanning', () => {

    test('should add ISBN to batch queue', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.getByRole('button', { name: 'Batch' }).click();

      // Add ISBN to queue
      await page.getByPlaceholder('Add ISBN to queue...').fill('978-0-13-468599-1');
      await page.getByRole('button', { name: /Add/i }).click();

      // ISBN should appear in queue
      await expect(page.getByText('9780134685991')).toBeVisible();

      // Batch count should update
      await expect(page.locator('button[aria-label*="Batch"]')).toContainText('1');
    });

    test('should prevent duplicate ISBNs in batch queue', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.getByRole('button', { name: 'Batch' }).click();

      // Add same ISBN twice
      await page.getByPlaceholder('Add ISBN to queue...').fill('978-0-13-468599-1');
      await page.getByRole('button', { name: /Add/i }).click();

      // Try to add duplicate
      await page.getByPlaceholder('Add ISBN to queue...').fill('9780134685991'); // Without hyphen
      await page.getByRole('button', { name: /Add/i }).click();

      // Should only have one entry (deduplication)
      const queueItems = await page.getByText('9780134685991').count();
      expect(queueItems).toBe(1);
    });

    test('should clear batch queue', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.getByRole('button', { name: 'Batch' }).click();

      // Add some ISBNs
      await page.getByPlaceholder('Add ISBN to queue...').fill('978-0-13-468599-1');
      await page.getByRole('button', { name: /Add/i }).click();
      await page.getByPlaceholder('Add ISBN to queue...').fill('978-0-12-345678-9');
      await page.getByRole('button', { name: /Add/i }).click();

      // Clear queue
      await page.getByRole('button', { name: /Clear/i }).click();

      // Queue should be empty
      await expect(page.getByText('9780134685991')).not.toBeVisible();
      await expect(page.getByText('9780123456789')).not.toBeVisible();
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
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Should show error state (may take a moment)
      await page.waitForTimeout(500);

      // Check for error indicators in the scanner
      const errorContent = page.getByText(/permission denied|camera not available/i);
      await expect(errorContent.first()).toBeVisible({ timeout: 5000 });
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
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Should show error state
      await page.waitForTimeout(500);

      const errorContent = page.getByText(/camera not found|device not found/i);
      await expect(errorContent.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Scanner Component', () => {

    test('should render barcode scanner component', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Check that the scanner component is rendered - looking for video element
      await expect(page.locator('video')).toBeVisible({ timeout: 10000 });
    });

    test('should have correct video attributes', async ({ page }) => {
      await page.goto('/');
      await page.locator('button[aria-label="Scan barcode"]').first().click();

      // Wait for video to render
      await page.waitForSelector('video', { state: 'attached', timeout: 10000 });

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
      await page.locator('button[aria-label="Scan barcode"]').first().click();
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
      await page.locator('button[aria-label="Scan barcode"]').first().click();
      await page.waitForTimeout(500);

      expect(exceptions).toHaveLength(0);
    });
  });
});
