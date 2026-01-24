/**
 * Comprehensive E2E Tests for Book Collection App
 * Tests critical user journeys: book cataloging, barcode scanning, reading status, analytics
 * 
 * Covering happy paths and error scenarios with Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Book Cataloging Workflow', () => {
  
  test.describe('Add Book Page - UI Elements', () => {
    test('should display add book page with correct heading', async ({ page }) => {
      await page.goto('/add');
      await expect(page.getByRole('heading', { name: 'Add New Book' })).toBeVisible();
    });

    test('should show three tabs: Search, ISBN / Barcode, Manual Entry', async ({ page }) => {
      await page.goto('/add');
      
      // Check all three tabs are visible
      await expect(page.getByRole('button', { name: 'Search' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'ISBN / Barcode' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Manual Entry' })).toBeVisible();
    });

    test('should show search input when Search tab is active', async ({ page }) => {
      await page.goto('/add');
      
      // Click Search tab
      await page.getByRole('button', { name: 'Search' }).nth(0).click();
      
      // Search input should be visible
      await expect(page.getByPlaceholder('Search by title, author, or keywords...')).toBeVisible();
      
      // Search button should be visible
      await expect(page.getByRole('button', { name: 'Search' }).nth(1)).toBeVisible();
    });

    test('should show ISBN input when ISBN / Barcode tab is active', async ({ page }) => {
      await page.goto('/add');
      
      // Click ISBN / Barcode tab
      await page.getByRole('button', { name: 'ISBN / Barcode' }).click();
      
      // ISBN input should be visible
      await expect(page.getByPlaceholder('Enter ISBN or scan barcode...')).toBeVisible();
      
      // Lookup button should be visible
      await expect(page.getByRole('button', { name: 'Lookup' })).toBeVisible();
      
      // Scan barcode button should be visible
      await expect(page.locator('button[aria-label="Scan barcode"]')).toBeVisible();
    });

    test('should show manual entry form when Manual Entry tab is active', async ({ page }) => {
      await page.goto('/add');
      
      // Click Manual Entry tab
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      
      // Form fields should be visible
      await expect(page.getByPlaceholder('Enter book title')).toBeVisible();
      await expect(page.getByPlaceholder('Enter author name(s), separated by commas')).toBeVisible();
      await expect(page.getByPlaceholder('Enter ISBN (optional)')).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Format' })).toBeVisible();
    });

    test('should allow typing in search input', async ({ page }) => {
      await page.goto('/add');
      await page.getByRole('button', { name: 'Search' }).nth(0).click();
      
      // Type in search input
      const searchInput = page.getByPlaceholder('Search by title, author, or keywords...');
      await searchInput.fill('Test book search');
      
      // Verify input has the value
      await expect(searchInput).toHaveValue('Test book search');
    });
  });

  test.describe('Book Cataloging - Error Scenarios', () => {
    test('should show error for invalid ISBN format', async ({ page }) => {
      await page.goto('/add');
      
      // First switch to ISBN mode by clicking the ISBN / Barcode tab
      await page.getByRole('button', { name: 'ISBN / Barcode' }).click();
      
      // Fill with invalid ISBN
      await page.getByPlaceholder('Enter ISBN or scan barcode...').fill('invalid-isbn');
      
      // Submit
      await page.getByRole('button', { name: 'Lookup' }).click();
      
      // Should show validation error - exact match for the toast message
      await expect(page.getByText('Please enter a valid ISBN')).toBeVisible({ timeout: 5000 });
    });

    test('should require mandatory title field', async ({ page }) => {
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      
      // Leave title empty and try to submit
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Test Author');
      await page.getByRole('button', { name: /Add Book/i }).click();
      
      // Should show title required error
      await expect(page.getByText('Please enter a book title')).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('Barcode Scanning Flow', () => {
  
  test.describe('Barcode Scanner UI', () => {
    test('should open barcode scanner from add page', async ({ page }) => {
      await page.goto('/add');
      
      // Click scan barcode button
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Scanner modal should open - check for the heading
      await expect(page.getByRole('heading', { name: 'Scan ISBN Barcode' })).toBeVisible({ timeout: 5000 });
    });

    test('should show camera controls when scanner is open', async ({ page }) => {
      await page.goto('/add');
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Camera mode tab should be visible and active by default - use exact match
      await expect(page.getByRole('button', { name: 'Camera', exact: true })).toBeVisible({ timeout: 5000 });
      
      // Check for Camera tab being active
      await expect(page.getByRole('button', { name: 'Camera', exact: true })).toHaveClass(/bg-primary/);
    });

    test('should close scanner modal', async ({ page }) => {
      await page.goto('/add');
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Scanner should be open
      await expect(page.getByRole('heading', { name: 'Scan ISBN Barcode' })).toBeVisible({ timeout: 5000 });
      
      // Close scanner using the close button
      await page.getByRole('button', { name: 'Close scanner' }).click();
      
      // Scanner should be closed
      await expect(page.getByRole('heading', { name: 'Scan ISBN Barcode' })).not.toBeVisible();
    });
  });

  test.describe('Barcode Scanner - Manual Entry', () => {
    test('should show manual entry mode in scanner', async ({ page }) => {
      await page.goto('/add');
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Switch to Manual mode in scanner - use last() for the scanner modal's Manual button
      await page.getByRole('button', { name: 'Manual' }).last().click();
      
      // Manual entry input should be visible
      await expect(page.getByPlaceholder('Enter ISBN...')).toBeVisible({ timeout: 5000 });
      
      // Look Up Book button should be visible
      await expect(page.getByRole('button', { name: 'Look Up Book' })).toBeVisible();
    });
  });
});

test.describe('Reading Status Updates', () => {
  
  test.describe('Reading Status - Book Creation', () => {
    test('should create a book via manual entry', async ({ page }) => {
      // Navigate to add book page
      await page.goto('/add');
      
      // Click Manual Entry tab
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      
      // Fill in book details
      await page.getByPlaceholder('Enter book title').fill('Reading Status Test Book');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Status Author');
      
      // Submit form
      await page.getByRole('button', { name: /Add Book/i }).click();
      
      // Should redirect to library
      await expect(page).toHaveURL(/.*library/);
      
      // Verify success toast
      await expect(page.getByText('Book added to your collection')).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('Analytics Dashboard', () => {
  
  test.describe('Analytics Dashboard - UI', () => {
    test('should load analytics page', async ({ page }) => {
      await page.goto('/analytics');
      await expect(page.getByRole('heading', { name: /Analytics|Reading Insights/i })).toBeVisible({ timeout: 10000 });
    });
  });
});
