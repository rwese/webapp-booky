import type { 
  Book, 
  Rating, 
  ReadingLog,
  ReadingStatus,
  ImportBookData,
  Tag
} from '../types';
import { bookOperations, tagOperations } from './db';

// Author extraction utilities
export function extractAuthorName(authorInput: string): string {
  // Handle Open Library URLs like "/authors/OL2790841A"
  if (authorInput.startsWith('/authors/OL')) {
    const parts = authorInput.split('/');
    return parts[parts.length - 1]; // Return the OL ID, we'll need to look up the name
  }
  // Return as-is if it's a regular name
  return authorInput;
}

export function normalizeAuthorForImport(authorInput: string): string {
  // Remove any extra whitespace and normalize
  return authorInput.trim();
}

// Cover image path utilities
export function generateLocalCoverPath(originalFilename: string, bookId: string): string {
  // Generate unique filename to avoid collisions
  const extension = getFileExtension(originalFilename);
  const timestamp = Date.now();
  return `covers/${bookId}_${timestamp}${extension}`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '.jpg';
}

// Reading status mapping
export function mapReadingStatus(importStatus: 'Want to Read' | 'Read' | 'Currently Reading'): ReadingStatus {
  const statusMap: Record<string, ReadingStatus> = {
    'Want to Read': 'want_to_read',
    'Read': 'read',
    'Currently Reading': 'currently_reading'
  };
  return statusMap[importStatus] || 'want_to_read';
}

export function getReadingStatusFromImport(importStatus: string): ReadingStatus {
  return mapReadingStatus(importStatus as 'Want to Read' | 'Read' | 'Currently Reading');
}

// ISBN source mapping
export function mapIsbnSource(isbnSource?: string): { openLibrary?: string; googleBooks?: string } {
  if (!isbnSource) return {};
  
  if (isbnSource.toLowerCase().includes('open library')) {
    return { openLibrary: 'imported' };
  } else if (isbnSource.toLowerCase().includes('google')) {
    return { googleBooks: 'imported' };
  }
  
  return {};
}

// Transform import book data to our Book model
export function transformBookData(importBook: ImportBookData): Partial<Book> {
  const authors = [normalizeAuthorForImport(extractAuthorName(importBook.author))];
  
  return {
    title: importBook.title.trim(),
    authors,
    isbn13: importBook.isbn, // Use import ISBN as ISBN-13
    pageCount: importBook.pageCount,
    publishedYear: importBook.publicationYear,
    publisher: importBook.publisher?.trim(),
    format: 'physical', // Default format for imported books
    addedAt: new Date(),
    externalIds: {},
    needsSync: false,
    localOnly: true,
    genre: importBook.genre,
    language: importBook.language,
    localCoverPath: importBook.coverFilename ? generateLocalCoverPath(importBook.coverFilename, importBook.id) : undefined
  };
}

// Generate unique ID for book (avoiding conflicts with existing books)
export function generateImportBookId(originalId: string): string {
  return `import_${originalId}`;
}

// Check if book already exists by ISBN
export async function bookExistsByIsbn(isbn?: string): Promise<boolean> {
  if (!isbn) return false;
  const existingBook = await bookOperations.getByIsbn(isbn);
  return !!existingBook;
}

// Check if book already exists by title and author
export async function bookExistsByTitleAuthor(title: string, author: string): Promise<boolean> {
  const books = await bookOperations.getAll();
  return books.some(book => 
    book.title.toLowerCase() === title.toLowerCase() &&
    book.authors.some(a => a.toLowerCase() === author.toLowerCase())
  );
}

// Create Rating entry from import data
export function createRatingFromImport(bookId: string, importBook: ImportBookData): Omit<Rating, 'id'> | null {
  // Validate rating is defined and within valid range (0.5 to 5.0 in 0.5 increments)
  if (importBook.rating === undefined || 
      importBook.rating < 0.5 || 
      importBook.rating > 5.0 ||
      Math.round(importBook.rating * 2) / 2 !== importBook.rating) {
    return null;
  }

  return {
    bookId,
    stars: importBook.rating,
    updatedAt: new Date(),
    containsSpoilers: false
  };
}

// Create ReadingLog entry from import data
export function createReadingLogFromImport(bookId: string, importBook: ImportBookData): Omit<ReadingLog, 'id'> {
  const status = getReadingStatusFromImport(importBook.readingStatus);
  const now = new Date();
  
  const readingLog: Omit<ReadingLog, 'id'> = {
    bookId,
    status,
    createdAt: now,
    updatedAt: now
  };

  // Set appropriate dates based on status
  if (importBook.readingStatus === 'Read' && importBook.updatedAt) {
    readingLog.startedAt = new Date(importBook.createdAt);
    readingLog.finishedAt = new Date(importBook.updatedAt);
  } else if (importBook.readingStatus === 'Currently Reading') {
    readingLog.startedAt = new Date(importBook.createdAt);
  }

  return readingLog;
}

// Process tags from import data
export async function processTagsForImport(bookId: string, tagNames: string[]): Promise<void> {
  for (const tagName of tagNames) {
    const normalizedName = tagName.trim();
    if (!normalizedName) continue;

    // Check if tag exists
    let existingTag = await tagOperations.getAll().then(tags => 
      tags.find(t => t.name.toLowerCase() === normalizedName.toLowerCase())
    );

    // Create tag if it doesn't exist
    if (!existingTag) {
      const tagId = crypto.randomUUID();
      const newTag: Tag = {
        id: tagId,
        name: normalizedName,
        createdAt: new Date()
      };
      await tagOperations.add(newTag);
      existingTag = newTag;
    }

    // Create BookTag association
    await tagOperations.addTagToBook(bookId, existingTag.id);
  }
}

// Validate import book data
export function validateImportBook(importBook: ImportBookData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!importBook.title || importBook.title.trim().length === 0) {
    errors.push('Missing title');
  }

  if (!importBook.author || importBook.author.trim().length === 0) {
    errors.push('Missing author');
  }

  // Validate ISBN format if provided
  if (importBook.isbn) {
    const cleanIsbn = importBook.isbn.replace(/[-\s]/g, '');
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
      errors.push('Invalid ISBN format');
    }
  }

  // Validate rating if provided (supports 0.5 to 5.0 in 0.5 increments)
  if (importBook.rating !== undefined) {
    const isValidRating = importBook.rating >= 0.5 && 
                          importBook.rating <= 5.0 && 
                          Math.round(importBook.rating * 2) / 2 === importBook.rating;
    if (!isValidRating) {
      errors.push('Rating must be between 0.5 and 5.0 in 0.5 increments');
    }
  }

  // Validate reading status
  const validStatuses = ['Want to Read', 'Read', 'Currently Reading'];
  if (importBook.readingStatus && !validStatuses.includes(importBook.readingStatus)) {
    errors.push('Invalid reading status');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Main transformation function for a complete book import
export interface TransformedImportBook {
  book: Partial<Book>;
  rating?: Omit<Rating, 'id'>;
  readingLog: Omit<ReadingLog, 'id'>;
  tags: string[];
  originalData: ImportBookData;
  errors: string[];
  shouldSkip: boolean;
  skipReason?: string;
}

export function transformImportBook(importBook: ImportBookData): TransformedImportBook {
  const errors: string[] = [];
  let shouldSkip = false;
  let skipReason: string | undefined;

  // Validate the book data
  const validation = validateImportBook(importBook);
  if (!validation.valid) {
    errors.push(...validation.errors);
  }

  // Transform to our book model
  const book = transformBookData(importBook);

  // Create rating entry
  const rating = createRatingFromImport('', importBook);

  // Create reading log entry
  const readingLog = createReadingLogFromImport('', importBook);

  return {
    book,
    rating: rating || undefined,
    readingLog,
    tags: importBook.tags,
    originalData: importBook,
    errors,
    shouldSkip,
    skipReason
  };
}

// Utility to format import status for display
export function formatImportStatus(status: 'Want to Read' | 'Read' | 'Currently Reading'): string {
  const statusMap: Record<string, string> = {
    'Want to Read': 'Want to Read',
    'Read': 'Read',
    'Currently Reading': 'Currently Reading'
  };
  return statusMap[status] || 'Unknown';
}

// Utility to format rating for display
export function formatRatingForDisplay(rating?: number): string {
  if (!rating) return 'Not rated';
  return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
}
