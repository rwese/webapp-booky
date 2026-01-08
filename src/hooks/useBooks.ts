import { useLiveQuery } from 'dexie-react-hooks';
import { bookOperations, ratingOperations, tagOperations, readingLogOperations } from '../lib/db';
import type { Book, FilterConfig, SortConfig } from '../types';

// Hook for accessing all books with live queries
export function useBooks() {
  return useLiveQuery(() => bookOperations.getAll());
}

// Export useReadingStats as well
export function useReadingStats() {
  const currentlyReading = useLiveQuery(
    () => readingLogOperations.getAllByStatus('currently_reading')
  );
  
  const completedBooks = useLiveQuery(
    () => readingLogOperations.getAllByStatus('read')
  );
  
  const wantToReadBooks = useLiveQuery(
    () => readingLogOperations.getAllByStatus('want_to_read')
  );
  
  return {
    currentlyReading: currentlyReading || [],
    completedBooks: completedBooks || [],
    wantToReadBooks: wantToReadBooks || [],
    totalInProgress: (currentlyReading?.length || 0),
    totalCompleted: (completedBooks?.length || 0),
    totalWantToRead: (wantToReadBooks?.length || 0),
  };
}

// Hook for accessing a single book by ID
export function useBook(id: string) {
  return useLiveQuery(() => bookOperations.getById(id), [id]);
}

// Hook for searching books
export function useSearchBooks(query: string) {
  return useLiveQuery(
    () => (query ? bookOperations.search(query) : bookOperations.getAll()),
    [query]
  );
}

// Hook for books with filters and sorting
export function useFilteredBooks(
  filters: FilterConfig,
  sortConfig: SortConfig
) {
  return useLiveQuery(async () => {
    let books = await bookOperations.getAll();
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      books = books.filter(book =>
        book.title.toLowerCase().includes(searchLower) ||
        book.authors.some(author => author.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply tag filter
    if (filters.tags && filters.tags.length > 0) {
      books = books.filter(async book => {
        const bookTags = await tagOperations.getBookTags(book.id);
        return filters.tags!.some(tagId => 
          bookTags.some(bt => bt.id === tagId)
        );
      });
    }
    
    // Apply format filter
    if (filters.formats && filters.formats.length > 0) {
      books = books.filter(book => filters.formats!.includes(book.format));
    }
    
    // Apply sorting
    books.sort((a, b) => {
      const field = sortConfig.field as keyof Book;
      const aVal = a[field] ?? '';
      const bVal = b[field] ?? '';
      
      // Handle dates
      const aDate = aVal instanceof Date ? aVal.getTime() : aVal;
      const bDate = bVal instanceof Date ? bVal.getTime() : bVal;
      
      if (aDate < bDate) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aDate > bDate) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return books;
  }, [filters, sortConfig]);
}

// Hook for accessing ratings
export function useRating(bookId: string) {
  return useLiveQuery(
    () => ratingOperations.getByBookId(bookId),
    [bookId]
  );
}

// Hook for accessing ratings for multiple books
export function useRatings(bookIds: string[]) {
  return useLiveQuery(
    () => ratingOperations.getByBookIds(bookIds),
    [bookIds]
  );
}

// Hook for accessing all tags
export function useTags() {
  return useLiveQuery(() => tagOperations.getAll());
}

// Hook for accessing tags for a specific book
export function useBookTags(bookId: string) {
  return useLiveQuery(
    () => tagOperations.getBookTags(bookId),
    [bookId]
  );
}
