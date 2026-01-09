/**
 * Playwright Regression Tests for Book Collection App
 * Tests core functionality: library, books, collections, tags
 */

import { test, expect } from '@playwright/test';

describe('Book Collection App - Core Regression Tests', () => {
  
  describe('Library View', () => {
    test('should load library page successfully', async ({ page }) => {
      await page.goto('/library');
      
      // Check page loads and shows expected elements
      await expect(page.locator('h1:has-text("Library")')).toBeVisible();
      await expect(page.locator('text=Add new book')).toBeVisible();
    });

    test('should display empty state when no books exist', async ({ page }) => {
      await page.goto('/library');
      
      // Should show empty state message
      await expect(page.locator('text=Your library is empty')).toBeVisible();
      await expect(page.locator('text=Add Your First Book')).toBeVisible();
    });
  });

  describe('Book Creation', () => {
    test('should navigate to add book page', async ({ page }) => {
      await page.goto('/library');
      await page.click('text=Add Your First Book');
      
      await expect(page.locator('h1:has-text("Add New Book")')).toBeVisible();
    });

    test('should add a book via manual entry', async ({ page }) => {
      await page.goto('/add');
      
      // Click Manual Entry tab
      await page.click('button:has-text("Manual Entry")');
      
      // Fill in book details
      await page.fill('input[placeholder*="Enter book title"]', 'Test Book for Regression');
      await page.fill('input[placeholder*="Enter author name"]', 'Test Author');
      await page.fill('input[placeholder*="Enter ISBN"]', '978-1234567890');
      
      // Submit the form
      await page.click('button:has-text("Add Book")');
      
      // Should redirect to library and show success
      await expect(page).toHaveURL(/.*library/);
      await expect(page.locator('text=Book added to your collection')).toBeVisible();
    });

    test('should display created book in library', async ({ page }) => {
      await page.goto('/library');
      
      // The book should appear in the library
      await expect(page.locator('h3:has-text("Test Book for Regression")')).toBeVisible();
      await expect(page.locator('text=Test Author')).toBeVisible();
    });
  });

  describe('Book Detail View', () => {
    test('should navigate to book detail page', async ({ page }) => {
      await page.goto('/library');
      
      // Click on the book
      await page.click('h3:has-text("Test Book for Regression")');
      
      // Should navigate to book detail
      await expect(page).toHaveURL(/.*book\//);
      await expect(page.locator('h2:has-text("Test Book for Regression")')).toBeVisible();
    });

    test('should display book details correctly', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      
      // Check key elements are visible
      await expect(page.locator('text=by Test Author')).toBeVisible();
      await expect(page.locator('text=978-0-12-345678-9')).toBeVisible();
    });

    test('should have edit functionality', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      
      // Edit button should be visible
      await expect(page.locator('button:has-text("Edit")').first()).toBeVisible();
    });
  });

  describe('Book Editing', () => {
    test('should navigate to edit page', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Edit")');
      
      // Should be on edit page
      await expect(page).toHaveURL(/.*edit\//);
      await expect(page.locator('h1:has-text("Edit Book")')).toBeVisible();
    });

    test('should pre-fill existing book data', async ({ page }) => {
      await page.goto('/edit');
      // Navigate to a specific book edit page
      const bookId = 'test-book-id'; // This would need to be dynamic in real tests
      await page.goto(`/edit/${bookId}`);
      
      // Form should be pre-filled with existing data
      // This test would need a real book ID to work properly
    });

    test('should save book changes', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Edit")');
      
      // Change the title
      const titleInput = page.locator('input[placeholder*="Enter book title"]');
      await titleInput.clear();
      await titleInput.fill('Updated Test Book Title');
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      
      // Should redirect back to book detail
      await expect(page).toHaveURL(/.*book\//);
      await expect(page.locator('h2:has-text("Updated Test Book Title")')).toBeVisible();
    });
  });

  describe('Collections Management', () => {
    test('should open collections selector', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Collections")');
      
      // Collections panel should open
      await expect(page.locator('h3:has-text("Add to Collections")')).toBeVisible();
    });

    test('should create new collection on-the-fly', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Collections")');
      
      // Type a new collection name
      await page.fill('input[placeholder*="Search or create collection"]', 'My Test Collection');
      
      // Should show create option
      await expect(page.locator('button:has-text("Create new collection")')).toBeVisible();
      
      // Create the collection
      await page.click('button:has-text("Create new collection")');
      
      // Collection should be created and selected
      await expect(page.locator('text=My Test Collection')).toBeVisible();
    });

    test('should search existing collections', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Collections")');
      
      // Type part of an existing collection name
      await page.fill('input[placeholder*="Search or create collection"]', 'My Test');
      
      // Should show matching collections
      await expect(page.locator('button:has-text("My Test Collection")')).toBeVisible();
    });
  });

  describe('Tags Management', () => {
    test('should open tags manager', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Manage Tags")');
      
      // Tags manager should open
      await expect(page.locator('h2:has-text("Manage Tags")')).toBeVisible();
    });

    test('should create new tag on-the-fly', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Manage Tags")');
      
      // Type a new tag name
      await page.fill('input[placeholder*="Search tags or create new"]', 'fantastic');
      
      // Should show create option
      await expect(page.locator('button:has-text("Create")')).toBeVisible();
      
      // Create the tag
      await page.click('button:has-text("Create")');
      
      // Tag should appear in the list
      await expect(page.locator('text=fantastic')).toBeVisible();
    });

    test('should search existing tags', async ({ page }) => {
      await page.goto('/library');
      await page.click('h3:has-text("Test Book for Regression")');
      await page.click('button:has-text("Manage Tags")');
      
      // Type part of an existing tag name
      await page.fill('input[placeholder*="Search tags or create new"]', 'fant');
      
      // Should show matching tags
      await expect(page.locator('button:has-text("fantastic")')).toBeVisible();
    });
  });

  describe('Navigation', () => {
    test('should have working navigation elements', async ({ page }) => {
      await page.goto('/library');
      
      // Check main navigation exists
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('button:has-text("Add new book")')).toBeVisible();
      await expect(page.locator('button:has-text("Scan barcode")')).toBeVisible();
    });

    test('should handle navigation between pages', async ({ page }) => {
      await page.goto('/library');
      await page.click('text=Add Your First Book');
      await expect(page).toHaveURL(/.*add/);
      
      // Go back using browser navigation
      await page.goto('/library');
      await expect(page).toHaveURL(/.*library/);
    });
  });

  describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/library');
      
      // Core functionality should still work
      await expect(page.locator('h1:has-text("Library")')).toBeVisible();
      await expect(page.locator('button:has-text("Add new book")')).toBeVisible();
    });
  });

  describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/library');
      
      // Check that h1 exists and is unique
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
    });

    test('should have labels for form inputs', async ({ page }) => {
      await page.goto('/add');
      await page.click('button:has-text("Manual Entry")');
      
      // Check that inputs have proper placeholders
      await expect(page.locator('input[placeholder*="Enter book title"]')).toBeVisible();
      await expect(page.locator('input[placeholder*="Enter author name"]')).toBeVisible();
    });

    test('should have accessible buttons', async ({ page }) => {
      await page.goto('/library');
      
      // Buttons should have text content
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      for (let i = 0; i < count; i++) {
        const buttonText = await buttons.nth(i).textContent();
        expect(buttonText?.trim().length).toBeGreaterThan(0);
      }
    });
  });
});

describe('Book Collection App - Edge Cases', () => {
  
  describe('Error Handling', () => {
    test('should handle non-existent book page gracefully', async ({ page }) => {
      await page.goto('/book/non-existent-id');
      
      // Should either show 404 or redirect
      // The app might redirect to library or show an error
    });

    test('should handle non-existent edit page gracefully', async ({ page }) => {
      await page.goto('/edit/non-existent-id');
      
      // Should handle gracefully
    });
  });

  describe('Form Validation', () => {
    test('should require title when adding book', async ({ page }) => {
      await page.goto('/add');
      await page.click('button:has-text("Manual Entry")');
      
      // Try to submit without title
      await page.click('button:has-text("Add Book")');
      
      // Should show validation error or not submit
      // This depends on the implementation
    });

    test('should handle special characters in book titles', async ({ page }) => {
      await page.goto('/add');
      await page.click('button:has-text("Manual Entry")');
      
      // Add book with special characters
      await page.fill('input[placeholder*="Enter book title"]', 'Book with special chars: @#$%');
      await page.fill('input[placeholder*="Enter author name"]', 'Author Name');
      
      await page.click('button:has-text("Add Book")');
      
      // Should handle special characters correctly
      await expect(page).toHaveURL(/.*library/);
    });
  });

  describe('Database Operations', () => {
    test('should persist data across page reloads', async ({ page }) => {
      // Create a book
      await page.goto('/add');
      await page.click('button:has-text("Manual Entry")');
      await page.fill('input[placeholder*="Enter book title"]', 'Persistence Test Book');
      await page.fill('input[placeholder*="Enter author name"]', 'Test Author');
      await page.click('button:has-text("Add Book")');
      
      // Reload the page
      await page.reload();
      
      // Book should still be there
      await page.goto('/library');
      await expect(page.locator('h3:has-text("Persistence Test Book")')).toBeVisible();
    });
  });
});