import type { OpenLibraryBook, GoogleBooksVolume, Book, BookFormat, CoverImageCandidate, CoverSize } from '../types';
import { validateISBN } from './barcodeUtils';

const OPEN_LIBRARY_API = 'https://openlibrary.org';
const GOOGLE_BOOKS_API_KEY = import.meta.env.GOOGLE_BOOKS_API_KEY;
const GOOGLE_BOOKS_API_BASE = 'https://www.googleapis.com/books/v1';
const BACKEND_API = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

// Additional ISBN lookup sources configuration
export const isbnLookupSources = {
  openLibrary: {
    name: 'Open Library',
    enabled: true,
    baseUrl: OPEN_LIBRARY_API,
    priority: 1
  },
  googleBooks: {
    name: 'Google Books',
    enabled: true,
    baseUrl: 'https://www.googleapis.com/books/v1',
    backendProxy: true,
    priority: 2
  }
};

// Search Open Library
export async function searchOpenLibrary(query: string): Promise<Book[]> {
  try {
    const response = await fetch(
      `${OPEN_LIBRARY_API}/search.json?q=${encodeURIComponent(query)}&limit=20&fields=key,title,author_name,isbn,first_publish_year,cover_i,number_of_pages_median,publisher,subject,oclc_number,lccn,dewey_number,publish_date`
    );
    
    if (!response.ok) {
      throw new Error('Open Library search failed');
    }
    
    const data = await response.json();
    
    return data.docs.map((book: OpenLibraryBook) => ({
      id: crypto.randomUUID(),
      title: book.title,
      subtitle: book.subtitle,
      authors: book.author_name || [],
      isbn13: book.isbn?.[1], // Use ISBN-13 as canonical field
      coverUrl: book.cover_i 
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : undefined,
      publishedYear: book.first_publish_year,
      publishedDate: book.publish_date,
      pageCount: book.number_of_pages_median,
      publisher: book.publisher?.[0],
      subjects: book.subject || [],
      externalIds: {
        openLibrary: book.key,
        oclcNumber: book.oclc_number?.[0],
        lccn: book.lccn?.[0],
        deweyDecimal: book.dewey_number?.[0],
      },
      format: 'physical' as BookFormat,
      addedAt: new Date(),
      needsSync: true,
      localOnly: true
    }));
  } catch (error) {
    console.error('Open Library search error:', error);
    throw error;
  }
}

// Type definitions for API responses
interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

// Helper function to safely parse JSON with content-type checking
// Using any because API responses have dynamic structures that vary by endpoint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeJsonParse(response: Response): Promise<FetchResult<any>> {
  const contentType = response.headers.get('content-type') || '';
  
  // Check if response is actually JSON
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => 'Unable to read response body');
    console.warn(`Expected JSON but received: ${contentType}. Response preview: ${text.substring(0, 200)}`);
    return { 
      success: false, 
      error: `Expected JSON response but received ${contentType}`,
      statusCode: response.status 
    };
  }
  
  try {
    const data = await response.json();
    return { success: true, data };
  } catch (parseError) {
    const text = await response.text().catch(() => 'Unable to read response body');
    console.warn('Failed to parse JSON response:', parseError, 'Response:', text.substring(0, 200));
    return { 
      success: false, 
      error: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
      statusCode: response.status 
    };
  }
}

// Helper function for retry logic with exponential backoff
async function fetchWithRetry<T>(
  fetchFn: () => Promise<FetchResult<T>>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<FetchResult<T>> {
  let lastError: string = '';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fetchFn();
      
      if (result.success) {
        return result;
      }
      
      // If we got a result but it wasn't successful, check if we should retry
      const statusCode = result.statusCode || 0;
      const isRetryable = statusCode >= 500 || statusCode === 429; // Server errors or rate limits
      
      if (!isRetryable || attempt === maxRetries - 1) {
        return result;
      }
      
      lastError = result.error || 'Unknown error';
      const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
      
      console.warn(`Attempt ${attempt + 1} failed (${statusCode}): ${lastError}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt === maxRetries - 1) {
        return { 
          success: false, 
          error: `All ${maxRetries} attempts failed. Last error: ${lastError}` 
        };
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`Attempt ${attempt + 1} failed: ${lastError}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return { success: false, error: lastError };
}

// Search by ISBN on Open Library
export async function searchByISBN(isbn: string, preferGerman: boolean = true): Promise<Book | null> {
  const fetchFn = async (): Promise<FetchResult<Book>> => {
    // Add lang parameter to get German metadata when preferred
    const langParam = preferGerman ? '?lang=de' : '';
    const response = await fetch(
      `${OPEN_LIBRARY_API}/isbn/${isbn}.json${langParam}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'ISBN not found in Open Library', statusCode: 404 };
      }
      return { success: false, error: `Open Library API returned status ${response.status}`, statusCode: response.status };
    }
    
    const parseResult = await safeJsonParse(response);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error, statusCode: response.status };
    }
    
    const data = parseResult.data;
    
    // Also fetch work details for additional metadata
    let workData = null;
    if (data.works?.[0]?.key) {
      try {
        const workResponse = await fetch(`${OPEN_LIBRARY_API}${data.works[0].key}.json`);
        const workParseResult = await safeJsonParse(workResponse);
        if (workParseResult.success) {
          workData = workParseResult.data;
        }
      } catch (workError) {
        console.warn('Failed to fetch work details:', workError);
        // Non-fatal, continue without work data
      }
    }
    
    return {
      success: true,
      data: {
        id: crypto.randomUUID(),
        title: data.title,
        subtitle: data.subtitle,
        authors: data.authors?.map((a: { name: string }) => a.name) || [],
        isbn13: isbn, // Use input ISBN as ISBN-13
        coverUrl: data.covers?.[0]
          ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
          : undefined,
        publishedYear: data.publish_date ? parseInt(data.publish_date) : undefined,
        publishedDate: data.publish_date,
        publisher: data.publishers?.[0]?.name,
        subjects: workData?.subjects || [],
        description: workData?.description?.value || workData?.description,
        // Open Library language - typically returned as ISO 639-1 code (e.g., 'de', 'en')
        languageCode: data.languages?.[0]?.key?.replace('/', '') || 'und',
        externalIds: {
          openLibrary: data.key,
          oclcNumber: data.oclc_numbers?.[0],
          lccn: data.lccn,
        },
        format: 'physical' as BookFormat,
        addedAt: new Date(),
        needsSync: true,
        localOnly: true
      }
    };
  };
  
  const result = await fetchWithRetry(fetchFn, 2, 500); // 2 retries, 500ms base delay
  
  if (result.success && result.data) {
    return result.data;
  }
  
  console.info(`Open Library lookup for ISBN ${isbn}: ${result.error || 'Not found'}`);
  return null;
}

// Search Google Books
export async function searchGoogleBooks(query: string): Promise<Book[]> {
  try {
    const response = await fetch(
      `${BACKEND_API}/search?q=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error('Google Books search failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Google Books search error:', error);
    throw error;
  }
}

// Search by ISBN on Google Books
export async function searchGoogleBooksByISBN(isbn: string): Promise<Book | null> {
  const fetchFn = async (): Promise<FetchResult<Book>> => {
    let volumeData: GoogleBooksVolume;
    
    // Use direct API if key is available
    if (GOOGLE_BOOKS_API_KEY) {
      const response = await fetch(
        `${GOOGLE_BOOKS_API_BASE}/volumes?q=isbn:${isbn}&key=${GOOGLE_BOOKS_API_KEY}`
      );
      
      if (!response.ok) {
        return { 
          success: false, 
          error: `Google Books API returned status ${response.status}`,
          statusCode: response.status 
        };
      }
      
      const parseResult = await safeJsonParse(response);
      if (!parseResult.success) {
        return { success: false, error: parseResult.error, statusCode: response.status };
      }
      
      const data = parseResult.data;
      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'No results found for ISBN', statusCode: 404 };
      }
      
      volumeData = data.items[0];
    } else {
      // Fall back to backend proxy
      const response = await fetch(
        `${BACKEND_API}/isbn/${isbn}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: 'ISBN not found via backend proxy', statusCode: 404 };
        }
        return { 
          success: false, 
          error: `Backend proxy returned status ${response.status}`,
          statusCode: response.status 
        };
      }
      
      const parseResult = await safeJsonParse(response);
      if (!parseResult.success) {
        return { success: false, error: parseResult.error, statusCode: response.status };
      }
      
      volumeData = parseResult.data;
    }
    
    const volumeInfo = volumeData.volumeInfo;
    
    // Extract ISBN-13 from industryIdentifiers
    const industryIdentifiers = volumeInfo.industryIdentifiers || [];
    const isbn13 = industryIdentifiers.find(id => id.type === 'ISBN_13')?.identifier;
    
    return {
      success: true,
      data: {
        id: crypto.randomUUID(),
        title: volumeInfo.title,
        subtitle: volumeInfo.subtitle,
        authors: volumeInfo.authors || [],
        isbn13: isbn13 || isbn, // Use extracted ISBN-13 or input ISBN
        coverUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
        description: volumeInfo.description,
        publishedYear: volumeInfo.publishedDate 
          ? parseInt(volumeInfo.publishedDate.split('-')[0]) 
          : undefined,
        publishedDate: volumeInfo.publishedDate,
        pageCount: volumeInfo.pageCount,
        publisher: volumeInfo.publisher,
        categories: volumeInfo.categories,
        averageRating: volumeInfo.averageRating,
        languageCode: volumeInfo.language,
        country: volumeInfo.country,
        previewLink: volumeInfo.previewLink,
        infoLink: volumeInfo.infoLink,
        canonicalVolumeLink: volumeInfo.canonicalVolumeLink,
        webReaderLink: volumeInfo.webReaderLink,
        printType: volumeInfo.printType,
        contentVersion: volumeInfo.contentVersion,
        maturityRating: volumeInfo.maturityRating,
        allowAnonLogging: volumeInfo.allowAnonLogging,
        textToSpeechPermission: volumeInfo.textToSpeechPermission,
        isEbook: volumeData.saleInfo?.isEbook,
        epubAvailable: volumeInfo.accessInfo?.epub?.isAvailable,
        pdfAvailable: volumeInfo.accessInfo?.pdf?.isAvailable,
        dimensions: volumeInfo.dimensions,
        listPrice: volumeData.saleInfo?.listPrice,
        saleability: volumeData.saleInfo?.saleability,
        externalIds: {
          googleBooks: volumeData.id
        },
        format: volumeData.saleInfo?.isEbook ? 'pdf' : 'physical' as BookFormat,
        addedAt: new Date(),
        needsSync: true,
        localOnly: true
      }
    };
  };
  
  const result = await fetchWithRetry(fetchFn, 2, 500); // 2 retries, 500ms base delay
  
  if (result.success && result.data) {
    return result.data;
  }
  
  console.info(`Google Books lookup for ISBN ${isbn}: ${result.error || 'Not found'}`);
  return null;
}

// Combined search across all APIs
export async function searchBooks(query: string): Promise<Book[]> {
  const results: Map<string, Book> = new Map();
  
  try {
    // Search Open Library
    const openLibraryResults = await searchOpenLibrary(query);
    openLibraryResults.forEach(book => {
      const key = book.isbn13 || book.externalIds.openLibrary || book.title;
      results.set(key, book);
    });
    
    // Search Google Books as fallback
    const googleBooksResults = await searchGoogleBooks(query);
    googleBooksResults.forEach(book => {
      const key = book.isbn13 || book.externalIds.googleBooks || book.title;
      if (!results.has(key)) {
        results.set(key, book);
      }
    });
    
    return Array.from(results.values());
  } catch (error) {
    console.error('Combined search failed:', error);
    // Return empty array if all searches fail
    return [];
  }
}

// Fetch multiple cover image candidates for a book
export async function fetchCoverCandidates(
  openLibraryCoverId?: string,
  googleBooksImageLinks?: { thumbnail?: string; smallThumbnail?: string; large?: string }
): Promise<CoverImageCandidate[]> {
  const candidates: CoverImageCandidate[] = [];

  // Open Library covers
  if (openLibraryCoverId) {
    // Open Library provides multiple size variants
    const openLibrarySizes: { size: CoverSize; suffix: string; width: number; height: number }[] = [
      { size: 'thumbnail', suffix: '-S', width: 90, height: 90 },
      { size: 'small', suffix: '-M', width: 300, height: 450 },
      { size: 'medium', suffix: '-L', width: 500, height: 750 },
      { size: 'large', suffix: '-XXL', width: 1200, height: 1800 },
      { size: 'xl', suffix: '-XXXL', width: 2400, height: 3600 },
    ];

    for (const { size, suffix, width, height } of openLibrarySizes) {
      candidates.push({
        url: `https://covers.openlibrary.org/b/id/${openLibraryCoverId}${suffix}.jpg`,
        source: 'openLibrary',
        size,
        width,
        height,
        isPreferred: size === 'medium' // Medium is usually a good balance
      });
    }
  }

  // Google Books covers
  if (googleBooksImageLinks) {
    // Google Books provides smallThumbnail, thumbnail, and sometimes large
    if (googleBooksImageLinks.smallThumbnail) {
      candidates.push({
        url: googleBooksImageLinks.smallThumbnail.replace('http:', 'https:'),
        source: 'googleBooks',
        size: 'thumbnail',
        width: 80,
        height: 128,
        isPreferred: false
      });
    }

    if (googleBooksImageLinks.thumbnail) {
      candidates.push({
        url: googleBooksImageLinks.thumbnail.replace('http:', 'https:'),
        source: 'googleBooks',
        size: 'small',
        width: 128,
        height: 195,
        isPreferred: false
      });
    }

    if (googleBooksImageLinks.large) {
      candidates.push({
        url: googleBooksImageLinks.large.replace('http:', 'https:'),
        source: 'googleBooks',
        size: 'medium',
        width: 400,
        height: 600,
        isPreferred: true // Large is preferred from Google Books
      });
    }
  }

  return candidates;
}

// Helper to check if a book has German language metadata
function isGermanBook(book: Book | null): boolean {
  if (!book) return false;
  const lang = book.languageCode?.toLowerCase();
  return lang === 'de' || lang === 'ger' || lang === 'german';
}

// Helper to merge two book records, preferring German metadata and more complete data
function mergeBooks(primary: Book | null, secondary: Book | null): Book | null {
  if (!primary) return secondary;
  if (!secondary) return primary;

  // Prefer German metadata when available
  const primaryIsGerman = isGermanBook(primary);
  const secondaryIsGerman = isGermanBook(secondary);

  // If one is German and the other isn't, prefer German
  if (primaryIsGerman && !secondaryIsGerman) {
    return primary;
  }
  if (secondaryIsGerman && !primaryIsGerman) {
    return secondary;
  }

  // Both same language preference - merge fields, preferring non-empty values
  return {
    ...primary,
    // Prefer secondary's title/subtitle if primary is missing them
    title: primary.title || secondary.title,
    subtitle: primary.subtitle || secondary.subtitle,
    authors: primary.authors.length > 0 ? primary.authors : secondary.authors,
    // Prefer secondary's description if primary is missing
    description: primary.description || secondary.description,
    publisher: primary.publisher || secondary.publisher,
    publishedYear: primary.publishedYear || secondary.publishedYear,
    publishedDate: primary.publishedDate || secondary.publishedDate,
    pageCount: primary.pageCount || secondary.pageCount,
    subjects: primary.subjects?.length ? primary.subjects : secondary.subjects,
    categories: primary.categories?.length ? primary.categories : secondary.categories,
    // Keep the German language code if either has it
    languageCode: primaryIsGerman || secondaryIsGerman ? (primary.languageCode || secondary.languageCode) : primary.languageCode,
    // Prefer cover from Open Library if available, otherwise use what we have
    coverUrl: primary.coverUrl || secondary.coverUrl,
    // Merge external IDs
    externalIds: {
      ...primary.externalIds,
      ...secondary.externalIds
    }
  };
}

// Combined function to get book data with multiple cover options
export interface BookWithCoverCandidates {
  book: Book | null;
  coverCandidates: CoverImageCandidate[];
}

export async function searchISBNWithMultipleCovers(isbn: string, preferGerman: boolean = true): Promise<BookWithCoverCandidates> {
  const [openLibraryResult, googleBooksResult] = await Promise.allSettled([
    searchByISBN(isbn, preferGerman),
    searchGoogleBooksByISBN(isbn)
  ]);

  let openLibraryBook: Book | null = null;
  let googleBooksBook: Book | null = null;
  let hasOpenLibraryCover = false;
  let googleBooksImageLinks: { thumbnail?: string; smallThumbnail?: string; large?: string } | undefined;

  if (openLibraryResult.status === 'fulfilled' && openLibraryResult.value) {
    openLibraryBook = openLibraryResult.value;
    // Extract cover ID from Open Library URL if present
    if (openLibraryBook?.coverUrl) {
      const coverIdMatch = openLibraryBook.coverUrl.match(/covers\.openlibrary\.org\/b\/id\/(\d+)/);
      if (coverIdMatch) {
        hasOpenLibraryCover = true;
      }
    }
  }

  if (googleBooksResult.status === 'fulfilled' && googleBooksResult.value) {
    googleBooksBook = googleBooksResult.value;
    // For Google Books, we need to construct image links from the book data
    // The Google Books book object may have coverUrl set to thumbnail
    if (googleBooksBook.coverUrl) {
      googleBooksImageLinks = {
        thumbnail: googleBooksBook.coverUrl,
        // Try to get larger version by replacing size suffix
        large: googleBooksBook.coverUrl?.replace('-S.jpg', '-L.jpg').replace('http:', 'https:')
      };
    }
  }

  // Merge books with German priority
  const bestBook = mergeBooks(openLibraryBook, googleBooksBook);

  // Fetch cover candidates
  const coverCandidates = await fetchCoverCandidates(
    hasOpenLibraryCover ? bestBook?.coverUrl?.match(/covers\.openlibrary\.org\/b\/id\/(\d+)/)?.[1] : undefined,
    googleBooksImageLinks
  );

  return {
    book: bestBook,
    coverCandidates
  };
}

// ISBN validation
export function isValidISBN(isbn: string): boolean {
  return validateISBN(isbn).isValid;
}
