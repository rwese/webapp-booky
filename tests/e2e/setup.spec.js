/**
 * Playwright Basic Setup Test
 * Simple test to verify Playwright and dev server are working correctly
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Setup', () => {
  test('should load the app homepage', async ({ page }) => {
    await page.goto('/');
    
    // Just check that the page loads without errors
    await expect(page).toHaveTitle(/Book/);
  });

  test('should load library page', async ({ page }) => {
    await page.goto('/library');
    
    // Wait a bit for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check that we got some content
    const content = await page.content();
    console.log('Page loaded, content length:', content.length);
  });
});