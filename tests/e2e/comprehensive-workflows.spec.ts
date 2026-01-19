/**
 * Comprehensive E2E Tests for Book Collection App
 * Tests critical user journeys: book cataloging, barcode scanning, reading status, analytics
 * 
 * Covering happy paths and error scenarios with Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Book Cataloging Workflow', () => {
  
  test.describe('Happy Path - Complete Book Cataloging', () => {
    test('should complete full book cataloging workflow from search to detail', async ({ page }) => {
      // Step 1: Navigate to add book page
      await page.goto('/add');
      await expect(page.getByRole('heading', { name: 'Add New Book' })).toBeVisible();

      // Step 2: Search for a book (using Open Library API)
      await page.getByRole('button', { name: 'Search by Title or Author' }).click();
      const searchInput = page.getByPlaceholder('Search for books by title or author...');
      await searchInput.fill('The Great Gatsby');
      
      // Start search and wait for results
      await page.getByRole('button', { name: 'Search' }).click();
      
      // Wait for search results to appear
      await expect(page.getByRole('heading', { name: /Search Results/i }).first()).toBeVisible({ timeout: 10000 });

      // Step 3: Select a book from search results
      const firstBook = page.locator('[data-testid="search-result"]').first();
      await expect(firstBook).toBeVisible({ timeout: 5000 });
      await firstBook.click();

      // Step 4: Verify book details page shows selected book
      await expect(page.getByRole('heading').first()).toBeVisible();

      // Step 5: Add book to collection
      await page.getByRole('button', { name: /Add to Collection|Add Book/i }).click();
      
      // Step 6: Verify success toast and redirect
      await expect(page.getByText('Book added to your collection')).toBeVisible({ timeout: 5000 });
      await expect(page).toHaveURL(/.*library/);

      // Step 7: Verify book appears in library
      await expect(page.getByRole('heading', { name: /Great Gatsby/i })).toBeVisible({ timeout: 5000 });
    });

    test('should add book via manual entry with all fields', async ({ page }) => {
      // Navigate to add book page
      await page.goto('/add');
      
      // Click Manual Entry tab
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      
      // Fill all form fields
      await page.getByPlaceholder('Enter book title').fill('Complete Manual Entry Test Book');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Test Author One, Test Author Two');
      await page.getByPlaceholder('Enter ISBN (optional)').fill('978-1-234567-89-0');
      await page.getByPlaceholder('Enter publisher (optional)').fill('Test Publisher');
      
      // Select format
      await page.getByRole('combobox', { name: 'Format' }).click();
      await page.getByRole('option', { name: 'Physical' }).click();
      
      // Submit form
      await page.getByRole('button', { name: /Add Book/i }).click();
      
      // Verify success
      await expect(page).toHaveURL(/.*library/);
      await expect(page.getByText('Book added to your collection')).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('heading', { name: 'Complete Manual Entry Test Book' })).toBeVisible();
    });
  });

  test.describe('Book Cataloging - Error Scenarios', () => {
    test('should show error for invalid ISBN format', async ({ page }) => {
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      
      // Fill with invalid ISBN
      await page.getByPlaceholder('Enter book title').fill('Invalid ISBN Test');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Test Author');
      await page.getByPlaceholder('Enter ISBN (optional)').fill('invalid-isbn');
      
      // Submit
      await page.getByRole('button', { name: /Add Book/i }).click();
      
      // Should show validation error
      await expect(page.getByText(/Please enter a valid ISBN/)).toBeVisible({ timeout: 5000 });
    });

    test('should handle empty search results gracefully', async ({ page }) => {
      await page.goto('/add');
      
      // Search for something that won't exist
      await page.getByRole('button', { name: 'Search by Title or Author' }).click();
      await page.getByPlaceholder('Search for books by title or author...').fill('XYZ123NonExistentBookABC789');
      await page.getByRole('button', { name: 'Search' }).click();
      
      // Should show no results message
      await expect(page.getByText(/No results found|We couldn't find any books/)).toBeVisible({ timeout: 10000 });
    });

    test('should require mandatory fields', async ({ page }) => {
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      
      // Leave title empty and try to submit
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Test Author');
      await page.getByRole('button', { name: /Add Book/i }).click();
      
      // Should show title required error
      await expect(page.getByText(/Please enter a book title|Title is required/)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Book Cataloging - Search Functionality', () => {
    test('should filter search results by author', async ({ page }) => {
      await page.goto('/add');
      await page.getByRole('button', { name: 'Search by Title or Author' }).click();
      
      // Search by specific author
      await page.getByPlaceholder('Search for books by title or author...').fill('J.K. Rowling');
      await page.getByRole('button', { name: 'Search' }).click();
      
      // Results should appear
      await expect(page.locator('[data-testid="search-result"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('should clear search and start over', async ({ page }) => {
      await page.goto('/add');
      await page.getByRole('button', { name: 'Search by Title or Author' }).click();
      
      // Perform search
      await page.getByPlaceholder('Search for books by title or author...').fill('Test');
      await page.getByRole('button', { name: 'Search' }).click();
      
      // Wait for results
      await expect(page.locator('[data-testid="search-result"]').first()).toBeVisible({ timeout: 10000 });
      
      // Clear search
      await page.getByRole('button', { name: /Clear|Reset/i }).click();
      
      // Search input should be empty
      await expect(page.getByPlaceholder('Search for books by title or author...')).toHaveValue('');
    });
  });
});

test.describe('Barcode Scanning Flow', () => {
  
  test.describe('Barcode Scanner UI', () => {
    test('should open barcode scanner from add page', async ({ page }) => {
      await page.goto('/add');
      
      // Click scan barcode button
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Scanner modal should open
      await expect(page.getByRole('heading', { name: /Scan Barcode|ISBN Scanner/i })).toBeVisible({ timeout: 5000 });
    });

    test('should show camera permission UI elements', async ({ page }) => {
      await page.goto('/add');
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Camera view should be present (or placeholder if no camera)
      await expect(page.locator('[data-testid="camera-view"], [data-testid="scanner-placeholder"]').first()).toBeVisible({ timeout: 5000 });
    });

    test('should close scanner modal', async ({ page }) => {
      await page.goto('/add');
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Scanner should be open
      await expect(page.getByRole('heading', { name: /Scan Barcode|ISBN Scanner/i })).toBeVisible({ timeout: 5000 });
      
      // Close scanner
      await page.getByRole('button', { name: /Close|Cancel/i }).click();
      
      // Scanner should be closed
      await expect(page.getByRole('heading', { name: /Scan Barcode|ISBN Scanner/i })).not.toBeVisible();
    });
  });

  test.describe('Barcode Scanner - Error Handling', () => {
    test('should handle invalid barcode input manually', async ({ page }) => {
      await page.goto('/add');
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Enter invalid ISBN manually
      const manualEntryTab = page.getByRole('button', { name: /Enter Manually|Manual/i });
      if (await manualEntryTab.isVisible()) {
        await manualEntryTab.click();
      }
      
      // Enter invalid barcode format
      await page.getByPlaceholder(/Enter ISBN barcode/).fill('12345');
      await page.getByRole('button', { name: /Look Up|Lookup/i }).click();
      
      // Should show error for invalid format
      await expect(page.getByText(/Invalid ISBN format|Please enter a valid/)).toBeVisible({ timeout: 5000 });
    });

    test('should handle camera permission denial', async ({ page }) => {
      // This test would require mocking the camera API
      // In real scenario, test that appropriate error is shown when camera is not available
      await page.goto('/add');
      await page.locator('button[aria-label="Scan barcode"]').click();
      
      // Check for fallback option
      await expect(page.getByRole('button', { name: /Enter Manually|Manual/i })).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('Reading Status Updates', () => {
  
  test.describe('Reading Status Happy Path', () => {
    test('should update book status to Currently Reading', async ({ page }) => {
      // Create a book first
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      await page.getByPlaceholder('Enter book title').fill('Reading Status Test Book');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Status Author');
      await page.getByRole('button', { name: /Add Book/i }).click();
      await expect(page).toHaveURL(/.*library/);

      // Click on the book
      await page.getByRole('heading', { name: 'Reading Status Test Book' }).click();

      // Find and click reading status dropdown
      const statusDropdown = page.getByRole('combobox', { name: /Reading Status|Status/i });
      await statusDropdown.click();
      
      // Select "Currently Reading"
      await page.getByRole('option', { name: 'Currently Reading' }).click();

      // Verify status updated
      await expect(page.getByText('Currently Reading')).toBeVisible({ timeout: 5000 });
    });

    test('should mark book as Read and verify completion', async ({ page }) => {
      // Create a book first
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      await page.getByPlaceholder('Enter book title').fill('Mark As Read Test Book');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Read Author');
      await page.getByRole('button', { name: /Add Book/i }).click();
      await expect(page).toHaveURL(/.*library/);

      // Click on the book
      await page.getByRole('heading', { name: 'Mark As Read Test Book' }).click();

      // Change status to Read
      const statusDropdown = page.getByRole('combobox', { name: /Reading Status|Status/i });
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Read' }).click();

      // Verify book marked as read
      await expect(page.getByText(/Read ✓|Finished/)).toBeVisible({ timeout: 5000 });
    });

    test('should update reading progress with page count', async ({ page }) => {
      // Create a book first
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      await page.getByPlaceholder('Enter book title').fill('Progress Test Book');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('Progress Author');
      await page.getByRole('button', { name: /Add Book/i }).click();
      await expect(page).toHaveURL(/.*library/);

      // Click on the book
      await page.getByRole('heading', { name: 'Progress Test Book' }).click();

      // Find page count input and update
      const pageInput = page.getByRole('spinbutton', { name: /Pages|Page Count/i });
      if (await pageInput.isVisible()) {
        await pageInput.fill('150');
        await page.getByRole('button', { name: /Save|Update/i }).click();
        
        // Verify success
        await expect(page.getByText(/150 pages|Page count updated/)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Reading Status - Error Handling', () => {
    test('should handle DNF (Did Not Finish) status', async ({ page }) => {
      // Create a book first
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      await page.getByPlaceholder('Enter book title').fill('DNF Test Book');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('DNF Author');
      await page.getByRole('button', { name: /Add Book/i }).click();
      await expect(page).toHaveURL(/.*library/);

      // Click on the book
      await page.getByRole('heading', { name: 'DNF Test Book' }).click();

      // Change status to DNF
      const statusDropdown = page.getByRole('combobox', { name: /Reading Status|Status/i });
      await statusDropdown.click();
      await page.getByRole('option', { name: /Did Not Finish|DNF/i }).click();

      // Verify DNF status
      await expect(page.getByText(/DNF|Did Not Finish/)).toBeVisible({ timeout: 5000 });
    });

    test('should move book back to Want to Read', async ({ page }) => {
      // Create and mark as read
      await page.goto('/add');
      await page.getByRole('button', { name: 'Manual Entry' }).click();
      await page.getByPlaceholder('Enter book title').fill('Want To Read Test Book');
      await page.getByPlaceholder('Enter author name(s), separated by commas').fill('WTR Author');
      await page.getByRole('button', { name: /Add Book/i }).click();
      
      // Mark as read
      await page.getByRole('heading', { name: 'Want To Read Test Book' }).click();
      const statusDropdown = page.getByRole('combobox', { name: /Reading Status|Status/i });
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Read' }).click();
      
      // Change back to Want to Read
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Want to Read' }).click();
      
      // Verify status changed
      await expect(page.getByText(/Want to Read|To Read/)).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('Analytics Dashboard', () => {
  
  test.describe('Analytics Dashboard - Happy Path', () => {
    test('should load analytics page', async ({ page }) => {
      await page.goto('/analytics');
      await expect(page.getByRole('heading', { name: /Analytics|Reading Insights/i })).toBeVisible({ timeout: 5000 });
    });

    test('should display reading statistics widgets', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      
      // Check for key stats
      await expect(page.getByText(/Total Books Read|Books Read/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should display charts and visualizations', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('networkidle');
      
      // Check for chart containers
      await expect(page.locator('[data-testid="chart"], [class*="chart"]').first()).toBeVisible({ timeout: 5000 });
    });

    test('should toggle time range filter', async ({ page }) => {
      await page.goto('/analytics');
      
      // Find and use time range selector
      const timeRangeSelect = page.getByRole('combobox', { name: /Time Range|Period/i });
      if (await timeRangeSelect.isVisible()) {
        await timeRangeSelect.click();
        await page.getByRole('option', { name: 'This Month' }).click();
        
        // Dashboard should update
        await expect(page).toHaveURL(/.*analytics/);
      }
    });
  });

  test.describe('Analytics Dashboard - Empty State', () => {
    test('should show empty state when no reading data exists', async ({ page }) => {
      // This test assumes no books have been read
      await page.goto('/analytics');
      
      // Should show empty state or zero values
      await expect(page.getByText(/No reading data|No books read yet/i).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Analytics Dashboard - Export Functionality', () => {
    test('should have export options', async ({ page }) => {
      await page.goto('/analytics');
      
      // Check for export button
      await expect(page.getByRole('button', { name: /Export|Download/i }).first()).toBeVisible({ timeout: 5000 });
    });

    test('should export analytics as JSON', async ({ page }) => {
      await page.goto('/analytics');
      
      // Click export button
      await page.getByRole('button', { name: /Export|Download/i }).first().click();
      
      // Should show success toast
      await expect(page.getByText(/Analytics exported|Export successful/i)).toBeVisible({ timeout: 5000 });
    });
  });
});
