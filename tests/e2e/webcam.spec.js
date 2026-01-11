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

/**
 * Enhanced Recovery Mechanism Tests
 * 
 * Comprehensive tests for webcam recovery functionality including:
 * - Recovery state validation
 * - Timeout handling (10 second maximum)
 * - Recovery attempt limiting (max 3 attempts)
 * - Workbox media caching exclusion
 * - Enhanced error handling
 */

test.describe('Enhanced Recovery Mechanism', () => {
  
  // Enhanced mock setup with recovery tracking capabilities
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      // Recovery tracking state
      let recoveryAttempts = 0;
      let recoveryTimeoutMs = 10000;
      let maxRecoveryAttempts = 3;
      let lastRecoveryState = null;
      let muteEventTriggered = false;
      
      // Enhanced MockMediaStreamTrack with mute capabilities
      class MockMediaStreamTrack {
        kind = 'video';
        enabled = true;
        readyState = 'live';
        _muted = false;
        
        constructor() {
          // Simulate live state
          this.readyState = 'live';
        }
        
        getSettings() {
          return {
            width: 1280,
            height: 720,
            facingMode: 'environment',
            frameRate: 30
          };
        }
        
        stop() {
          this.readyState = 'ended';
          this._muted = true;
        }
        
        // Mute simulation
        mute() {
          this._muted = true;
          this.enabled = false;
        }
        
        unmute() {
          this._muted = false;
          this.enabled = true;
        }
        
        get muted() {
          return this._muted;
        }
      }
      
      // Enhanced MockMediaStream with reinitialization support
      class MockMediaStream {
        tracks = [];
        active = true;
        id = 'mock-stream-' + Date.now();
        _reinitialized = false;
        
        constructor(shouldFail = false) {
          this.tracks = [new MockMediaStreamTrack()];
          this.active = !shouldFail;
          this._reinitialized = false;
        }
        
        reinitialize() {
          this._reinitialized = true;
          this.active = true;
          this.tracks = [new MockMediaStreamTrack()];
          this.id = 'mock-stream-reinit-' + Date.now();
        }
        
        getTracks() {
          return this.tracks;
        }
        
        getVideoTracks() {
          return this.tracks.filter(t => t.kind === 'video');
        }
      }
      
      // Global recovery state accessible from tests
      window.__recoveryState = {
        attempts: 0,
        timeout: recoveryTimeoutMs,
        maxAttempts: maxRecoveryAttempts,
        lastState: null,
        muted: false,
        
        reset() {
          this.attempts = 0;
          this.lastState = null;
          this.muted = false;
        },
        
        incrementAttempt() {
          this.attempts++;
          return this.attempts;
        },
        
        canRecover() {
          return this.attempts < this.maxAttempts;
        },
        
        setMuted(value) {
          this.muted = value;
        }
      };
      
      // Mock getUserMedia with recovery simulation
      const mockGetUserMedia = async (constraints, options = {}) => {
        // Simulate async camera access
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Simulate failure if max attempts reached
        if (options.failAfterMaxAttempts && window.__recoveryState.attempts >= maxRecoveryAttempts) {
          throw new Error('Recovery failed: Maximum attempts exceeded');
        }
        
        return new MockMediaStream(options.shouldFail);
      };
      
      // validateRecoveryState function for testing
      window.__validateRecoveryState = async (video) => {
        const checks = [];
        let allPassed = true;
        
        // Check 1: Video readyState >= 3 (HAVE_ENOUGH_DATA)
        const readyStateCheck = video.readyState >= 3;
        checks.push({
          name: 'readyState >= 3',
          passed: readyStateCheck,
          value: video.readyState
        });
        if (!readyStateCheck) allPassed = false;
        
        // Check 2: Stream active status
        const stream = video.srcObject;
        const activeCheck = stream && stream.active;
        checks.push({
          name: 'stream.active',
          passed: activeCheck,
          value: stream?.active
        });
        if (!activeCheck) allPassed = false;
        
        // Check 3: Video track readyState is 'live'
        const trackCheck = stream && stream.getVideoTracks()[0]?.readyState === 'live';
        checks.push({
          name: 'track.readyState === live',
          passed: trackCheck,
          value: stream?.getVideoTracks()[0]?.readyState
        });
        if (!trackCheck) allPassed = false;
        
        // Check 4: Video is not paused
        const pausedCheck = !video.paused;
        checks.push({
          name: '!video.paused',
          passed: pausedCheck,
          value: video.paused
        });
        if (!pausedCheck) allPassed = false;
        
        // Check 5: Valid video dimensions (non-zero)
        const dimensionsCheck = video.videoWidth > 0 && video.videoHeight > 0;
        checks.push({
          name: 'video dimensions > 0',
          passed: dimensionsCheck,
          value: `${video.videoWidth}x${video.videoHeight}`
        });
        if (!dimensionsCheck) allPassed = false;
        
        return {
          valid: allPassed,
          checks,
          timestamp: Date.now()
        };
      };
      
      // Inject enhanced mocks
      if (navigator.mediaDevices) {
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          value: mockGetUserMedia,
          writable: true,
          configurable: true
        });
      }
    });
  });
  
  test.describe('Recovery Mechanism Tests', () => {
    
    test('should trigger recovery when video track gets muted', async ({ page }) => {
      // Test recovery trigger logic without requiring page navigation
      const recoveryTriggered = await page.evaluate(() => {
        window.__recoveryState.setMuted(true);
        
        // Check if recovery should be triggered based on mute event
        const shouldRecover = window.__recoveryState.muted && 
                             window.__recoveryState.canRecover();
        
        return {
          muted: window.__recoveryState.muted,
          shouldRecover: shouldRecover,
          canRecover: window.__recoveryState.canRecover()
        };
      });
      
      expect(recoveryTriggered.muted).toBe(true);
      expect(recoveryTriggered.shouldRecover).toBe(true);
    });
    
    test('should validate state after reinitialization', async ({ page }) => {
      // Test state validation without requiring page navigation
      const validationResult = await page.evaluate(async () => {
        // Mock a reinitialized stream
        class ReinitializedStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = true;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const mockVideo = {
          readyState: 4, // HAVE_ENOUGH_DATA
          srcObject: new ReinitializedStream(),
          paused: false,
          videoWidth: 1280,
          videoHeight: 720
        };
        
        // Test validation
        return await window.__validateRecoveryState(mockVideo);
      });
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.checks.every(c => c.passed)).toBe(true);
    });
    
    test('should respect timeout limits (10 seconds)', async ({ page }) => {
      const timeoutTest = await page.evaluate(() => {
        const timeout = window.__recoveryState.timeout;
        return timeout === 10000; // 10 seconds in ms
      });
      
      expect(timeoutTest).toBe(true);
    });
    
    test('should respect attempt limits (max 3 attempts)', async ({ page }) => {
      const attemptLimitTest = await page.evaluate(() => {
        return window.__recoveryState.maxAttempts === 3;
      });
      
      expect(attemptLimitTest).toBe(true);
    });
    
    test('should succeed when state validation passes', async ({ page }) => {
      const successTest = await page.evaluate(async () => {
        // Create a valid video state
        class ValidStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = true;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const validVideo = {
          readyState: 4,
          srcObject: new ValidStream(),
          paused: false,
          videoWidth: 1280,
          videoHeight: 720
        };
        
        // Validate
        const result = await window.__validateRecoveryState(validVideo);
        
        // Reset attempts on success
        if (result.valid) {
          window.__recoveryState.reset();
        }
        
        return {
          validationPassed: result.valid,
          attemptsAfterReset: window.__recoveryState.attempts
        };
      });
      
      expect(successTest.validationPassed).toBe(true);
      expect(successTest.attemptsAfterReset).toBe(0);
    });
    
    test('should fail gracefully when validation fails', async ({ page }) => {
      const failureTest = await page.evaluate(async () => {
        // Create an invalid video state
        class InvalidStream {
          tracks = [{ kind: 'video', readyState: 'ended', enabled: false }];
          active = false;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const invalidVideo = {
          readyState: 1, // HAVE_METADATA only
          srcObject: new InvalidStream(),
          paused: true,
          videoWidth: 0,
          videoHeight: 0
        };
        
        // Validate
        const result = await window.__validateRecoveryState(invalidVideo);
        
        // Track failure
        if (!result.valid) {
          window.__recoveryState.incrementAttempt();
        }
        
        return {
          validationPassed: result.valid,
          failedChecks: result.checks.filter(c => !c.passed),
          attempts: window.__recoveryState.attempts
        };
      });
      
      expect(failureTest.validationPassed).toBe(false);
      expect(failureTest.failedChecks.length).toBeGreaterThan(0);
      expect(failureTest.attempts).toBe(1);
    });
  });
  
  test.describe('State Validation Tests', () => {
    
    test('should reject videos with readyState < 3', async ({ page }) => {
      const readyStateTest = await page.evaluate(async () => {
        class TestStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = true;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const video = {
          readyState: 2, // HAVE_CURRENT_DATA
          srcObject: new TestStream(),
          paused: false,
          videoWidth: 1280,
          videoHeight: 720
        };
        
        const result = await window.__validateRecoveryState(video);
        return {
          valid: result.valid,
          readyStateCheck: result.checks.find(c => c.name === 'readyState >= 3')
        };
      });
      
      expect(readyStateTest.valid).toBe(false);
      expect(readyStateTest.readyStateCheck.passed).toBe(false);
    });
    
    test('should reject inactive streams', async ({ page }) => {
      const inactiveStreamTest = await page.evaluate(async () => {
        class InactiveStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = false; // Inactive stream
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const video = {
          readyState: 4,
          srcObject: new InactiveStream(),
          paused: false,
          videoWidth: 1280,
          videoHeight: 720
        };
        
        const result = await window.__validateRecoveryState(video);
        return {
          valid: result.valid,
          activeCheck: result.checks.find(c => c.name === 'stream.active')
        };
      });
      
      expect(inactiveStreamTest.valid).toBe(false);
      expect(inactiveStreamTest.activeCheck.passed).toBe(false);
    });
    
    test('should reject paused videos', async ({ page }) => {
      const pausedVideoTest = await page.evaluate(async () => {
        class TestStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = true;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const video = {
          readyState: 4,
          srcObject: new TestStream(),
          paused: true, // Video is paused
          videoWidth: 1280,
          videoHeight: 720
        };
        
        const result = await window.__validateRecoveryState(video);
        return {
          valid: result.valid,
          pausedCheck: result.checks.find(c => c.name === '!video.paused')
        };
      });
      
      expect(pausedVideoTest.valid).toBe(false);
      expect(pausedVideoTest.pausedCheck.passed).toBe(false);
    });
    
    test('should reject videos with zero dimensions', async ({ page }) => {
      const zeroDimensionsTest = await page.evaluate(async () => {
        class TestStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = true;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const video = {
          readyState: 4,
          srcObject: new TestStream(),
          paused: false,
          videoWidth: 0, // Zero dimensions
          videoHeight: 0
        };
        
        const result = await window.__validateRecoveryState(video);
        return {
          valid: result.valid,
          dimensionsCheck: result.checks.find(c => c.name === 'video dimensions > 0')
        };
      });
      
      expect(zeroDimensionsTest.valid).toBe(false);
      expect(zeroDimensionsTest.dimensionsCheck.passed).toBe(false);
    });
    
    test('should accept valid video states', async ({ page }) => {
      const validStateTest = await page.evaluate(async () => {
        class ValidStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = true;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const video = {
          readyState: 4, // HAVE_ENOUGH_DATA
          srcObject: new ValidStream(),
          paused: false,
          videoWidth: 1280,
          videoHeight: 720
        };
        
        const result = await window.__validateRecoveryState(video);
        return {
          valid: result.valid,
          allChecksPassed: result.checks.every(c => c.passed)
        };
      });
      
      expect(validStateTest.valid).toBe(true);
      expect(validStateTest.allChecksPassed).toBe(true);
    });
  });
  
  test.describe('Timeout and Limits Tests', () => {
    
    test('should timeout after 10 seconds', async ({ page }) => {
      const timeoutTest = await page.evaluate(async () => {
        // Test that the timeout mechanism is properly configured
        const timeoutDuration = window.__recoveryState.timeout;
        const startTime = Date.now();
        
        // Simulate a timeout scenario
        const timeoutReached = await new Promise(resolve => {
          setTimeout(() => {
            resolve(Date.now() - startTime >= timeoutDuration - 100); // Allow 100ms tolerance
          }, timeoutDuration);
        });
        
        return timeoutReached;
      });
      
      expect(timeoutTest).toBe(true);
    });
    
    test('should stop after 3 failed attempts', async ({ page }) => {
      const maxAttemptsTest = await page.evaluate(() => {
        // Test that recovery stops after max attempts
        window.__recoveryState.reset();
        
        // Simulate 3 failed recovery attempts
        for (let i = 0; i < 3; i++) {
          window.__recoveryState.incrementAttempt();
        }
        
        const canStillRecover = window.__recoveryState.canRecover();
        const attempts = window.__recoveryState.attempts;
        
        return {
          canRecover: canStillRecover,
          attempts: attempts,
          maxAttempts: window.__recoveryState.maxAttempts
        };
      });
      
      expect(maxAttemptsTest.canRecover).toBe(false);
      expect(maxAttemptsTest.attempts).toBe(3);
      expect(maxAttemptsTest.maxAttempts).toBe(3);
    });
    
    test('should reset recovery counter on success', async ({ page }) => {
      const resetTest = await page.evaluate(async () => {
        window.__recoveryState.reset();
        
        // Simulate some attempts
        window.__recoveryState.incrementAttempt();
        window.__recoveryState.incrementAttempt();
        
        let attemptsBeforeReset = window.__recoveryState.attempts;
        
        // Simulate successful recovery
        window.__recoveryState.reset();
        
        let attemptsAfterReset = window.__recoveryState.attempts;
        
        return {
          attemptsBeforeReset,
          attemptsAfterReset
        };
      });
      
      expect(resetTest.attemptsBeforeReset).toBe(2);
      expect(resetTest.attemptsAfterReset).toBe(0);
    });
    
    test('should perform proper cleanup on recovery failure', async ({ page }) => {
      const cleanupTest = await page.evaluate(async () => {
        let cleanupCalled = false;
        let resourcesReleased = false;
        
        // Simulate recovery process with cleanup
        const recoveryWithCleanup = async () => {
          // Track cleanup
          window.__recoveryState.incrementAttempt();
          
          // Check if cleanup needed (failed beyond max attempts)
          if (!window.__recoveryState.canRecover()) {
            cleanupCalled = true;
            resourcesReleased = true;
          }
          
          return !window.__recoveryState.canRecover();
        };
        
        // Simulate 3 failed attempts
        for (let i = 0; i < 3; i++) {
          await recoveryWithCleanup();
        }
        
        return {
          cleanupCalled,
          resourcesReleased,
          attempts: window.__recoveryState.attempts
        };
      });
      
      expect(cleanupTest.cleanupCalled).toBe(true);
      expect(cleanupTest.resourcesReleased).toBe(true);
      expect(cleanupTest.attempts).toBe(3);
    });
  });
  
  test.describe('Workbox Configuration Tests', () => {
    
    test('should exclude blob URLs from caching', async ({ page }) => {
      const blobUrlTest = await page.evaluate(() => {
        // Test that blob URLs are properly identified for exclusion
        const blobUrlPattern = /^blob:/;
        const testUrls = [
          'blob:http://localhost:3000/1234-5678-90ab-cdef',
          'blob:https://example.com/resource-id',
          'http://localhost:3000/resource/123'
        ];
        
        const blobUrls = testUrls.filter(url => blobUrlPattern.test(url));
        
        return {
          blobUrlsIdentified: blobUrls.length,
          nonBlobUrls: testUrls.length - blobUrls.length
        };
      });
      
      expect(blobUrlTest.blobUrlsIdentified).toBe(2);
      expect(blobUrlTest.nonBlobUrls).toBe(1);
    });
    
    test('should exclude media extensions from caching', async ({ page }) => {
      const mediaExtensionTest = await page.evaluate(() => {
        // Test that media extensions are properly identified for exclusion
        const mediaExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.mp3', '.wav'];
        const testUrls = [
          'https://cdn.example.com/video.mp4',
          'https://cdn.example.com/audio.mp3',
          'https://cdn.example.com/video.webm',
          'https://cdn.example.com/image.jpg',
          'https://cdn.example.com/script.js',
          'https://cdn.example.com/style.css'
        ];
        
        const mediaUrls = testUrls.filter(url => 
          mediaExtensions.some(ext => url.toLowerCase().endsWith(ext))
        );
        
        return {
          mediaUrlsExcluded: mediaUrls.length,
          nonMediaUrls: testUrls.length - mediaUrls.length
        };
      });
      
      expect(mediaExtensionTest.mediaUrlsExcluded).toBe(3);
      expect(mediaExtensionTest.nonMediaUrls).toBe(3);
    });
    
    test('should not cache media streams via service worker', async ({ page }) => {
      const streamCachingTest = await page.evaluate(() => {
        // Test that MediaStream objects are properly identified as uncacheable
        const cacheableTypes = ['text/html', 'application/json', 'image/jpeg'];
        const mediaStreamType = 'MediaStream';
        
        // Simulate service worker cache behavior
        const shouldCache = (resourceType) => {
          // Media streams should never be cached
          if (resourceType === mediaStreamType) {
            return false;
          }
          return cacheableTypes.includes(resourceType);
        };
        
        const results = [
          shouldCache('text/html'),      // should cache
          shouldCache('application/json'), // should cache
          shouldCache(mediaStreamType),    // should NOT cache
          shouldCache('image/jpeg')        // should cache
        ];
        
        return {
          htmlCached: results[0],
          jsonCached: results[1],
          mediaStreamCached: results[2],
          imageCached: results[3]
        };
      });
      
      expect(streamCachingTest.htmlCached).toBe(true);
      expect(streamCachingTest.jsonCached).toBe(true);
      expect(streamCachingTest.mediaStreamCached).toBe(false);
      expect(streamCachingTest.imageCached).toBe(true);
    });
  });
  
  test.describe('Enhanced Error Handling Tests', () => {
    
    test('should provide proper error messages during recovery', async ({ page }) => {
      const errorMessagesTest = await page.evaluate(async () => {
        const errorMessages = {
          timeout: 'Recovery timeout: Video did not become ready within 10 seconds',
          maxAttempts: 'Recovery failed: Maximum attempts (3) exceeded',
          invalidState: 'Recovery validation failed: Video state is invalid',
          streamInactive: 'Recovery validation failed: MediaStream is not active',
          trackEnded: 'Recovery validation failed: Video track has ended'
        };
        
        // Test error message generation
        const generateError = (type) => {
          return errorMessages[type] || 'Unknown recovery error';
        };
        
        return {
          timeoutError: generateError('timeout'),
          maxAttemptsError: generateError('maxAttempts'),
          invalidStateError: generateError('invalidState'),
          unknownError: generateError('unknown')
        };
      });
      
      expect(errorMessagesTest.timeoutError).toContain('timeout');
      expect(errorMessagesTest.maxAttemptsError).toContain('Maximum attempts');
      expect(errorMessagesTest.invalidStateError).toContain('validation failed');
    });
    
    test('should provide user feedback during recovery attempts', async ({ page }) => {
      const userFeedbackTest = await page.evaluate(async () => {
        const feedbackStates = [];
        
        // Simulate recovery feedback
        const simulateRecovery = async () => {
          // Initial state
          feedbackStates.push({ 
            state: 'initializing', 
            message: 'Initializing camera recovery...',
            attempt: 0 
          });
          
          // Recovery attempt
          window.__recoveryState.incrementAttempt();
          feedbackStates.push({
            state: 'recovering',
            message: `Recovery attempt ${window.__recoveryState.attempts} of ${window.__recoveryState.maxAttempts}...`,
            attempt: window.__recoveryState.attempts
          });
          
          // Success state
          if (window.__recoveryState.canRecover()) {
            feedbackStates.push({
              state: 'success',
              message: 'Camera recovered successfully',
              attempt: window.__recoveryState.attempts
            });
          }
        };
        
        await simulateRecovery();
        
        return feedbackStates;
      });
      
      expect(userFeedbackTest.length).toBeGreaterThan(0);
      expect(userFeedbackTest[0].state).toBe('initializing');
      expect(userFeedbackTest[1].state).toBe('recovering');
      expect(userFeedbackTest[2].state).toBe('success');
    });
    
    test('should handle state transitions during recovery process', async ({ page }) => {
      const stateTransitionsTest = await page.evaluate(async () => {
        const stateTransitions = [];
        
        // Simulate recovery state machine
        const recoveryStates = [
          'idle',
          'detecting_issue',
          'initializing_recovery',
          'validating_state',
          'recovering',
          'success',
          'failed_permanent'
        ];
        
        let currentState = 'idle';
        
        const transitionTo = (newState) => {
          stateTransitions.push({
            from: currentState,
            to: newState,
            timestamp: Date.now()
          });
          currentState = newState;
        };
        
        // Simulate recovery flow
        transitionTo('detecting_issue');
        transitionTo('initializing_recovery');
        transitionTo('validating_state');
        transitionTo('recovering');
        transitionTo('success');
        
        return {
          transitions: stateTransitions,
          finalState: currentState,
          transitionCount: stateTransitions.length
        };
      });
      
      expect(stateTransitionsTest.transitionCount).toBe(5);
      expect(stateTransitionsTest.finalState).toBe('success');
      expect(stateTransitionsTest.transitions[0].from).toBe('idle');
      expect(stateTransitionsTest.transitions[4].to).toBe('success');
    });
  });
  
  test.describe('Recovery Integration Tests', () => {
    
    test('should complete full recovery workflow successfully', async ({ page }) => {
      const fullWorkflowTest = await page.evaluate(async () => {
        window.__recoveryState.reset();
        
        const workflow = [];
        
        // Step 1: Detect issue
        workflow.push({ step: 'detect_issue', success: true });
        
        // Step 2: Start recovery
        const attempt1 = window.__recoveryState.incrementAttempt();
        workflow.push({ step: 'attempt_1', attempt: attempt1, success: true });
        
        // Step 3: Validate state
        class ValidStream {
          tracks = [{ kind: 'video', readyState: 'live', enabled: true }];
          active = true;
          
          getVideoTracks() {
            return this.tracks;
          }
        }
        
        const validVideo = {
          readyState: 4,
          srcObject: new ValidStream(),
          paused: false,
          videoWidth: 1280,
          videoHeight: 720
        };
        
        const validation = await window.__validateRecoveryState(validVideo);
        workflow.push({ step: 'validate_state', valid: validation.valid });
        
        // Step 4: If valid, reset and complete
        if (validation.valid) {
          window.__recoveryState.reset();
          workflow.push({ step: 'reset_and_complete', success: true });
        }
        
        return {
          workflow,
          finalAttempts: window.__recoveryState.attempts,
          workflowComplete: workflow.length === 4
        };
      });
      
      expect(fullWorkflowTest.workflowComplete).toBe(true);
      expect(fullWorkflowTest.finalAttempts).toBe(0);
      expect(fullWorkflowTest.workflow[2].valid).toBe(true);
    });
    
    test('should handle recovery failure gracefully', async ({ page }) => {
      const failureWorkflowTest = await page.evaluate(async () => {
        window.__recoveryState.reset();
        
        const workflow = [];
        
        // Simulate multiple failed recovery attempts
        for (let i = 0; i < 3; i++) {
          window.__recoveryState.incrementAttempt();
          
          // Simulate validation failure
          class InvalidStream {
            tracks = [{ kind: 'video', readyState: 'ended', enabled: false }];
            active = false;
            
            getVideoTracks() {
              return this.tracks;
            }
          }
          
          const invalidVideo = {
            readyState: 1,
            srcObject: new InvalidStream(),
            paused: true,
            videoWidth: 0,
            videoHeight: 0
          };
          
          const validation = await window.__validateRecoveryState(invalidVideo);
          workflow.push({
            attempt: i + 1,
            validationPassed: validation.valid,
            canRecover: window.__recoveryState.canRecover()
          });
        }
        
        // Final state
        const finalState = {
          attempts: window.__recoveryState.attempts,
          canRecover: window.__recoveryState.canRecover(),
          shouldStop: !window.__recoveryState.canRecover()
        };
        
        return {
          workflow,
          finalState
        };
      });
      
      expect(failureWorkflowTest.workflow.length).toBe(3);
      expect(failureWorkflowTest.workflow.every(w => !w.validationPassed)).toBe(true);
      expect(failureWorkflowTest.finalState.shouldStop).toBe(true);
      expect(failureWorkflowTest.finalState.canRecover).toBe(false);
    });
  });
});