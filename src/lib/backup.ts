/**
 * Backup Service
 * Handles export and import of library data in BookNotes format
 */

import JSZip from 'jszip';
import { db } from './db';
import type { Book, Tag, Collection, ReadingLog, ReadingStatus } from '../types';
import type { ExportData, ImportResult, ImportOptions } from '../types/backup';
import type { ExportBook as ExportBookType } from '../types/backup';

const APP_VERSION = '1.0.0';

/**
 * Transform internal Book to ExportBook format
 */
export function transformBookToExport(book: Book): ExportBookType {
  return {
    id: book.id,
    title: book.title,
    author: book.authors[0] || 'Unknown Author',
    isbn: book.isbn13,
    genre: book.genre,
    pageCount: book.pageCount,
    publicationYear: book.publishedYear,
    readingStatus: mapReadingStatus(book.readingStatus),
    rating: book.averageRating,
    tags: book.tags || [],
    categoryIds: [],
    createdAt: book.addedAt instanceof Date ? book.addedAt.toISOString() : book.addedAt,
    updatedAt: book.updatedAt instanceof Date ? book.updatedAt.toISOString() : new Date().toISOString(),
    coverKey: book.localCoverPath ? book.id : null,
    coverFilename: book.localCoverPath ? extractFilename(book.localCoverPath) : null
  };
}

/**
 * Transform ExportBook to internal Book format
 */
export function transformExportToBook(exportBook: ExportBookType): Partial<Book> {
  return {
    id: exportBook.id,
    title: exportBook.title,
    authors: [exportBook.author],
    isbn13: exportBook.isbn,
    genre: exportBook.genre,
    pageCount: exportBook.pageCount,
    publishedYear: exportBook.publicationYear,
    readingStatus: mapFromExportStatus(exportBook.readingStatus),
    averageRating: exportBook.rating,
    tags: exportBook.tags,
    addedAt: new Date(exportBook.createdAt),
    updatedAt: new Date(exportBook.updatedAt),
    format: 'physical',
    localCoverPath: exportBook.coverFilename || undefined,
    needsSync: false,
    localOnly: true,
    externalIds: {}
  };
}

/**
 * Export all library data to a ZIP file
 */
export async function exportBackup(): Promise<{
  data: Blob;
  filename: string;
}> {
  const books = await db.books.toArray();
  const tags = await db.tags.toArray();
  const collections = await db.collections.toArray();
  const readingLogs = await db.readingLogs.toArray();

  // Transform books to export format
  const exportBooks: ExportBookType[] = books.map(transformBookToExport);

  // Create cover mapping
  const coverMapping: Record<string, string> = {};
  books.forEach(book => {
    if (book.localCoverPath) {
      coverMapping[book.id] = extractFilename(book.localCoverPath);
    }
  });

  // Build export data
  const exportData: ExportData = {
    appVersion: APP_VERSION,
    books: exportBooks,
    coverMapping,
    totalBooks: books.length,
    booksWithCovers: Object.keys(coverMapping).length,
    exportedAt: new Date().toISOString()
  };

  // Create ZIP file
  const zip = new JSZip();

  // Add metadata.json
  zip.file('metadata.json', JSON.stringify(exportData, null, 2));

  // Add cover images folder
  const coverImagesFolder = zip.folder('cover_images');
  if (coverImagesFolder) {
    for (const book of books) {
      if (book.localCoverPath) {
        try {
          // Get the cover blob from IndexedDB
          const coverBlob = await db.coverImages.get(book.id);
          if (coverBlob) {
            const filename = extractFilename(book.localCoverPath);
            coverImagesFolder.file(filename, coverBlob.blob);
          }
        } catch (error) {
          console.warn(`Could not add cover for book ${book.id}:`, error);
        }
      }
    }
  }

  // Add tags and collections as separate JSON files
  const tagsData = {
    tags: tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.createdAt instanceof Date ? tag.createdAt.toISOString() : tag.createdAt
    }))
  };
  zip.file('tags.json', JSON.stringify(tagsData, null, 2));

  const collectionsData = {
    collections: collections.map(col => ({
      id: col.id,
      name: col.name,
      description: col.description,
      coverImage: col.coverImage,
      isSmart: col.isSmart,
      smartRules: col.smartRules,
      createdAt: col.createdAt instanceof Date ? col.createdAt.toISOString() : col.createdAt,
      updatedAt: col.updatedAt instanceof Date ? col.updatedAt.toISOString() : col.updatedAt
    }))
  };
  zip.file('collections.json', JSON.stringify(collectionsData, null, 2));

  const readingLogsData = {
    readingLogs: readingLogs.map(log => ({
      id: log.id,
      bookId: log.bookId,
      status: log.status,
      startedAt: log.startedAt instanceof Date ? log.startedAt.toISOString() : log.startedAt,
      finishedAt: log.finishedAt instanceof Date ? log.finishedAt.toISOString() : log.finishedAt,
      dnfReason: log.dnfReason,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
      updatedAt: log.updatedAt instanceof Date ? log.updatedAt.toISOString() : log.updatedAt
    }))
  };
  zip.file('reading_logs.json', JSON.stringify(readingLogsData, null, 2));

  // Generate the ZIP blob
  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `booknotes-backup-${new Date().toISOString().split('T')[0]}.zip`;

  return { data: blob, filename };
}

/**
 * Import library data from a ZIP file
 */
export async function importBackup(
  file: File,
  options?: ImportOptions
): Promise<ImportResult> {
  const { skipDuplicates = true, includeCovers = true } = options || {};

  try {
    // Load the ZIP file
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // Read metadata.json
    const metadataFile = zipContent.file('metadata.json');
    if (!metadataFile) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        failed: 1,
        errors: [{ bookId: 'unknown', title: 'Unknown', error: 'metadata.json not found in ZIP file' }]
      };
    }

    const metadataJson = await metadataFile.async('string');
    const exportData: ExportData = JSON.parse(metadataJson);

    // Extract cover images
    const coverImages = new Map<string, Blob>();
    if (includeCovers) {
      const coverFiles = Object.keys(zipContent.files).filter(
        path => path.startsWith('cover_images/') && !zipContent.files[path].dir
      );

      for (const path of coverFiles) {
        const fileData = zipContent.file(path);
        if (fileData) {
          const blob = await fileData.async('blob');
          const filename = path.replace('cover_images/', '');
          coverImages.set(filename, blob);
        }
      }
    }

    // Import books
    const errors: Array<{ bookId: string; title: string; error: string }> = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const exportBook of exportData.books) {
      try {
        // Check for duplicates
        if (skipDuplicates) {
          const existingBook = await checkBookExists(exportBook);
          if (existingBook) {
            skipped++;
            continue;
          }
        }

        // Transform and add the book
        const bookData = transformExportToBook(exportBook);
        const newBookId = exportBook.id;

        await db.books.add({
          ...bookData,
          id: newBookId
        } as Book);

        // Store cover image if available
        if (includeCovers && exportBook.coverFilename) {
          const coverBlob = coverImages.get(exportBook.coverFilename);
          if (coverBlob) {
            await db.coverImages.put({
              id: newBookId,
              blob: coverBlob,
              mimeType: coverBlob.type || 'image/jpeg',
              createdAt: new Date()
            });
          }
        }

        imported++;
      } catch (error) {
        failed++;
        errors.push({
          bookId: exportBook.id,
          title: exportBook.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Import tags if available
    const tagsFile = zipContent.file('tags.json');
    if (tagsFile) {
      try {
        const tagsJson = await tagsFile.async('string');
        const tagsData = JSON.parse(tagsJson);
        if (tagsData.tags && Array.isArray(tagsData.tags)) {
          for (const tag of tagsData.tags) {
            try {
              await db.tags.put({
                id: tag.id,
                name: tag.name,
                createdAt: new Date(tag.createdAt)
              } as Tag);
            } catch (error) {
              console.warn(`Failed to import tag ${tag.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to import tags:', error);
      }
    }

    // Import collections if available
    const collectionsFile = zipContent.file('collections.json');
    if (collectionsFile) {
      try {
        const collectionsJson = await collectionsFile.async('string');
        const collectionsData = JSON.parse(collectionsJson);
        if (collectionsData.collections && Array.isArray(collectionsData.collections)) {
          for (const collection of collectionsData.collections) {
            try {
              await db.collections.put({
                id: collection.id,
                name: collection.name,
                description: collection.description,
                coverImage: collection.coverImage,
                isSmart: collection.isSmart,
                smartRules: collection.smartRules,
                createdAt: new Date(collection.createdAt),
                updatedAt: new Date(collection.updatedAt)
              } as Collection);
            } catch (error) {
              console.warn(`Failed to import collection ${collection.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to import collections:', error);
      }
    }

    // Import reading logs if available
    const readingLogsFile = zipContent.file('reading_logs.json');
    if (readingLogsFile) {
      try {
        const readingLogsJson = await readingLogsFile.async('string');
        const readingLogsData = JSON.parse(readingLogsJson);
        if (readingLogsData.readingLogs && Array.isArray(readingLogsData.readingLogs)) {
          for (const log of readingLogsData.readingLogs) {
            try {
              await db.readingLogs.put({
                id: log.id,
                bookId: log.bookId,
                status: log.status,
                startedAt: log.startedAt ? new Date(log.startedAt) : undefined,
                finishedAt: log.finishedAt ? new Date(log.finishedAt) : undefined,
                dnfReason: log.dnfReason,
                createdAt: new Date(log.createdAt),
                updatedAt: new Date(log.updatedAt)
              } as ReadingLog);
            } catch (error) {
              console.warn(`Failed to import reading log ${log.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to import reading logs:', error);
      }
    }

    return {
      success: failed === 0,
      imported,
      skipped,
      failed,
      errors
    };
  } catch (error) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: 1,
      errors: [{
        bookId: 'unknown',
        title: 'Unknown',
        error: error instanceof Error ? error.message : 'Failed to parse ZIP file'
      }]
    };
  }
}

/**
 * Check if a book already exists (by ISBN or title+author)
 */
async function checkBookExists(exportBook: ExportBookType): Promise<boolean> {
  // Check by ISBN
  if (exportBook.isbn) {
    const existingByIsbn = await db.books.where('isbn13').equals(exportBook.isbn).first();
    if (existingByIsbn) return true;
  }

  // Check by title and author
  const existingByTitleAuthor = await db.books
    .where('title')
    .equals(exportBook.title)
    .filter(book => book.authors[0]?.toLowerCase() === exportBook.author.toLowerCase())
    .first();

  return !!existingByTitleAuthor;
}

/**
 * Helper function to extract filename from path
 */
function extractFilename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/**
 * Map internal reading status to export format
 */
function mapReadingStatus(status?: string): 'wantToRead' | 'reading' | 'read' | 'didNotFinish' {
  switch (status) {
    case 'currently_reading':
      return 'reading';
    case 'want_to_read':
      return 'wantToRead';
    case 'dnf':
      return 'didNotFinish';
    case 'read':
      return 'read';
    default:
      return 'wantToRead';
  }
}

/**
 * Map export reading status to internal format
 */
function mapFromExportStatus(status: 'wantToRead' | 'reading' | 'read' | 'didNotFinish'): ReadingStatus {
  switch (status) {
    case 'reading':
      return 'currently_reading';
    case 'wantToRead':
      return 'want_to_read';
    case 'didNotFinish':
      return 'dnf';
    case 'read':
      return 'read';
    default:
      return 'want_to_read';
  }
}
