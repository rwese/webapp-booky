import type { Book, Rating, ReadingLog, Collection, Tag } from '../types';
import { bookOperations, ratingOperations, readingLogOperations, collectionOperations, tagOperations } from './db';

/**
 * Export format types
 */
export type ExportFormat = 'json' | 'csv' | 'bibtex' | 'marc';

/**
 * Export options for filtering and formatting
 */
export interface ExportOptions {
  format: ExportFormat;
  collectionId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeRatings?: boolean;
  includeReadingLogs?: boolean;
  includeCollections?: boolean;
  includeTags?: boolean;
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  exportedAt: string;
  source: 'book-collection-webapp';
  version: string;
  format: ExportFormat;
  totalBooks: number;
  options: Partial<ExportOptions>;
}

/**
 * Main export service class
 */
class BookExportService {
  private readonly EXPORT_VERSION = '1.0';

  /**
   * Export books in the specified format
   */
  async exportBooks(options: ExportOptions): Promise<{
    data: string;
    metadata: ExportMetadata;
    filename: string;
  }> {
    const books = await this.getBooksForExport(options);
    const ratings = options.includeRatings ? await this.getRatingsForBooks(books) : new Map();
    const readingLogs = options.includeReadingLogs ? await this.getReadingLogsForBooks(books) : new Map();
    const collections = options.includeCollections ? await this.getCollectionsForBooks(books) : [];
    const tags = options.includeTags ? await this.getTagsForBooks(books) : [];

    const metadata: ExportMetadata = {
      exportedAt: new Date().toISOString(),
      source: 'book-collection-webapp',
      version: this.EXPORT_VERSION,
      format: options.format,
      totalBooks: books.length,
      options: {
        collectionId: options.collectionId,
        dateRange: options.dateRange,
        includeRatings: options.includeRatings,
        includeReadingLogs: options.includeReadingLogs,
        includeCollections: options.includeCollections,
        includeTags: options.includeTags
      }
    };

    let data: string;
    switch (options.format) {
      case 'json':
        data = this.exportToJSON(books, ratings, readingLogs, collections, tags, metadata);
        break;
      case 'csv':
        data = this.exportToCSV(books, ratings, readingLogs);
        break;
      case 'bibtex':
        data = this.exportToBibTeX(books, ratings);
        break;
      case 'marc':
        data = this.exportToMARC(books, ratings);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    const filename = this.generateFilename(options.format, metadata.exportedAt);

    return { data, metadata, filename };
  }

  /**
   * Get books based on export options
   */
  private async getBooksForExport(options: ExportOptions): Promise<Book[]> {
    let books: Book[] = [];

    if (options.collectionId) {
      // Get books in a specific collection
      books = await collectionOperations.getBooksInCollection(options.collectionId) as Book[];
    } else {
      // Get all books
      books = await bookOperations.getAll();
    }

    // Filter by date range if specified
    if (options.dateRange) {
      books = books.filter(book => {
        const addedAt = new Date(book.addedAt);
        return addedAt >= options.dateRange!.start && addedAt <= options.dateRange!.end;
      });
    }

    return books;
  }

  /**
   * Get ratings for books
   */
  private async getRatingsForBooks(books: Book[]): Promise<Map<string, Rating>> {
    const ratings = new Map<string, Rating>();
    for (const book of books) {
      const rating = await ratingOperations.getByBookId(book.id);
      if (rating) {
        ratings.set(book.id, rating);
      }
    }
    return ratings;
  }

  /**
   * Get reading logs for books
   */
  private async getReadingLogsForBooks(books: Book[]): Promise<Map<string, ReadingLog>> {
    const logs = new Map<string, ReadingLog>();
    for (const book of books) {
      const log = await readingLogOperations.getByBookId(book.id);
      if (log) {
        logs.set(book.id, log);
      }
    }
    return logs;
  }

  /**
   * Get collections for books
   */
  private async getCollectionsForBooks(books: Book[]): Promise<Collection[]> {
    const allCollections = await collectionOperations.getAll();
    const bookIds = new Set(books.map(b => b.id));
    
    // Filter collections that contain any of the books being exported
    const collectionsWithBooks = await Promise.all(
      allCollections.map(async (collection) => {
        const collectionBooks = await collectionOperations.getBooksInCollection(collection.id);
        const hasMatchingBooks = collectionBooks.some((cb: Book | undefined) => cb && bookIds.has(cb.id));
        return hasMatchingBooks ? collection : null;
      })
    );
    
    return collectionsWithBooks.filter((c): c is Collection => c !== null);
  }

  /**
   * Get tags for books
   */
  private async getTagsForBooks(_books: Book[]): Promise<Tag[]> {
    const allTags = await tagOperations.getAll();
    // Filter tags that are used by the books being exported
    return allTags;
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(
    books: Book[],
    ratings: Map<string, Rating>,
    readingLogs: Map<string, ReadingLog>,
    collections: Collection[],
    tags: Tag[],
    metadata: ExportMetadata
  ): string {
    const exportData = {
      metadata,
      books: books.map(book => ({
        ...book,
        rating: ratings.get(book.id),
        readingLog: readingLogs.get(book.id)
      })),
      collections: collections.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        isSmart: c.isSmart,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })),
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(books: Book[], ratings: Map<string, Rating>, readingLogs: Map<string, ReadingLog>): string {
    const headers = [
      'Title',
      'Author',
      'ISBN',
      'Format',
      'Publisher',
      'Published Year',
      'Page Count',
      'Rating',
      'Reading Status',
      'Date Added',
      'Description',
      'Tags',
      'Series',
      'Series Volume'
    ];

    const rows = books.map(book => {
      const rating = ratings.get(book.id);
      const readingLog = readingLogs.get(book.id);
      
      return [
        this.escapeCSV(book.title),
        this.escapeCSV(book.authors.join(', ')),
        book.isbn13 || '',
        book.format,
        this.escapeCSV(book.publisher || ''),
        book.publishedYear?.toString() || '',
        book.pageCount?.toString() || '',
        rating?.stars?.toString() || '',
        readingLog?.status || '',
        book.addedAt instanceof Date ? book.addedAt.toISOString().split('T')[0] : '',
        this.escapeCSV((book.description || '').substring(0, 500)),
        (book.tags || []).join('; '),
        book.seriesName || '',
        book.seriesVolume?.toString() || ''
      ];
    });

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Escape special characters for CSV
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export to BibTeX format
   */
  private exportToBibTeX(books: Book[], ratings: Map<string, Rating>): string {
    const entries = books.map(book => {
      const rating = ratings.get(book.id);
      const citationKey = this.generateCitationKey(book);
      const type = this.mapFormatToBibTeXType(book.format);
      
      const fields: string[] = [];
      
      if (book.title) fields.push(`  title = {${this.escapeBibTeX(book.title)}}`);
      if (book.authors.length > 0) fields.push(`  author = {${this.escapeBibTeX(book.authors.join(' and '))}}`);
      if (book.isbn13) fields.push(`  isbn = {${book.isbn13}}`);
      if (book.publisher) fields.push(`  publisher = {${this.escapeBibTeX(book.publisher)}}`);
      if (book.publishedYear) fields.push(`  year = {${book.publishedYear}}`);
      if (book.pageCount) fields.push(`  pages = {${book.pageCount}}`);
      if (book.seriesName) {
        fields.push(`  series = {${this.escapeBibTeX(book.seriesName)}}`);
        if (book.seriesVolume) fields.push(`  volume = {${book.seriesVolume}}`);
      }
      if (rating && rating.stars) fields.push(`  rating = {${rating.stars}}`);
      if (book.description) {
        const desc = book.description.replace(/[\n\r]/g, ' ').trim();
        fields.push(`  abstract = {${this.escapeBibTeX(desc.substring(0, 500))}}`);
      }

      return `@${type}{${citationKey},
${fields.join(',\n')}
}`;
    });

    return `% BibTeX Export from Book Collection Webapp
% Generated: ${new Date().toISOString()}
% Total entries: ${books.length}

${entries.join('\n\n')}`;
  }

  /**
   * Escape special characters for BibTeX
   */
  private escapeBibTeX(value: string): string {
    return value
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\^/g, '\\^')
      .replace(/~/g, '\\~{}');
  }

  /**
   * Map book format to BibTeX entry type
   */
  private mapFormatToBibTeXType(format: Book['format']): string {
    switch (format) {
      case 'audiobook':
      case 'audible':
        return 'audio';
      case 'kindle':
      case 'kobo':
      case 'pdf':
        return 'electronic';
      case 'physical':
      default:
        return 'book';
    }
  }

  /**
   * Generate a unique citation key for BibTeX
   */
  private generateCitationKey(book: Book): string {
    const author = book.authors[0]?.split(' ').pop()?.toLowerCase() || 'unknown';
    const title = book.title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const year = book.publishedYear || new Date().getFullYear();
    return `${author}${title}${year}`;
  }

  /**
   * Export to MARC21 format
   */
  private exportToMARC(books: Book[], ratings: Map<string, Rating>): string {
    const records = books.map(book => {
      const rating = ratings.get(book.id);
      return this.createMARCRecord(book, rating);
    });

    return `% MARC21 Export from Book Collection Webapp
% Generated: ${new Date().toISOString()}
% Total records: ${books.length}

${records.join('\n')}`;
  }

  /**
   * Create a single MARC21 record
   */
  private createMARCRecord(book: Book, rating?: Rating): string {
    const leader = '00000nam a2200000   4500';
    const fields: string[] = [];

    // Leader
    fields.push(leader);

    // 008 - Fixed-length data elements
    const pubDate = book.publishedYear?.toString().padStart(4, ' ') || '    ';
    const lang = book.languageCode || 'eng';
    const _008 = `008${pubDate}||${' '.repeat(6)}||${lang}${' '.repeat(14)}`;
    fields.push(this.formatMARCField('008', null, null, _008));

    // 020 - ISBN
    if (book.isbn13) {
      fields.push(this.formatMARCField('020', null, null, `$a${book.isbn13}`));
    }

    // 050 - LC Call Number (using Dewey as proxy)
    if (book.deweyDecimal) {
      fields.push(this.formatMARCField('050', null, null, `$a${book.deweyDecimal}`));
    }

    // 082 - Dewey Decimal Classification
    if (book.deweyDecimal) {
      fields.push(this.formatMARCField('082', null, null, `$a${book.deweyDecimal}`));
    }

    // 100 - Main Entry - Personal Name
    if (book.authors.length > 0) {
      fields.push(this.formatMARCField('100', '1', '0', `$a${book.authors[0]}`));
    }

    // 245 - Title Statement
    const titleField = book.subtitle 
      ? `$a${book.title} :$b${book.subtitle}`
      : `$a${book.title}`;
    fields.push(this.formatMARCField('245', '1', '0', titleField));

    // 250 - Edition
    if (book.edition) {
      fields.push(this.formatMARCField('250', null, null, `$a${book.edition}`));
    }

    // 260 - Publication Info
    let pubInfo = '';
    if (book.publisher) pubInfo += `$b${book.publisher}`;
    if (book.publishedYear) pubInfo += `$c${book.publishedYear}`;
    if (pubInfo) {
      fields.push(this.formatMARCField('260', null, null, pubInfo));
    }

    // 300 - Physical Description
    let physDesc = '';
    if (book.pageCount) physDesc += `$a${book.pageCount} p.`;
    if (book.dimensions?.thickness) physDesc += `$c${book.dimensions.thickness}`;
    if (physDesc) {
      fields.push(this.formatMARCField('300', null, null, physDesc));
    }

    // 490 - Series Statement
    if (book.seriesName) {
      let seriesField = `$a${book.seriesName}`;
      if (book.seriesVolume) seriesField += ` ;v. ${book.seriesVolume}`;
      fields.push(this.formatMARCField('490', '1', '0', seriesField));
    }

    // 600 - Subject - Personal Name
    if (book.authors.length > 0) {
      fields.push(this.formatMARCField('600', '1', '0', `$a${book.authors[0]}`));
    }

    // 650 - Subject - Topical
    if (book.categories && book.categories.length > 0) {
      for (const cat of book.categories.slice(0, 3)) {
        fields.push(this.formatMARCField('650', null, '0', `$a${cat}`));
      }
    }

    // 700 - Added Entry - Personal Name
    for (let i = 1; i < book.authors.length; i++) {
      fields.push(this.formatMARCField('700', '1', '', `$a${book.authors[i]}`));
    }

    // 856 - Electronic Location
    if (book.previewLink) {
      fields.push(this.formatMARCField('856', '4', '0', `$u${book.previewLink}`));
    }

    // 999 - Local field for rating
    if (rating && rating.stars) {
      fields.push(this.formatMARCField('999', null, null, `$aRating: ${rating.stars}/5`));
    }

    return fields.join('\n');
  }

  /**
   * Format a MARC field
   */
  private formatMARCField(tag: string, ind1?: string | null, ind2?: string | null, content?: string): string {
    const i1 = ind1 !== undefined && ind1 !== null ? ind1 : ' ';
    const i2 = ind2 !== undefined && ind2 !== null ? ind2 : ' ';
    const fieldContent = content || '';
    
    if (fieldContent.length > 0) {
      // For content with indicators, properly format
      if (tag === '008') {
        return `${tag}${fieldContent.substring(3)}`;
      }
      return `${tag} ${i1}${i2}${fieldContent}`;
    }
    
    return `${tag} ${i1}${i2}`;
  }

  /**
   * Generate export filename
   */
  private generateFilename(format: ExportFormat, timestamp: string): string {
    const date = timestamp.split('T')[0];
    switch (format) {
      case 'json':
        return `book-collection-${date}.json`;
      case 'csv':
        return `book-collection-${date}.csv`;
      case 'bibtex':
        return `book-collection-${date}.bib`;
      case 'marc':
        return `book-collection-${date}.marc`;
      default:
        return `book-collection-${date}.txt`;
    }
  }
}

// Singleton instance
export const bookExportService = new BookExportService();

/**
 * Helper function to trigger download
 */
export function downloadExportedData(data: string, filename: string): void {
  const mimeTypes: Record<ExportFormat, string> = {
    json: 'application/json',
    csv: 'text/csv',
    bibtex: 'application/x-bibtex',
    marc: 'application/marc'
  };

  const extension = filename.split('.').pop() || 'txt';
  const format = extension as ExportFormat;
  const mimeType = mimeTypes[format] || 'text/plain';

  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get available export formats
 */
export function getExportFormats(): { value: ExportFormat; label: string; description: string }[] {
  return [
    { value: 'json', label: 'JSON', description: 'Full export with all data' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet compatible format' },
    { value: 'bibtex', label: 'BibTeX', description: 'Academic citation format' },
    { value: 'marc', label: 'MARC21', description: 'Library catalog format' }
  ];
}
