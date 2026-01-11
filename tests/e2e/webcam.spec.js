/**
 * Playwright Webcam Functionality Tests
 * 
 * Automated tests for webcam functionality with proper browser mocking.
 * Run with: npm run test:e2e -- tests/e2e/webcam.spec.js
 */

import { test, expect } from '@playwright/test';

test.describe('Webcam Functionality', () => {
  
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

  test.describe('Camera POC Page', () => {
    
    test('should load camera POC page with all required elements', async ({ page }) => {
      await page.goto('/camera-poc');
      
      // Check basic page structure
      await expect(page.locator('h2')).toContainText('Camera POC');
      await expect(page.locator('button:has-text("Start Camera")')).toBeVisible();
      await expect(page.locator('button:has-text("Stop Camera")')).toBeVisible();
    });

    test('video element should have correct attributes', async ({ page }) => {
      await page.goto('/camera-poc');
      
      const video = page.locator('video');
      
      // Check required attributes for webcam functionality
      await expect(video).toHaveAttribute('autoplay');
      await expect(video).toHaveAttribute('playsinline');
      await expect(video).toHaveAttribute('muted');
    });

    test('should handle camera start with mock stream', async ({ page }) => {
      await page.goto('/camera-poc');
      
      // Start camera
      await page.click('button:has-text("Start Camera")');
      
      // Wait for camera to initialize
      await page.waitForTimeout(500);
      
      // Check status changed from initial state
      const statusText = await page.locator('text=Status:').locator('..').textContent();
      expect(statusText).not.toContain('Initializing');
    });

    test('should handle camera stop properly', async ({ page }) => {
      await page.goto('/camera-poc');
      
      // Start then stop camera
      await page.click('button:has-text("Start Camera")');
      await page.waitForTimeout(500);
      
      await page.click('button:has-text("Stop Camera")');
      await page.waitForTimeout(500);
      
      // Verify both buttons are still visible
      await expect(page.locator('button:has-text("Start Camera")')).toBeVisible();
      await expect(page.locator('button:has-text("Stop Camera")')).toBeVisible();
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
      
      await page.goto('/camera-poc');
      await page.click('button:has-text("Start Camera")');
      
      // Wait for error to appear
      await page.waitForTimeout(500);
      
      // Should show error message
      const errorContent = await page.locator('text=Error:').first().isVisible();
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
      
      await page.goto('/camera-poc');
      await page.click('button:has-text("Start Camera")');
      
      // Wait for error to appear
      await page.waitForTimeout(500);
      
      // Should show error message
      const errorContent = await page.locator('text=Error:').first().isVisible();
      expect(errorContent).toBeTruthy();
    });
  });

  test.describe('Page Structure', () => {
    
    test('should display all required UI sections', async ({ page }) => {
      await page.goto('/camera-poc');
      
      // Check for all required sections
      await expect(page.locator('text=Status:')).toBeVisible();
      await expect(page.locator('text=Video State:')).toBeVisible();
      await expect(page.locator('h3:has-text("POC Test Goals")')).toBeVisible();
    });

    test('video container should have correct styling', async ({ page }) => {
      await page.goto('/camera-poc');
      
      // Check container dimensions
      const container = page.locator('video').locator('..');
      await expect(container).toHaveCSS('width', '640px');
      await expect(container).toHaveCSS('height', '480px');
      await expect(container).toHaveCSS('background-color', 'rgb(0, 0, 0)'); // #000
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
      
      await page.goto('/camera-poc');
      await page.waitForTimeout(500);
      
      // Filter out expected media-related errors
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('getUserMedia') &&
        !error.includes('NotAllowedError') &&
        !error.includes('NotFoundError') &&
        !error.includes('Permission denied')
      );
      
      expect(criticalErrors).toHaveLength(0);
    });

    test('should not have uncaught exceptions', async ({ page }) => {
      const exceptions = [];
      
      page.on('pageerror', error => {
        exceptions.push(error);
      });
      
      await page.goto('/camera-poc');
      await page.waitForTimeout(500);
      
      expect(exceptions).toHaveLength(0);
    });
  });
});

test.describe('Barcode Scanner Integration', () => {
  
  test('should have barcode scanner accessible from main app', async ({ page }) => {
    await page.goto('/');
    
    // Check if scan barcode button exists on main page
    const scanButton = page.locator('button:has-text("Scan barcode")');
    await expect(scanButton).toBeVisible();
  });
});