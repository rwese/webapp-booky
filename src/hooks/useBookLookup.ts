/**
 * Book Lookup Hook
 * 
 * Hook for looking up books by ISBN using Open Library and Google Books APIs.
 */

import { useState, useCallback } from 'react';

export function useBookLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookData, setBookData] = useState<any>(null);

  const searchByISBN = useCallback(async (isbn: string) => {
    // Import dynamically to avoid circular dependencies
    const { searchByISBN: searchISBN } = await import('../lib/api');
    return searchISBN(isbn);
  }, []);

  const searchGoogleBooks = useCallback(async (isbn: string) => {
    const { searchGoogleBooksByISBN } = await import('../lib/api');
    return searchGoogleBooksByISBN(isbn);
  }, []);

  const lookupISBN = useCallback(async (isbn: string) => {
    setIsLoading(true);
    setError(null);
    setBookData(null);

    try {
      // Search both Open Library and Google Books
      const [openLibraryBook, googleBooksBook] = await Promise.all([
        searchByISBN(isbn),
        searchGoogleBooks(isbn)
      ]);

      // Prefer Open Library result, fall back to Google Books
      const book = openLibraryBook || googleBooksBook;

      if (book) {
        setBookData(book);
        window.dispatchEvent(new CustomEvent('book:found', { detail: book }));
      } else {
        setError('Book not found for this ISBN');
        window.dispatchEvent(new CustomEvent('book:notfound', { detail: { isbn } }));
      }
    } catch (err) {
      setError('Failed to lookup book');
      console.error('Book lookup error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchByISBN, searchGoogleBooks]);

  return {
    isLoading,
    error,
    bookData,
    lookupISBN,
    clearBookData: () => setBookData(null)
  };
}
