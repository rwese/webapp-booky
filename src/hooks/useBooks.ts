import { useLiveQuery } from 'dexie-react-hooks';
import { bookOperations, ratingOperations, tagOperations } from '../lib/db';
import type { Book, FilterConfig, SortConfig } from '../types';

// Hook for accessing all books with live queries
export function useBooks() {
  const books = useLiveQuery(() => bookOperations.getAll());
  
  // If useLiveQuery fails due to version error, it will return undefined
  // We handle this gracefully in the bookOperations.getAll function
  return books;
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

// Hook for books with filters and sorting (legacy - not optimized for large libraries)
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
      // Get tags for all books first
      const booksWithTags = await Promise.all(
        books.map(async (book) => {
          const bookTags = await tagOperations.getBookTags(book.id);
          return {
            book,
            hasMatchingTag: filters.tags!.some(tagId =>
              bookTags.some(bt => bt.id === tagId)
            )
          };
        })
      );

      // Filter books that have at least one matching tag
      books = booksWithTags
        .filter(({ hasMatchingTag }) => hasMatchingTag)
        .map(({ book }) => book);
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

// Hook for books with pagination support (optimized for large libraries 10K+ books)
export function useFilteredBooksPaginated(
  filters: FilterConfig,
  sortConfig: SortConfig,
  page: number = 1,
  limit: number = 20
) {
  return useLiveQuery(async () => {
    const result = await bookOperations.getPaginated({
      page,
      limit,
      sortField: sortConfig.field as keyof Book || 'addedAt',
      sortDirection: sortConfig.direction || 'desc',
      search: filters.search,
      formats: filters.formats,
      tagIds: filters.tags
    });
    return result;
  }, [filters, sortConfig, page, limit]);
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
