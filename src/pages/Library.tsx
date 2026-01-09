import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, Grid, List, Book, Plus, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { Card, Badge, Button } from '../components/common/Button';
import { useFilteredBooks } from '../hooks/useBooks';
import { useLibraryStore, useToastStore } from '../store/useStore';
import { useDebounce, useIsTouchDevice } from '../hooks/useOffline';
import { bookOperations } from '../lib/db';
import type { Book as BookType, FilterConfig, SortConfig } from '../types';
import { clsx } from 'clsx';

export function LibraryPage() {
  const { viewMode, setViewMode, sortConfig, setSortConfig, filterConfig, setFilterConfig, clearFilters } = useLibraryStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const isTouchDevice = useIsTouchDevice();
  
  // Apply filters and sorting
  const filteredBooks = useFilteredBooks(
    { ...filterConfig, search: debouncedSearch },
    sortConfig
  );
  
  // Pagination
  const itemsPerPage = isTouchDevice ? 10 : 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil((filteredBooks?.length || 0) / itemsPerPage);
  const paginatedBooks = filteredBooks?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const handleDeleteBook = async (bookId: string) => {
    try {
      await bookOperations.delete(bookId);
      addToast({ type: 'success', message: 'Book removed from collection' });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to remove book' });
    }
  };
  
  const handleEditBook = (bookId: string) => {
    navigate(`/edit/${bookId}`);
  };
  
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
              onClearFilters={clearFilters}
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
                <BookCard
                  key={book.id}
                  book={book}
                  viewMode={viewMode}
                  onDelete={() => handleDeleteBook(book.id)}
                  onEdit={() => handleEditBook(book.id)}
                  navigate={navigate}
                />
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        ) : (
          <EmptyLibraryState searchQuery={searchQuery} />
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
}

function FiltersPanel({ filterConfig, sortConfig, onFilterChange, onSortChange, onClearFilters }: FiltersPanelProps) {
  const formats = ['physical', 'kindle', 'kobo', 'audible', 'audiobook', 'pdf', 'other'];
  
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
                  const newFormats = currentFormats.includes(format as any)
                    ? currentFormats.filter(f => f !== format)
                    : [...currentFormats, format as any];
                  onFilterChange({ ...filterConfig, formats: newFormats });
                }}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm transition-colors',
                  filterConfig.formats?.includes(format as any)
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                )}
              >
                {format}
              </button>
            ))}
          </div>
        </div>
        
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
  viewMode: 'grid' | 'list';
  onDelete: () => void;
  onEdit: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

function BookCard({ book, viewMode, onDelete, onEdit, navigate }: BookCardProps) {
  if (viewMode === 'list') {
    return (
      <Card hover className="overflow-hidden cursor-pointer" onClick={() => navigate(`/book/${book.id}`)}>
        <div className="flex p-4 gap-4">
          <div className="flex-shrink-0 w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            {book.coverUrl ? (
              <img 
                src={book.coverUrl} 
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Book className="text-gray-400" size={32} />
              </div>
            )}
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
            <div className="mt-2 flex items-center gap-2">
              <Link to={`/book/${book.id}`} className="btn-secondary text-sm">
                View Details
              </Link>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit size={14} />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card hover className="overflow-hidden cursor-pointer" onClick={() => navigate(`/book/${book.id}`)}>
      <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700">
        {book.coverUrl ? (
          <img 
            src={book.coverUrl} 
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Book className="text-gray-400" size={48} />
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
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-2 w-full"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Edit size={14} />
          Edit
        </Button>
      </div>
    </Card>
  );
}

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
