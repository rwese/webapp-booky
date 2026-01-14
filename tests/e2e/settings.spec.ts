import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should navigate to settings page', async ({ page }) => {
    // Navigate to settings directly
    await page.goto('/settings');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that we reached the settings page
    await expect(page).toHaveURL(/.*\/settings/);
    
    // Verify settings page heading is visible
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('should have import functionality', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Check that Import button exists
    await expect(page.locator('button:has-text("Import")').first()).toBeVisible();
  });
});
