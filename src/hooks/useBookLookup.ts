/**
 * Book Lookup Hook
 * 
 * Hook for looking up books by ISBN using multiple sources:
 * Open Library and Google Books.
 */

import { useState, useCallback } from 'react';
import { 
  searchByISBN, 
  searchGoogleBooksByISBN,
  isbnLookupSources 
} from '../lib/api';
import type { Book } from '../types';

export function useBookLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookData, setBookData] = useState<Book | null>(null);
  const [sourcesSearched, setSourcesSearched] = useState<string[]>([]);

  const searchByISBNFromSource = useCallback(async (isbn: string, source: 'openLibrary' | 'googleBooks') => {
    const sourceConfig = isbnLookupSources[source];
    if (!sourceConfig?.enabled) {
      return null;
    }

    switch (source) {
      case 'openLibrary':
        return await searchByISBN(isbn);
      case 'googleBooks':
        return await searchGoogleBooksByISBN(isbn);
      default:
        return null;
    }
  }, []);

  const lookupISBN = useCallback(async (isbn: string, useComprehensiveSearch = true) => {
    setIsLoading(true);
    setError(null);
    setBookData(null);
    setSourcesSearched([]);

    try {
      if (useComprehensiveSearch) {
        // Search multiple sources in parallel by priority
        const searchPromises = ['openLibrary', 'googleBooks'].map(async (source) => {
          const typedSource = source as 'openLibrary' | 'googleBooks';
          const book = await searchByISBNFromSource(isbn, typedSource);
          if (book) {
            setSourcesSearched(prev => [...prev, isbnLookupSources[typedSource].name]);
          }
          return { source, book };
        });

        const results = await Promise.all(searchPromises);
        
        // Priority-based selection: Google Books > Open Library
        const priorityOrder = ['googleBooks', 'openLibrary'];
        let selectedBook = null;
        
        for (const source of priorityOrder) {
          const result = results.find(r => r.source === source);
          if (result?.book) {
            selectedBook = result.book;
            break;
          }
        }

        if (selectedBook) {
          setBookData(selectedBook);
          window.dispatchEvent(new CustomEvent('book:found', { detail: selectedBook }));
        } else {
          setError(`Book not found for ISBN ${isbn}. Searched sources: Open Library, Google Books`);
          window.dispatchEvent(new CustomEvent('book:notfound', { detail: { isbn } }));
        }
      } else {
        // Original single-source lookup
        const book = await searchByISBN(isbn);
        
        if (book) {
          setBookData(book);
          setSourcesSearched([isbnLookupSources.openLibrary.name]);
          window.dispatchEvent(new CustomEvent('book:found', { detail: book }));
        } else {
          setError('Book not found for this ISBN');
          window.dispatchEvent(new CustomEvent('book:notfound', { detail: { isbn } }));
        }
      }
    } catch (err) {
      setError('Failed to lookup book');
      console.error('Book lookup error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchByISBNFromSource]);

  const lookupFromSource = useCallback(async (isbn: string, source: 'openLibrary' | 'googleBooks') => {
    if (!isbnLookupSources[source]?.enabled) {
      setError(`${isbnLookupSources[source]?.name || source} is not enabled`);
      return null;
    }

    setIsLoading(true);
    setError(null);
    setBookData(null);

    try {
      const book = await searchByISBNFromSource(isbn, source);
      
      if (book) {
        setBookData(book);
        setSourcesSearched([isbnLookupSources[source].name]);
        window.dispatchEvent(new CustomEvent('book:found', { detail: book }));
      } else {
        setError(`Book not found in ${isbnLookupSources[source].name}`);
        window.dispatchEvent(new CustomEvent('book:notfound', { detail: { isbn, source } }));
      }
      
      return book;
    } catch (err) {
      setError(`Failed to lookup book in ${isbnLookupSources[source].name}`);
      console.error(`${isbnLookupSources[source].name} lookup error:`, err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [searchByISBNFromSource]);

  return {
    isLoading,
    error,
    bookData,
    sourcesSearched,
    lookupISBN,
    lookupFromSource,
    clearBookData: () => {
      setBookData(null);
      setSourcesSearched([]);
    },
    availableSources: (['openLibrary', 'googleBooks'] as const)
      .filter(key => isbnLookupSources[key].enabled)
      .map(key => ({ id: key, name: isbnLookupSources[key].name }))
  };
}