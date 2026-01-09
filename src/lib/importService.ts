import type { 
  Book, 
  Rating, 
  ReadingLog, 
  Tag,
  ImportBookData,
  ImportMetadata,
  ImportResult,
  ImportProgress 
} from '../types';
import { 
  bookOperations, 
  ratingOperations, 
  readingLogOperations,
  tagOperations 
} from './db';
import { 
  transformImportBook,
  generateImportBookId,
  validateImportBook,
  bookExistsByIsbn,
  bookExistsByTitleAuthor,
  getFileExtension,
  processTagsForImport
} from './importUtils';

class BookImportService {
  private coverImagesPath: string = '/Users/wese/Downloads/booknotes-export/cover_images/';
  private importedBooks: Map<string, Book> = new Map();
  private progressCallback?: (progress: ImportProgress) => void;

  // Configure import paths
  setCoverImagesPath(path: string) {
    this.coverImagesPath = path;
  }

  // Set progress callback
  setProgressCallback(callback: (progress: ImportProgress) => void) {
    this.progressCallback = callback;
  }

  // Update progress
  private updateProgress(progress: Partial<ImportProgress>) {
    if (this.progressCallback) {
      this.progressCallback({
        total: progress.total || 0,
        current: progress.current || 0,
        status: progress.status || 'idle',
        currentBook: progress.currentBook,
        errors: progress.errors || []
      });
    }
  }

  // Read and parse import metadata file
  async readImportMetadata(filePath: string): Promise<ImportMetadata> {
    this.updateProgress({ status: 'reading', current: 0, total: 0 });

    try {
      // For web environment, we'll read the file content
      const response = await fetch(`file://${filePath}`);
      if (!response.ok) {
        throw new Error(`Failed to read file: ${filePath}`);
      }
      
      const text = await response.text();
      const data = JSON.parse(text);
      
      return {
        books: data.books || data,
        exportedAt: data.exportedAt || new Date().toISOString(),
        source: data.source || 'booknotes-export',
        version: data.version || '1.0'
      };
    } catch (error) {
      console.error('Error reading import metadata:', error);
      throw error;
    }
  }

  // Preview import data without actually importing
  async previewImport(importData: ImportBookData[]): Promise<{
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    books: Array<{
      data: ImportBookData;
      isValid: boolean;
      errors: string[];
      isDuplicate: boolean;
      duplicateInfo?: string;
    }>;
  }> {
    const results = [];
    let valid = 0;
    let invalid = 0;
    let duplicates = 0;

    for (const book of importData) {
      const validation = validateImportBook(book);
      const isDuplicate = await this.checkForDuplicate(book);
      
      if (isDuplicate.duplicate) {
        duplicates++;
      } else if (!validation.valid) {
        invalid++;
      } else {
        valid++;
      }

      results.push({
        data: book,
        isValid: validation.valid && !isDuplicate.duplicate,
        errors: validation.errors,
        isDuplicate: isDuplicate.duplicate,
        duplicateInfo: isDuplicate.reason
      });
    }

    return {
      total: importData.length,
      valid,
      invalid,
      duplicates,
      books: results
    };
  }

  // Check for duplicates before import
  private async checkForDuplicate(importBook: ImportBookData): Promise<{
    duplicate: boolean;
    reason?: string;
  }> {
    // Check by ISBN
    if (importBook.isbn) {
      const exists = await bookExistsByIsbn(importBook.isbn);
      if (exists) {
        return { duplicate: true, reason: `ISBN ${importBook.isbn} already exists` };
      }
    }

    // Check by title and author
    const author = importBook.author?.trim();
    const title = importBook.title?.trim();
    if (author && title) {
      const exists = await bookExistsByTitleAuthor(title, author);
      if (exists) {
        return { duplicate: true, reason: `Book "${title}" by ${author} already exists` };
      }
    }

    return { duplicate: false };
  }

  // Process and import a single book
  private async importSingleBook(importBook: ImportBookData): Promise<{
    success: boolean;
    bookId?: string;
    error?: string;
  }> {
    try {
      // Validate the book data
      const validation = validateImportBook(importBook);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      // Check for duplicates
      const duplicateCheck = await this.checkForDuplicate(importBook);
      if (duplicateCheck.duplicate) {
        return { success: false, error: duplicateCheck.reason };
      }

      // Transform the book data
      const transformed = transformImportBook(importBook);
      const newBookId = generateImportBookId(importBook.id);

      // Create the book
      const book: Book = {
        ...transformed.book as Book,
        id: newBookId,
        localCoverPath: importBook.coverFilename 
          ? await this.processCoverImage(importBook.coverFilename, newBookId)
          : undefined
      };

      // Add the book to database
      await bookOperations.add(book);

      // Create rating if available
      if (transformed.rating) {
        const rating: Rating = {
          ...transformed.rating,
          id: crypto.randomUUID(),
          bookId: newBookId
        };
        await ratingOperations.upsert(rating);
      }

      // Create reading log
      const readingLog: ReadingLog = {
        ...transformed.readingLog,
        id: crypto.randomUUID(),
        bookId: newBookId
      };
      await readingLogOperations.upsert(readingLog);

      // Process tags
      if (transformed.tags.length > 0) {
        await processTagsForImport(newBookId, transformed.tags);
      }

      // Track imported book
      this.importedBooks.set(newBookId, book);

      return { success: true, bookId: newBookId };
    } catch (error) {
      console.error('Error importing book:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Process cover image - copy from export folder to app storage
  private async processCoverImage(filename: string, bookId: string): Promise<string | undefined> {
    if (!filename) return undefined;

    try {
      // In a web environment, we'll read the file and store it
      const sourcePath = `${this.coverImagesPath}${filename}`;
      
      // For now, return the local path where the image should be stored
      const extension = getFileExtension(filename);
      const localPath = `covers/${bookId}_${Date.now()}${extension}`;
      
      // In a real implementation, we would:
      // 1. Fetch the image from sourcePath
      // 2. Convert to blob/base64
      // 3. Store in IndexedDB or FileSystem API
      // 4. Return the local reference
      
      console.log(`Processing cover image: ${filename} -> ${localPath}`);
      return localPath;
    } catch (error) {
      console.error('Error processing cover image:', error);
      return undefined;
    }
  }

  // Main import function
  async importBooks(importData: ImportBookData[], options?: {
    skipDuplicates?: boolean;
    onProgress?: (progress: ImportProgress) => void;
  }): Promise<ImportResult> {
    const { skipDuplicates = true, onProgress } = options || {};
    
    this.progressCallback = onProgress;
    const errors: Array<{ bookId: string; title: string; error: string; field?: string }> = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    const total = importData.length;
    this.updateProgress({ status: 'processing', total, current: 0 });

    for (let i = 0; i < importData.length; i++) {
      const book = importData[i];
      this.updateProgress({ 
        status: 'importing', 
        total, 
        current: i + 1, 
        currentBook: book.title 
      });

      const result = await this.importSingleBook(book);

      if (result.success) {
        imported++;
      } else if (result.error?.includes('already exists')) {
        if (skipDuplicates) {
          skipped++;
        } else {
          failed++;
          errors.push({
            bookId: book.id,
            title: book.title,
            error: result.error
          });
        }
      } else {
        failed++;
        errors.push({
          bookId: book.id,
          title: book.title,
          error: result.error || 'Unknown error'
        });
      }
    }

    this.updateProgress({ 
      status: 'completed', 
      total, 
      current: total,
      errors 
    });

    return {
      success: failed === 0,
      imported,
      skipped,
      failed,
      errors
    };
  }

  // Get summary of imported books
  getImportedBooksSummary(): {
    count: number;
    books: Book[];
  } {
    return {
      count: this.importedBooks.size,
      books: Array.from(this.importedBooks.values())
    };
  }

  // Clear imported books cache
  clearImportedBooks() {
    this.importedBooks.clear();
  }
}

// Singleton instance
export const bookImportService = new BookImportService();

// File system utilities for Node.js (for backend/preview)
// These are not used in the web environment but may be needed for preprocessing
export async function readJsonFile(filePath: string): Promise<any> {
  try {
    // This would use Node.js fs in a Node environment
    // For browser, we use fetch
    const response = await fetch(`file://${filePath}`);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${filePath}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading JSON file:', error);
    throw error;
  }
}

export function validateImportPath(path: string): boolean {
  // Basic validation of import path
  return path.length > 0 && !path.includes('..');
}
