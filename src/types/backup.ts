/**
 * Export Schema Types (BookNotes Format)
 * Based on export-metadata-schema.json from BookNotes
 */

/**
 * Export metadata containing all book data and cover image mappings
 */
export interface ExportData {
  /** Version of the app that created the export */
  appVersion: string;
  /** Array of exported books */
  books: ExportBook[];
  /** Mapping of book IDs to cover image filenames */
  coverMapping: Record<string, string>;
  /** Total number of books in the export */
  totalBooks: number;
  /** Number of books that have cover images */
  booksWithCovers: number;
  /** ISO timestamp when the export was created */
  exportedAt: string;
}

/**
 * Individual book data in the export format
 */
export interface ExportBook {
  /** Unique identifier for the book */
  id: string;
  /** Book title */
  title: string;
  /** Author name */
  author: string;
  /** ISBN (optional) */
  isbn?: string;
  /** Genre/category (optional) */
  genre?: string;
  /** Page count (optional) */
  pageCount?: number;
  /** Publication year (optional) */
  publicationYear?: number;
  /** Reading status */
  readingStatus: 'wantToRead' | 'reading' | 'read' | 'didNotFinish';
  /** User rating 0-5 (optional) */
  rating?: number;
  /** Tags applied to the book */
  tags: string[];
  /** Collection IDs the book belongs to */
  categoryIds: string[];
  /** ISO timestamp when the book was added */
  createdAt: string;
  /** ISO timestamp when the book was last updated */
  updatedAt: string;
  /** Cover image key (optional) */
  coverKey: string | null;
  /** Cover image filename (optional) */
  coverFilename: string | null;
}

/**
 * Import result summary
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** Number of books imported */
  imported: number;
  /** Number of books skipped (duplicates) */
  skipped: number;
  /** Number of books that failed to import */
  failed: number;
  /** Array of errors encountered during import */
  errors: Array<{
    bookId: string;
    title: string;
    error: string;
  }>;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Skip books that already exist (by ISBN or title+author) */
  skipDuplicates?: boolean;
  /** Whether to import cover images */
  includeCovers?: boolean;
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format (currently only 'booknotes' supported) */
  format?: 'booknotes';
  /** Optional filter by collection ID */
  collectionId?: string;
  /** Optional date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };
}
