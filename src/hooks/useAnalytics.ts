import { useLiveQuery } from 'dexie-react-hooks';
import { 
  bookOperations, 
  ratingOperations
} from '../lib/db';
import type { 
  Book,  
  FilterConfig, 
  SortConfig,
  BookFormat,
  ReadingLog
} from '../types';
import { db } from '../lib/db';

// Re-export useBooks from existing hook for compatibility
export { useBooks } from './useBooks';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, isWithinInterval, getYear, parseISO } from 'date-fns';

// Comprehensive reading statistics hook
export function useReadingAnalytics() {
  const readingLogs = useLiveQuery(() => db.readingLogs.toArray());
  const books = useLiveQuery(() => bookOperations.getAll());
  const ratings = useLiveQuery(() => db.ratings.toArray());

  return {
    // All-time statistics
    totalBooksRead: readingLogs?.filter(log => log.status === 'read').length || 0,
    totalDNF: readingLogs?.filter(log => log.status === 'dnf').length || 0,
    
    // Current year statistics
    booksReadThisYear: readingLogs?.filter(log => {
      if (log.status !== 'read' || !log.finishedAt) return false;
      const finishedDate = log.finishedAt instanceof Date ? log.finishedAt : parseISO(log.finishedAt as unknown as string);
      return isWithinInterval(finishedDate, {
        start: startOfYear(new Date()),
        end: endOfYear(new Date())
      });
    }).length || 0,
    
    // Current month statistics  
    booksReadThisMonth: readingLogs?.filter(log => {
      if (log.status !== 'read' || !log.finishedAt) return false;
      const finishedDate = log.finishedAt instanceof Date ? log.finishedAt : parseISO(log.finishedAt as unknown as string);
      return isWithinInterval(finishedDate, {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
      });
    }).length || 0,
    
    // Currently reading count
    currentlyReading: readingLogs?.filter(log => log.status === 'currently_reading').length || 0,
    
    // Average rating calculation
    averageRating: calculateAverageRating(ratings),
    
    // Pages read estimate
    pagesReadEstimate: calculatePagesRead(books || [], ratings || []),
    
    // Reading history for charts
    readingHistory: getReadingHistory(readingLogs || []),
    
    // Re-read count
    reReadCount: countReReads(readingLogs || []),
  };
}

// Helper function to calculate average rating
function calculateAverageRating(ratings: any[] | undefined): number {
  if (!ratings || ratings.length === 0) return 0;
  const total = ratings.reduce((sum, rating) => sum + (rating.stars || 0), 0);
  return Math.round((total / ratings.length) * 10) / 10;
}

// Helper function to estimate pages read
function calculatePagesRead(books: Book[], ratings: any[]): number {
  return books.reduce((total, book) => {
    const bookRating = ratings.find(r => r.bookId === book.id);
    if (bookRating) {
      return total + (book.pageCount || 0);
    }
    return total;
  }, 0);
}

// Helper function to process reading history for charts
function getReadingHistory(logs: ReadingLog[]) {
  const readLogs = logs.filter(log => log.status === 'read' && log.finishedAt);
  
  // Group by year
  const yearData: Record<string, number> = {};
  // Group by month (for current year)
  const monthData: Record<string, number> = {};
  
  readLogs.forEach(log => {
    const date = log.finishedAt instanceof Date ? log.finishedAt : parseISO(log.finishedAt as unknown as string);
    const year = getYear(date).toString();
    const monthKey = format(date, 'yyyy-MM');
    
    yearData[year] = (yearData[year] || 0) + 1;
    monthData[monthKey] = (monthData[monthKey] || 0) + 1;
  });
  
  return { yearData, monthData };
}

// Helper function to count re-reads
function countReReads(logs: ReadingLog[]): number {
  const bookReadCount: Record<string, number> = {};
  
  logs.filter(log => log.status === 'read').forEach(log => {
    bookReadCount[log.bookId] = (bookReadCount[log.bookId] || 0) + 1;
  });
  
  // Count books read more than once
  return Object.values(bookReadCount).filter(count => count > 1).length;
}

// Hook for accessing reading history with filters and sorting
export function useReadingHistory(
  filters: FilterConfig = {},
  sortConfig: SortConfig = { field: 'finishedAt', direction: 'desc' }
) {
  const readingLogs = useLiveQuery(async () => {
    let logs = await db.readingLogs.toArray();
    
    // Apply status filter
    if (filters.statuses && filters.statuses.length > 0) {
      logs = logs.filter(log => filters.statuses!.includes(log.status));
    }
    
    // Apply date range filter
    if (filters.dateRange) {
      logs = logs.filter(log => {
        const logDate = log.createdAt instanceof Date ? log.createdAt : parseISO(log.createdAt as unknown as string);
        return isWithinInterval(logDate, {
          start: filters.dateRange!.start,
          end: filters.dateRange!.end
        });
      });
    }
    
    // Get book details for each log
    const logsWithBooks = await Promise.all(
      logs.map(async (log) => {
        const book = await bookOperations.getById(log.bookId);
        const rating = await ratingOperations.getByBookId(log.bookId);
        return { ...log, book, rating };
      })
    );
    
    // Apply additional filters
    const filteredLogs = logsWithBooks.filter(log => {
      if (!log.book) return false;
      
      // Apply format filter
      if (filters.formats && filters.formats.length > 0) {
        if (!filters.formats.includes(log.book.format)) return false;
      }
      
      // Apply rating filter
      if (filters.minRating !== undefined || filters.maxRating !== undefined) {
        const rating = log.rating?.stars || 0;
        if (filters.minRating !== undefined && rating < filters.minRating) return false;
        if (filters.maxRating !== undefined && rating > filters.maxRating) return false;
      }
      
      return true;
    });
    
    // Apply sorting
    filteredLogs.sort((a, b) => {
      let comparison = 0;
      
      if (sortConfig.field === 'finishedAt' || sortConfig.field === 'startedAt' || sortConfig.field === 'createdAt') {
        const aField = a[sortConfig.field];
        const bField = b[sortConfig.field];
        const aDate = aField instanceof Date 
          ? aField 
          : (aField ? parseISO(aField as unknown as string) : new Date(0));
        const bDate = bField instanceof Date 
          ? bField 
          : (bField ? parseISO(bField as unknown as string) : new Date(0));
        
        comparison = aDate.getTime() - bDate.getTime();
      } else if (sortConfig.field === 'rating') {
        comparison = (a.rating?.stars || 0) - (b.rating?.stars || 0);
      } else if (sortConfig.field === 'title') {
        comparison = (a.book?.title || '').localeCompare(b.book?.title || '');
      }
      
      return sortConfig.direction === 'desc' ? -comparison : comparison;
    });
    
    return filteredLogs;
  }, [filters, sortConfig]);
  
  return readingLogs || [];
}

// Hook for genre distribution
export function useGenreDistribution() {
  const books = useLiveQuery(() => bookOperations.getAll());
  
  return books?.reduce((acc, book) => {
    // Use primary genre field if available
    if (book.genre) {
      acc[book.genre] = (acc[book.genre] || 0) + 1;
    }
    
    // Also aggregate categories from ISBN metadata
    if (book.categories && book.categories.length > 0) {
      book.categories.forEach(category => {
        if (category) {
          acc[category] = (acc[category] || 0) + 1;
        }
      });
    }
    
    return acc;
  }, {} as Record<string, number>) || {};
}

// Hook for genre ranking - returns genres sorted by count
export function useGenreRanking(limit: number = 10) {
  const distribution = useGenreDistribution();
  
  const ranking = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, limit)
    .map(([genre, count], index) => ({
      rank: index + 1,
      genre,
      count,
      percentage: 0 // Will be calculated when total is available
    }));
  
  // Calculate total for percentage
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  
  // Add percentages
  return ranking.map(item => ({
    ...item,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

// Hook for tag distribution - counts tags across all books using junction table
export function useTagDistribution() {
  const bookTags = useLiveQuery(() => db.bookTags.toArray());
  const tags = useLiveQuery(() => db.tags.toArray());

  return bookTags?.reduce((acc, bookTag) => {
    const tag = tags?.find(t => t.id === bookTag.tagId);
    if (tag) {
      acc[tag.name] = (acc[tag.name] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};
}

// Hook for tag ranking - returns tags sorted by usage count
export function useTagRanking(limit: number = 10) {
  const distribution = useTagDistribution();

  const ranking = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, limit)
    .map(([tag, count], index) => ({
      rank: index + 1,
      tag,
      count,
      percentage: 0 // Will be calculated when total is available
    }));

  // Calculate total for percentage
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  // Add percentages
  return ranking.map(item => ({
    ...item,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

// Hook for format distribution
export function useFormatDistribution() {
  const books = useLiveQuery(() => bookOperations.getAll());

  return books?.reduce((acc, book) => {
    acc[book.format] = (acc[book.format] || 0) + 1;
    return acc;
  }, {} as Record<BookFormat, number>) || {};
}

// Hook for rating distribution
export function useRatingDistribution() {
  const ratings = useLiveQuery(() => db.ratings.toArray());
  
  const distribution = {
    '5': 0, '4.5': 0, '4': 0, '3.5': 0, '3': 0, '2.5': 0, '2': 0, '1.5': 0, '1': 0, '0.5': 0
  };
  
  ratings?.forEach(rating => {
    const roundedRating = Math.round(rating.stars * 2) / 2;
    const key = roundedRating.toString();
    if (key in distribution) {
      distribution[key as keyof typeof distribution]++;
    }
  });
  
  return distribution;
}

// Hook for star count/rating ranking - returns star ratings sorted by count
export function useStarCountRanking(limit: number = 10) {
  const distribution = useRatingDistribution();

  const ranking = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, limit)
    .map(([stars, count], index) => ({
      rank: index + 1,
      stars: parseFloat(stars),
      starsDisplay: `${stars} ★`,
      count,
      percentage: 0 // Will be calculated when total is available
    }));

  // Calculate total for percentage
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  // Add percentages
  return ranking.map(item => ({
    ...item,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

