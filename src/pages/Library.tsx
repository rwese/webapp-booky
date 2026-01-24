import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Grid, List, Book, Plus, ChevronLeft, ChevronRight, Edit, Tag as TagIcon } from 'lucide-react';
import { Card, Badge, Button } from '../components/common/Button';
import { useFilteredBooks, useRatings } from '../hooks/useBooks';
import { useLibraryStore, useToastStore } from '../store/useStore';
import { useDebounce, useIsTouchDevice } from '../hooks/usePerformance';
import { bookOperations, tagOperations } from '../lib/db';
import { BookCover } from '../components/image';
import { type TagWithCount } from '../components/forms/TagListing';
import { StarRating } from '../components/forms/StarRating';
import { StatusBadge } from '../components/forms/StatusSelector';
import type { Book as BookType, FilterConfig, SortConfig, BookFormat } from '../types';
import { clsx } from 'clsx';
import { useUrlFilterSync, urlParamsToFilters } from '../hooks/useUrlFilterSync';
import { useLiveQuery } from 'dexie-react-hooks';

export function LibraryPage() {
  const { viewMode, setViewMode, sortConfig, setSortConfig, filterConfig, setFilterConfig } = useLibraryStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(localSearch, 300);
  const isTouchDevice = useIsTouchDevice();

  // Track whether we've initialized filters from URL
  // Intentionally not listing all deps - we only want this to run once on mount
  const initializedFromUrl = useRef(false);

  useEffect(() => {
    // Only run once when URL params are available
    if (initializedFromUrl.current) return;

    const { filterConfig: urlFilterConfig, sortConfig: urlSortConfig } = urlParamsToFilters(searchParams);

    // Apply URL params to store if they differ from initial state
    const hasFilterChanges =
      urlFilterConfig.search !== filterConfig.search ||
      JSON.stringify(urlFilterConfig.tags) !== JSON.stringify(filterConfig.tags) ||
      JSON.stringify(urlFilterConfig.collections) !== JSON.stringify(filterConfig.collections) ||
      JSON.stringify(urlFilterConfig.formats) !== JSON.stringify(filterConfig.formats) ||
      JSON.stringify(urlFilterConfig.statuses) !== JSON.stringify(filterConfig.statuses);

    const hasSortChanges =
      (urlSortConfig.field && urlSortConfig.field !== sortConfig.field) ||
      (urlSortConfig.direction && urlSortConfig.direction !== sortConfig.direction);

    if (hasFilterChanges || hasSortChanges) {
      if (hasFilterChanges) {
        setFilterConfig({ ...filterConfig, ...urlFilterConfig });
      }
      if (hasSortChanges) {
        setSortConfig({ ...sortConfig, ...urlSortConfig });
      }
      initializedFromUrl.current = true;
    } else {
      // Even if no changes, mark as initialized to prevent re-running
      initializedFromUrl.current = true;
    }
  }, [searchParams, filterConfig, sortConfig, setFilterConfig, setSortConfig]);

  // URL filter sync
  const { clearFilters: clearFiltersAndUrl } = useUrlFilterSync(
    { ...filterConfig, search: debouncedSearch },
    sortConfig,
    setFilterConfig,
    setSortConfig
  );

  // Use search from filterConfig (which may come from URL) or local state
  const effectiveFilterConfig = {
    ...filterConfig,
    search: filterConfig.search || debouncedSearch,
  };

  // Apply filters and sorting
  const filteredBooks = useFilteredBooks(effectiveFilterConfig, sortConfig);

  // Pagination
  const itemsPerPage = isTouchDevice ? 10 : 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil((filteredBooks?.length || 0) / itemsPerPage);
  const paginatedBooks = filteredBooks?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Fetch ratings for paginated books
  const bookIdsForRatings = useMemo(() => 
    paginatedBooks?.map(book => book.id) || [], 
    [paginatedBooks]
  );
  const ratings = useRatings(bookIdsForRatings);
  
  // Create a map of bookId -> rating for efficient lookup
  const ratingMap = useMemo(() => {
    if (!ratings) return new Map<string, number>();
    return new Map(ratings.map(r => [r.bookId, r.stars]));
  }, [ratings]);

  const handleDeleteBook = useCallback(async (bookId: string) => {
    try {
      await bookOperations.delete(bookId);
      addToast({ type: 'success', message: 'Book removed from collection' });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to remove book' });
    }
  }, [addToast]);

  const handleEditBook = useCallback((bookId: string) => {
    navigate(`/edit/${bookId}`);
  }, [navigate]);

  // Get search query for display (from URL or local state)
  const searchQuery = filterConfig.search || localSearch;

  // Memoized tag toggle handler
  const handleTagToggle = useCallback((tagId: string) => {
    if (filterConfig.tags?.includes(tagId)) {
      setFilterConfig({
        ...filterConfig,
        tags: filterConfig.tags.filter(id => id !== tagId)
      });
    } else {
      setFilterConfig({
        ...filterConfig,
        tags: [...(filterConfig.tags || []), tagId]
      });
    }
  }, [filterConfig, setFilterConfig]);

  // Memoized clear tags handler
  const handleClearTags = useCallback(() => {
    setFilterConfig({
      ...filterConfig,
      tags: undefined
    });
  }, [filterConfig, setFilterConfig]);

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 lg:px-8 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Library
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {filteredBooks?.length || 0} books
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setShowFilters(!showFilters)}>
                <Filter size={20} />
                {!isTouchDevice && 'Filters'}
              </Button>

              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={clsx(
                    'p-2 transition-colors',
                    viewMode === 'grid'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  <Grid size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={clsx(
                    'p-2 transition-colors',
                    viewMode === 'list'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search books by title or author..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <FiltersPanel
              filterConfig={filterConfig}
              sortConfig={sortConfig}
              onFilterChange={setFilterConfig}
              onSortChange={setSortConfig}
              onClearFilters={clearFiltersAndUrl}
              activeTags={filterConfig.tags}
              onTagToggle={handleTagToggle}
              onClearTags={handleClearTags}
            />
          )}
        </div>
      </header>

      {/* Book Grid/List */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {paginatedBooks && paginatedBooks.length > 0 ? (
          <>
            <div className={clsx(
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                : 'space-y-4'
            )}>
              {paginatedBooks.map((book) => (
                <MemoizedBookCard
                  key={book.id}
                  book={book}
                  rating={ratingMap.get(book.id)}
                  viewMode={viewMode}
                  onDelete={handleDeleteBook}
                  onEdit={handleEditBook}
                  navigate={navigate}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <MemoizedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        ) : (
          <MemoizedEmptyLibraryState searchQuery={searchQuery} />
        )}
      </main>
    </div>
  );
}

interface FiltersPanelProps {
  filterConfig: FilterConfig;
  sortConfig: SortConfig;
  onFilterChange: (config: FilterConfig) => void;
  onSortChange: (config: SortConfig) => void;
  onClearFilters: () => void;
  activeTags?: string[];
  onTagToggle?: (tagId: string) => void;
  onClearTags?: () => void;
}

function FiltersPanel({ 
  filterConfig, 
  sortConfig, 
  onFilterChange, 
  onSortChange, 
  onClearFilters,
  activeTags = [],
  onTagToggle,
  onClearTags
}: FiltersPanelProps) {
  const formats = ['physical', 'kindle', 'kobo', 'audible', 'audiobook', 'pdf', 'other'];
  const [tagSearch, setTagSearch] = useState('');
  const debouncedTagSearch = useDebounce(tagSearch, 200);
  
  // Fetch tags with counts
  const tagsWithCounts = useLiveQuery(
    () => tagOperations.getAllWithCount(),
    []
  );

  // Get top 12 most common tags by default
  const commonTags = useMemo(() => {
    if (!tagsWithCounts) return [];
    return tagsWithCounts.slice(0, 12);
  }, [tagsWithCounts]);

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!tagsWithCounts) return [];
    if (!debouncedTagSearch.trim()) return commonTags;
    
    const query = debouncedTagSearch.toLowerCase();
    return tagsWithCounts.filter(tag => 
      tag.name.toLowerCase().includes(query)
    ).slice(0, 20); // Limit search results
  }, [tagsWithCounts, debouncedTagSearch, commonTags]);

  // Check if any tags are active
  const hasActiveTags = activeTags.length > 0;

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex flex-wrap gap-4">
        {/* Format Filter */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Format</span>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <button
                key={format}
                type="button"
                aria-label={`Filter by ${format} format`}
                onClick={() => {
                  const currentFormats = filterConfig.formats || [];
                  const newFormats = currentFormats.includes(format as BookFormat)
                    ? currentFormats.filter(f => f !== format)
                    : [...currentFormats, format as BookFormat];
                  onFilterChange({ ...filterConfig, formats: newFormats });
                }}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm transition-colors',
                  filterConfig.formats?.includes(format as BookFormat)
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                )}
              >
                {format}
              </button>
            ))}
          </div>
        </div>

        {/* Tag Filter */}
        {onTagToggle && (
          <div className="space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</span>
              {hasActiveTags && onClearTags && (
                <button
                  type="button"
                  onClick={onClearTags}
                  className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Clear all
                </button>
              )}
            </div>
            
            {/* Tag Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search tags..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="input pl-8 py-1.5 text-sm w-full"
              />
            </div>
            
            {/* Tag List */}
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredTags.map((tag: TagWithCount) => {
                const isSelected = activeTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onTagToggle(tag.id)}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
                      isSelected
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    )}
                    title={`${tag.name} (${tag.bookCount} books)`}
                  >
                    <TagIcon size={10} />
                    <span className="truncate max-w-[80px]">{tag.name}</span>
                    <span className="text-xs opacity-70">({tag.bookCount})</span>
                  </button>
                );
              })}
            </div>
            
            {/* Active tags indicator */}
            {hasActiveTags && (
              <p className="text-xs text-gray-500">
                {activeTags.length} tag{activeTags.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* Sort */}
        <div className="space-y-2">
          <label htmlFor="sort-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort By</label>
          <select
            id="sort-select"
            value={sortConfig.field}
            onChange={(e) => onSortChange({ ...sortConfig, field: e.target.value })}
            className="input text-sm"
          >
            <option value="title">Title</option>
            <option value="authors">Author</option>
            <option value="addedAt">Date Added</option>
            <option value="publishedYear">Published Year</option>
          </select>
        </div>

        {/* Clear Filters */}
        <div className="flex items-end">
          <Button variant="ghost" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
}

interface BookCardProps {
  book: BookType;
  rating?: number;
  viewMode: 'grid' | 'list';
  onDelete: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}

function BookCard({ book, rating, viewMode, onDelete, onEdit, navigate }: BookCardProps) {
  // Memoize the navigate function reference to prevent unnecessary re-renders
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  
  const handleClick = useCallback(() => {
    navigateRef.current(`/book/${book.id}`);
  }, [book.id]);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(book.id);
  }, [onEdit, book.id]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(book.id);
  }, [onDelete, book.id]);

  if (viewMode === 'list') {
    return (
      <Card hover className="overflow-hidden cursor-pointer" onClick={handleClick}>
        <div className="flex p-4 gap-4">
          <div className="flex-shrink-0 w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            <BookCover book={book} className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0 py-1">
            <div className="flex items-start justify-between">
              <div>
                <Link
                  to={`/book/${book.id}`}
                  className="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 truncate"
                >
                  {book.title}
                </Link>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {book.authors.join(', ')}
                </p>
              </div>
              <Badge variant="neutral">{book.format}</Badge>
            </div>
            
            {/* Notes excerpt */}
            {book.notes && (
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {book.notes.length > 150 ? book.notes.slice(0, 150) + '...' : book.notes}
                </p>
                {book.notes.length > 150 && (
                  <Link 
                    to={`/book/${book.id}`}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1 inline-block"
                  >
                    Show more
                  </Link>
                )}
              </div>
            )}
            
            <div className="mt-2 flex items-center gap-2">
              <Link to={`/book/${book.id}`} className="btn-secondary text-sm">
                View Details
              </Link>
              <Button variant="ghost" size="sm" onClick={handleEditClick}>
                <Edit size={14} />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDeleteClick}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
      <a
        href={`/book/${book.id}`}
        className="block cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          navigate(`/book/${book.id}`);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/book/${book.id}`);
          }
        }}
        tabIndex={0}
        aria-label={`View details for ${book.title}`}
      >
        <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 relative">
          <BookCover book={book} className="w-full h-full" />

          {/* Status badge */}
          <div className="absolute top-2 left-2">
            <StatusBadge status={book.readingStatus} size="sm" />
          </div>

          {/* Rating overlay - only show if book has a rating */}
          {rating !== undefined && rating > 0 && (
            <div
              className="absolute bottom-2 left-2 bg-black/60 dark:bg-black/80 rounded-lg px-1.5 py-1"
              role="img"
              aria-label={`Rating: ${rating} out of 5 stars`}
            >
              <StarRating rating={rating} size="sm" interactive={false} />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {book.title}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {book.authors.join(', ')}
          </p>
        </div>
      </a>

      {/* Edit button - positioned in top-right corner, separate from card link */}
      <button
        type="button"
        className="absolute top-2 right-2 p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:opacity-100 z-10"
        aria-label="Edit book"
        onClick={(e) => {
          e.preventDefault();
          onEdit(book.id);
        }}
        onKeyDown={(e) => {
          e.preventDefault();
        }}
      >
        <Edit size={16} />
      </button>
    </div>
  );
}

const MemoizedBookCard = memo(BookCard);

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <Button
        variant="ghost"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft size={20} />
      </Button>

      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }

          return (
            <button
              type="button"
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={clsx(
                'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                currentPage === pageNum
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight size={20} />
      </Button>
    </div>
  );
}

const MemoizedPagination = memo(Pagination);

interface EmptyLibraryStateProps {
  searchQuery: string;
}

function EmptyLibraryState({ searchQuery }: EmptyLibraryStateProps) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
        <Book className="text-gray-400" size={40} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {searchQuery ? 'No books found' : 'Your library is empty'}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Start building your collection by adding your first book'}
      </p>
      {!searchQuery && (
        <Link to="/add" className="btn-primary">
          <Plus size={20} />
          Add Your First Book
        </Link>
      )}
    </div>
  );
}

const MemoizedEmptyLibraryState = memo(EmptyLibraryState);
