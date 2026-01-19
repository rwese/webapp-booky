import type { 
  Book, 
  Rating, 
  ReadingLog, 
  ImportBookData,
  ImportMetadata,
  ImportResult,
  ImportProgress 
} from '../types';
import { 
  bookOperations, 
  ratingOperations, 
  readingLogOperations,
  coverImageOperations
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
import JSZip from 'jszip';

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
      const _sourcePath = `${this.coverImagesPath}${filename}`;
      
      // For now, return the local path where the image should be stored
      const extension = getFileExtension(filename);
      const localPath = `covers/${bookId}_${Date.now()}${extension}`;
      
      // In a real implementation, we would:
      // 1. Fetch the image from sourcePath
      // 2. Convert to blob/base64
      // 3. Store in IndexedDB or FileSystem API
      // 4. Return the local reference
      
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

  // Extract and parse a ZIP file containing booknotes-export data
  async extractZipFile(file: File): Promise<{
    metadata: ImportMetadata;
    coverImages: Map<string, Blob>;
  }> {
    this.updateProgress({ status: 'reading', current: 0, total: 0 });

    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      // Find metadata.json in the ZIP
      const metadataFile = zipContent.file('metadata.json');
      if (!metadataFile) {
        throw new Error('metadata.json not found in ZIP file');
      }

      // Parse metadata
      const metadataJson = await metadataFile.async('string');
      const data = JSON.parse(metadataJson);
      
      const metadata: ImportMetadata = {
        books: data.books || data,
        exportedAt: data.exportedAt || new Date().toISOString(),
        source: data.source || 'booknotes-export',
        version: data.version || '1.0'
      };

      // Extract cover images
      const coverImages = new Map<string, Blob>();
      const coverImageFiles = Object.keys(zipContent.files).filter(
        path => path.startsWith('cover_images/') && !zipContent.files[path].dir
      );

      const totalCovers = coverImageFiles.length;
      this.updateProgress({ status: 'reading', total: totalCovers, current: 0 });

      for (let i = 0; i < coverImageFiles.length; i++) {
        const path = coverImageFiles[i];
        const fileData = zipContent.file(path);
        if (fileData) {
          const blob = await fileData.async('blob');
          const filename = path.replace('cover_images/', '');
          coverImages.set(filename, blob);
          
          this.updateProgress({ 
            status: 'reading', 
            total: totalCovers, 
            current: i + 1 
          });
        }
      }

      this.updateProgress({ status: 'completed', total: totalCovers, current: totalCovers });

      return { metadata, coverImages };
    } catch (error) {
      console.error('Error extracting ZIP file:', error);
      throw error;
    }
  }

  // Import books from ZIP file with cover images
  async importFromZip(file: File, options?: {
    skipDuplicates?: boolean;
    onProgress?: (progress: ImportProgress) => void;
  }): Promise<ImportResult> {
    const { skipDuplicates = true, onProgress } = options || {};
    
    this.progressCallback = onProgress;

    try {
      // Extract ZIP contents
      const { metadata, coverImages } = await this.extractZipFile(file);

      // Store cover images and update book data
      const importDataWithCovers: (ImportBookData & { _coverId?: string })[] = await Promise.all(
        metadata.books.map(async (book) => {
          if (book.coverFilename) {
            const coverBlob = coverImages.get(book.coverFilename);
            if (coverBlob) {
              // Store cover image and get ID
              const coverId = await coverImageOperations.store(coverBlob);
              // Store the coverId in a way we can retrieve it during import
              // We'll use a temporary property
              return {
                ...book,
                _coverId: coverId  // Temporary property, will be used during import
              };
            } else {
              // Cover file not found in ZIP
            }
          }
          return book;
        })
      );

      // Create a modified import function that handles stored cover images
      return await this.importBooksWithStoredCovers(importDataWithCovers, {
        skipDuplicates,
        onProgress
      });
    } catch (error) {
      console.error('Error importing from ZIP:', error);
      throw error;
    }
  }

  // Internal method to import books with pre-stored cover image IDs
  private async importBooksWithStoredCovers(importData: (ImportBookData & { _coverId?: string })[], options?: {
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

      const result = await this.importSingleBookWithCover(book);

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

  // Import a single book with pre-stored cover image
  private async importSingleBookWithCover(importBook: ImportBookData & { _coverId?: string }): Promise<{
    success: boolean;
    bookId?: string;
    error?: string;
  }> {
    try {
      const validation = validateImportBook(importBook);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      const duplicateCheck = await this.checkForDuplicate(importBook);
      if (duplicateCheck.duplicate) {
        return { success: false, error: duplicateCheck.reason };
      }

      const transformed = transformImportBook(importBook);
      const newBookId = generateImportBookId(importBook.id);

      // Use stored cover ID if available
      const localCoverPath = importBook._coverId || (
        importBook.coverFilename 
          ? await this.processCoverImage(importBook.coverFilename, newBookId)
          : undefined
      );
      
      const book: Book = {
        ...transformed.book as Book,
        id: newBookId,
        localCoverPath
      };

      await bookOperations.add(book);

      if (transformed.rating) {
        const rating: Rating = {
          ...transformed.rating,
          id: crypto.randomUUID(),
          bookId: newBookId
        };
        await ratingOperations.upsert(rating);
      }

      const readingLog: ReadingLog = {
        ...transformed.readingLog,
        id: crypto.randomUUID(),
        bookId: newBookId
      };
      await readingLogOperations.upsert(readingLog);

      if (transformed.tags.length > 0) {
        await processTagsForImport(newBookId, transformed.tags);
      }

      this.importedBooks.set(newBookId, book);

      return { success: true, bookId: newBookId };
    } catch (error) {
      console.error('Error importing book:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Singleton instance
export const bookImportService = new BookImportService();

// File system utilities for Node.js (for backend/preview)
// These are not used in the web environment but may be needed for preprocessing
export async function readJsonFile(filePath: string): Promise<ImportMetadata> {
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

/**
 * Goodreads CSV Import Types
 */
export interface GoodreadsBookData {
  bookId: string;
  title: string;
  author: string;
  authorLF?: string;
  additionalAuthors?: string;
  isbn?: string;
  isbn13?: string;
  myRating?: number;
  averageRating?: number;
  publisher?: string;
  numberOfPages?: number;
  yearPublished?: number;
  originalPublicationYear?: number;
  dateRead?: string;
  dateAdded?: string;
  bookshelves?: string[];
  exclusiveShelf?: string;
  myReview?: string;
  spoilerFlag?: boolean;
  privateNotes?: string;
  readCount?: number;
  recommendedFor?: string;
  recommendedBy?: string;
  ownedCopies?: number;
  originalPurchaseDate?: string;
  originalPurchaseLocation?: string;
  condition?: string;
  conditionDescription?: string;
  bcid?: string;
}

/**
 * Parse a Goodreads CSV file
 */
export function parseGoodreadsCSV(csvContent: string): GoodreadsBookData[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Invalid CSV file: no data rows found');
  }

  // Parse header to get column indices
  const header = parseCSVLine(lines[0]);
  const columnMap = createGoodreadsColumnMap(header);

  // Parse data rows
  const books: GoodreadsBookData[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const book = createGoodreadsBookData(values, columnMap);
    if (book) {
      books.push(book);
    }
  }

  return books;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim());

  return values;
}

/**
 * Create a column index map from header row
 */
function createGoodreadsColumnMap(header: string[]): Map<string, number> {
  const columnMap = new Map<string, number>();
  const normalizedHeaders = header.map(h => h.toLowerCase().trim());

  // Map common Goodreads CSV column names to our internal names
  const columnMappings: [string, string][] = [
    ['book id', 'bookId'],
    ['title', 'title'],
    ['author', 'author'],
    ['author l-f', 'authorLF'],
    ['additional authors', 'additionalAuthors'],
    ['isbn', 'isbn'],
    ['isbn13', 'isbn13'],
    ['my rating', 'myRating'],
    ['average rating', 'averageRating'],
    ['publisher', 'publisher'],
    ['number of pages', 'numberOfPages'],
    ['year published', 'yearPublished'],
    ['original publication year', 'originalPublicationYear'],
    ['date read', 'dateRead'],
    ['date added', 'dateAdded'],
    ['bookshelves', 'bookshelves'],
    ['exclusive shelf', 'exclusiveShelf'],
    ['my review', 'myReview'],
    ['spoiler', 'spoilerFlag'],
    ['private notes', 'privateNotes'],
    ['read count', 'readCount'],
    ['recommended for', 'recommendedFor'],
    ['recommended by', 'recommendedBy'],
    ['owned copies', 'ownedCopies'],
    ['original purchase date', 'originalPurchaseDate'],
    ['original purchase location', 'originalPurchaseLocation'],
    ['condition', 'condition'],
    ['condition description', 'conditionDescription'],
    ['bcid', 'bcid']
  ];

  columnMappings.forEach(([goodreadsName, ourName]) => {
    const index = normalizedHeaders.findIndex(h => h === goodreadsName);
    if (index !== -1) {
      columnMap.set(ourName, index);
    }
  });

  return columnMap;
}

/**
 * Create a GoodreadsBookData object from CSV values
 */
function createGoodreadsBookData(values: string[], columnMap: Map<string, number>): GoodreadsBookData | null {
  const getValue = (key: string): string | undefined => {
    const index = columnMap.get(key);
    if (index !== undefined && index < values.length) {
      return values[index] || undefined;
    }
    return undefined;
  };

  const title = getValue('title');
  if (!title) return null;

  const bookshelves = getValue('bookshelves');
  const dateRead = getValue('dateRead');
  const exclusiveShelf = getValue('exclusiveShelf');

  return {
    bookId: getValue('bookId') || '',
    title,
    author: getValue('author') || 'Unknown Author',
    authorLF: getValue('authorLF'),
    additionalAuthors: getValue('additionalAuthors'),
    isbn: cleanISBN(getValue('isbn')),
    isbn13: cleanISBN(getValue('isbn13')),
    myRating: parseGoodreadsRating(getValue('myRating')),
    averageRating: parseFloat(getValue('averageRating') || '0'),
    publisher: getValue('publisher'),
    numberOfPages: parseInt(getValue('numberOfPages') || '0', 10) || undefined,
    yearPublished: parseInt(getValue('yearPublished') || '0', 10) || undefined,
    originalPublicationYear: parseInt(getValue('originalPublicationYear') || '0', 10) || undefined,
    dateRead,
    dateAdded: getValue('dateAdded'),
    bookshelves: bookshelves ? bookshelves.split(',').map(s => s.trim()).filter(Boolean) : [],
    exclusiveShelf,
    myReview: getValue('myReview'),
    spoilerFlag: getValue('spoilerFlag')?.toLowerCase() === 'true',
    privateNotes: getValue('privateNotes'),
    readCount: parseInt(getValue('readCount') || '0', 10) || undefined,
    recommendedFor: getValue('recommendedFor'),
    recommendedBy: getValue('recommendedBy'),
    ownedCopies: parseInt(getValue('ownedCopies') || '0', 10) || undefined,
    originalPurchaseDate: getValue('originalPurchaseDate'),
    originalPurchaseLocation: getValue('originalPurchaseLocation'),
    condition: getValue('condition'),
    conditionDescription: getValue('conditionDescription'),
    bcid: getValue('bcid')
  };
}

/**
 * Clean ISBN by removing dashes and non-numeric characters
 */
function cleanISBN(isbn: string | undefined): string | undefined {
  if (!isbn) return undefined;
  return isbn.replace(/[-\s]/g, '').replace(/"/g, '');
}

/**
 * Parse Goodreads rating (can be "abandoned" or a number)
 */
function parseGoodreadsRating(rating: string | undefined): number | undefined {
  if (!rating) return undefined;
  const cleaned = rating.toLowerCase().trim();
  if (cleaned === 'abandoned' || cleaned === 'did not finish') {
    return undefined;
  }
  const parsed = parseFloat(rating);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Convert GoodreadsBookData to ImportBookData
 */
export function goodreadsToImportBook(goodreadsBook: GoodreadsBookData): ImportBookData {
  // Determine reading status
  let readingStatus: 'Want to Read' | 'Read' | 'Currently Reading' = 'Want to Read';
  if (goodreadsBook.dateRead) {
    readingStatus = 'Read';
  } else if (goodreadsBook.exclusiveShelf === 'currently-reading') {
    readingStatus = 'Currently Reading';
  }

  return {
    id: goodreadsBook.bookId || crypto.randomUUID(),
    title: goodreadsBook.title,
    author: goodreadsBook.author,
    isbn: goodreadsBook.isbn13 || goodreadsBook.isbn,
    pageCount: goodreadsBook.numberOfPages,
    publicationYear: goodreadsBook.yearPublished || goodreadsBook.originalPublicationYear,
    publisher: goodreadsBook.publisher,
    genre: goodreadsBook.bookshelves?.[0],
    language: undefined,
    rating: goodreadsBook.myRating,
    review: goodreadsBook.myReview,
    reviewCreatedAt: goodreadsBook.dateRead,
    containsSpoilers: goodreadsBook.spoilerFlag || false,
    readingStatus,
    tags: goodreadsBook.bookshelves || [],
    coverKey: undefined,
    coverFilename: undefined,
    createdAt: goodreadsBook.dateAdded || new Date().toISOString(),
    updatedAt: goodreadsBook.dateRead || new Date().toISOString(),
    categoryIds: [],
    readingSessionIds: [],
    noteId: undefined
  };
}

/**
 * Validate Goodreads CSV data
 */
export function validateGoodreadsCSV(data: GoodreadsBookData[]): {
  valid: number;
  invalid: number;
  errors: Array<{ row: number; error: string }>;
} {
  const result = {
    valid: 0,
    invalid: 0,
    errors: [] as Array<{ row: number; error: string }>
  };

  data.forEach((book, index) => {
    if (!book.title || !book.author) {
      result.invalid++;
      result.errors.push({
        row: index + 2, // +2 for header row and 0-based index
        error: 'Missing required fields: title and author are required'
      });
    } else {
      result.valid++;
    }
  });

  return result;
}
