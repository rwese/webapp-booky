/**
 * Essential E2E Tests for Book Collection App
 * Tests core functionality: page loading, navigation, and basic UI interactions
 */

import { test, expect } from '@playwright/test';

test.describe('Essential E2E Tests', () => {
   
  test.describe('Page Loading', () => {
    test('should load library page', async ({ page }) => {
      await page.goto('/library');
      // Use exact match to avoid matching "Your library is empty" heading
      await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
    });

    test('should load add book page', async ({ page }) => {
      await page.goto('/add');
      await expect(page.getByRole('heading', { name: 'Add New Book' })).toBeVisible();
    });

    test('should load home page', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate from library to add book via button', async ({ page }) => {
      await page.goto('/library');
      
      // Click "Add Your First Book" link when library is empty
      await page.getByRole('link', { name: 'Add Your First Book' }).click();
      
      // Should navigate to add book page
      await expect(page).toHaveURL(/\/add/);
      await expect(page.getByRole('heading', { name: 'Add New Book' })).toBeVisible();
    });

    test('should have main navigation buttons', async ({ page }) => {
      await page.goto('/library');
      
      // Check main action buttons exist using aria-labels
      await expect(page.locator('button[aria-label="Add new book"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Scan barcode"]')).toBeVisible();
    });
  });

  test.describe('Add Book Page', () => {
    test('should show manual entry tab by default', async ({ page }) => {
      await page.goto('/add');
      
      // Check that manual entry tab is visible
      await expect(page.getByRole('button', { name: 'Manual Entry' })).toBeVisible();
      
      // Check form fields exist (search for inputs after clicking manual entry)
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      await expect(page.getByPlaceholder('Enter book title')).toBeVisible();
      await expect(page.getByPlaceholder('Enter author name(s), separated by commas')).toBeVisible();
    });

    test('should accept ISBN input', async ({ page }) => {
      await page.goto('/add');
      
      // Click Manual Entry tab first
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      
      // Fill in ISBN field
      const isbnInput = page.getByPlaceholder(/Enter ISBN/);
      await isbnInput.fill('978-1234567890');
      
      // Check that the input has the value
      await expect(isbnInput).toHaveValue('978-1234567890');
    });
  });

  test.describe('Empty State', () => {
    test('should show empty library state', async ({ page }) => {
      await page.goto('/library');
      
      // Should show empty state message
      await expect(page.getByRole('heading', { name: 'Your library is empty' })).toBeVisible();
      await expect(page.getByText('Start building your collection')).toBeVisible();
    });
  });

});
