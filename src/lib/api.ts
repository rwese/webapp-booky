import type { OpenLibraryBook, GoogleBooksVolume, Book, BookFormat } from '../types';

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
      isbn: book.isbn?.[0],
      isbn13: book.isbn?.[1],
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

// Search by ISBN on Open Library
export async function searchByISBN(isbn: string): Promise<Book | null> {
  try {
    const response = await fetch(
      `${OPEN_LIBRARY_API}/isbn/${isbn}.json`
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Also fetch work details for additional metadata
    const workResponse = data.works?.[0]?.key 
      ? await fetch(`${OPEN_LIBRARY_API}${data.works[0].key}.json`).catch(() => null)
      : null;
    const workData = workResponse?.ok ? await workResponse.json() : null;
    
    return {
      id: crypto.randomUUID(),
      title: data.title,
      subtitle: data.subtitle,
      authors: data.authors?.map((a: any) => a.name) || [],
      isbn: isbn,
      isbn13: data.isbn_13?.[0],
      coverUrl: data.covers?.[0]
        ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
        : undefined,
      publishedYear: data.publish_date ? parseInt(data.publish_date) : undefined,
      publishedDate: data.publish_date,
      publisher: data.publishers?.[0]?.name,
      subjects: workData?.subjects || [],
      description: workData?.description?.value || workData?.description,
      externalIds: {
        openLibrary: data.key,
        oclcNumber: data.oclc_numbers?.[0],
        lccn: data.lccn,
      },
      format: 'physical' as BookFormat,
      addedAt: new Date(),
      needsSync: true,
      localOnly: true
    };
  } catch (error) {
    console.error('ISBN lookup error:', error);
    return null;
  }
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
  try {
    let volumeData: GoogleBooksVolume;
    
    // Use direct API if key is available
    if (GOOGLE_BOOKS_API_KEY) {
      const response = await fetch(
        `${GOOGLE_BOOKS_API_BASE}/volumes?q=isbn:${isbn}&key=${GOOGLE_BOOKS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error('Google Books ISBN lookup failed');
      }
      
      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        return null;
      }
      
      volumeData = data.items[0];
    } else {
      // Fall back to backend proxy
      const response = await fetch(
        `${BACKEND_API}/isbn/${isbn}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Google Books ISBN lookup failed');
      }
      
      volumeData = await response.json();
    }
    
    const volumeInfo = volumeData.volumeInfo;
    
    // Extract ISBN-13 from industryIdentifiers
    const industryIdentifiers = volumeInfo.industryIdentifiers || [];
    const isbn13 = industryIdentifiers.find(id => id.type === 'ISBN_13')?.identifier;
    const isbn10 = industryIdentifiers.find(id => id.type === 'ISBN_10')?.identifier;
    
    return {
      id: crypto.randomUUID(),
      title: volumeInfo.title,
      subtitle: volumeInfo.subtitle,
      authors: volumeInfo.authors || [],
      isbn: isbn10,
      isbn13: isbn13,
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
      ratingsCount: volumeInfo.ratingsCount,
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
    };
  } catch (error) {
    console.error('Google Books ISBN lookup error:', error);
    return null;
  }
}

// Combined search across all APIs
export async function searchBooks(query: string): Promise<Book[]> {
  const results: Map<string, Book> = new Map();
  
  try {
    // Search Open Library
    const openLibraryResults = await searchOpenLibrary(query);
    openLibraryResults.forEach(book => {
      const key = book.isbn || book.externalIds.openLibrary || book.title;
      results.set(key, book);
    });
    
    // Search Google Books as fallback
    const googleBooksResults = await searchGoogleBooks(query);
    googleBooksResults.forEach(book => {
      const key = book.isbn || book.externalIds.googleBooks || book.title;
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

// ISBN validation
export function isValidISBN(isbn: string): boolean {
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  
  // ISBN-10
  if (cleanIsbn.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanIsbn[i]) * (10 - i);
    }
    const lastChar = cleanIsbn[9].toUpperCase();
    const lastValue = lastChar === 'X' ? 10 : parseInt(lastChar);
    sum += lastValue;
    return sum % 11 === 0;
  }
  
  // ISBN-13
  if (cleanIsbn.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanIsbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(cleanIsbn[12]);
  }
  
  return false;
}

// Format ISBN for display
export function formatISBN(isbn: string): string {
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  
  if (cleanIsbn.length === 13) {
    return `${cleanIsbn.slice(0, 3)}-${cleanIsbn.slice(3, 4)}-${cleanIsbn.slice(4, 6)}-${cleanIsbn.slice(6, 12)}-${cleanIsbn.slice(12)}`;
  }
  
  if (cleanIsbn.length === 10) {
    return `${cleanIsbn.slice(0, 1)}-${cleanIsbn.slice(1, 3)}-${cleanIsbn.slice(3, 9)}-${cleanIsbn.slice(9)}`;
  }
  
  return isbn;
}
