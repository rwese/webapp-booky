import type { OpenLibraryBook, GoogleBooksVolume, Book, BookFormat } from '../types';

const OPEN_LIBRARY_API = 'https://openlibrary.org';
const BACKEND_API = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

// Search Open Library
export async function searchOpenLibrary(query: string): Promise<Book[]> {
  try {
    const response = await fetch(
      `${OPEN_LIBRARY_API}/search.json?q=${encodeURIComponent(query)}&limit=20&fields=key,title,author_name,isbn,first_publish_year,cover_i,number_of_pages_median,publisher`
    );
    
    if (!response.ok) {
      throw new Error('Open Library search failed');
    }
    
    const data = await response.json();
    
    return data.docs.map((book: OpenLibraryBook) => ({
      id: crypto.randomUUID(),
      title: book.title,
      authors: book.author_name || [],
      isbn: book.isbn?.[0],
      isbn13: book.isbn?.[1],
      coverUrl: book.cover_i 
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : undefined,
      publishedYear: book.first_publish_year,
      pageCount: book.number_of_pages_median,
      publisher: book.publisher?.[0],
      format: 'physical' as BookFormat,
      addedAt: new Date(),
      externalIds: {
        openLibrary: book.key
      },
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
    
    return {
      id: crypto.randomUUID(),
      title: data.title,
      authors: data.authors?.map((a: any) => a.name) || [],
      isbn: isbn,
      isbn13: data.isbn_13?.[0],
      coverUrl: data.covers?.[0]
        ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
        : undefined,
      publishedYear: data.publish_date ? parseInt(data.publish_date) : undefined,
      publisher: data.publishers?.[0]?.name,
      format: 'physical' as BookFormat,
      addedAt: new Date(),
      externalIds: {
        openLibrary: data.key
      },
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
    const response = await fetch(
      `${BACKEND_API}/isbn/${isbn}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Google Books ISBN lookup failed');
    }
    
    return await response.json();
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
