import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Book, Plus, Camera, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '../components/common/Button';
import { CoverUpload } from '../components/image/CoverUpload';
import { searchBooks, searchByISBN, isValidISBN } from '../lib/api';
import { bookOperations } from '../lib/db';
import { useToastStore, useModalStore } from '../store/useStore';
import { useDebounce } from '../hooks/usePerformance';
import type { Book as BookType, BookFormat } from '../types';
import { clsx } from 'clsx';

export function AddBookPage() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { openModal } = useModalStore();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<'search' | 'isbn'>('search');
  const [isbnInput, setIsbnInput] = useState('');
  const [manualEntry, setManualEntry] = useState(false);
  const [newBook, setNewBook] = useState<Partial<BookType>>({
    title: '',
    authors: [],
    isbn13: '',
    format: 'physical',
  });
  
  const debouncedQuery = useDebounce(searchQuery, 500);
  
  // Check for mode parameter in URL to auto-open manual entry
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'manual') {
      setManualEntry(true);
      setSearchType('search');
    }
  }, [searchParams]);
  
  // Listen for barcode scanned events from the scanner
  useEffect(() => {
    const handleBarcodeScanned = (event: CustomEvent) => {
      const { text, format } = event.detail;
      console.log('[AddBookPage] Barcode scanned event received:', { text, format });
      
      // Auto-fill ISBN input and switch to ISBN search mode
      setIsbnInput(text);
      setSearchType('isbn');
      setManualEntry(false);
      
      addToast({
        type: 'success',
        message: `Scanned: ${text}`,
        duration: 2000
      });
    };
    
    window.addEventListener('barcode:scanned', handleBarcodeScanned as EventListener);
    
    return () => {
      window.removeEventListener('barcode:scanned', handleBarcodeScanned as EventListener);
    };
  }, [addToast]);
  
  // Search when query changes
  const handleSearch = async () => {
    if (!debouncedQuery.trim()) return;
    
    setLoading(true);
    try {
      const results = await searchBooks(debouncedQuery);
      setSearchResults(results);
    } catch (error) {
      addToast({ type: 'error', message: 'Search failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };
  
  // ISBN lookup
  const handleIsbnLookup = async () => {
    const cleanIsbn = isbnInput.replace(/[-\s]/g, '');
    
    if (!isValidISBN(cleanIsbn)) {
      addToast({ type: 'error', message: 'Please enter a valid ISBN' });
      return;
    }
    
    setLoading(true);
    try {
      // Try Open Library first
      let book = await searchByISBN(cleanIsbn);
      
      // Fallback to Google Books
      if (!book) {
        const googleResults = await searchBooks(cleanIsbn);
        book = googleResults.find(b => b.isbn13 === cleanIsbn) || null;
      }
      
      if (book) {
        setSearchResults([book]);
      } else {
        // No book found, offer manual entry
        setNewBook(prev => ({ ...prev, isbn: cleanIsbn }));
        setManualEntry(true);
        addToast({ type: 'info', message: 'Book not found. Please enter details manually.' });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'ISBN lookup failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };
  
  // Add book to collection
  const handleAddBook = async (book: BookType) => {
    try {
      // Check for duplicates
      const existingByIsbn = book.isbn13 ? await bookOperations.getByIsbn(book.isbn13) : null;
      
      if (existingByIsbn) {
        addToast({ type: 'warning', message: 'This book is already in your collection' });
        return;
      }
      
      await bookOperations.add(book);
      addToast({ type: 'success', message: 'Book added to your collection!' });
      navigate('/library');
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to add book. Please try again.' });
    }
  };
  
  // Manual entry
  const handleManualAdd = async () => {
    if (!newBook.title) {
      addToast({ type: 'error', message: 'Please enter a book title' });
      return;
    }
    
    const book: BookType = {
      id: crypto.randomUUID(),
      title: newBook.title!,
      authors: newBook.authors || [],
      isbn13: newBook.isbn13,
      coverUrl: newBook.coverUrl,
      description: newBook.description,
      publisher: newBook.publisher,
      publishedYear: newBook.publishedYear,
      pageCount: newBook.pageCount,
      format: newBook.format as BookType['format'],
      addedAt: new Date(),
      externalIds: {},
      needsSync: true,
      localOnly: true
    };
    
    await handleAddBook(book);
  };
  
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Add New Book
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Search, scan, or manually add books to your collection
        </p>
      </header>
      
      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-6">
        {/* Search Type Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => { setSearchType('search'); setManualEntry(false); }}
            className={clsx(
              'flex-1 py-3 rounded-lg font-medium transition-colors',
              searchType === 'search' && !manualEntry
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <Search size={20} className="inline mr-2" />
            Search
          </button>
          <button
            type="button"
            onClick={() => { setSearchType('isbn'); setManualEntry(false); }}
            className={clsx(
              'flex-1 py-3 rounded-lg font-medium transition-colors',
              searchType === 'isbn'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <Camera size={20} className="inline mr-2" />
            ISBN / Barcode
          </button>
          <button
            type="button"
            onClick={() => { setManualEntry(true); setSearchType('search'); }}
            className={clsx(
              'flex-1 py-3 rounded-lg font-medium transition-colors',
              manualEntry
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <Book size={20} className="inline mr-2" />
            Manual Entry
          </button>
        </div>
        
        {/* Search Input */}
        {(searchType === 'search' && !manualEntry) && (
          <div className="mb-6">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by title, author, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="input pl-10"
                />
              </div>
              <Button onClick={handleSearch} loading={loading}>
                Search
              </Button>
            </div>
          </div>
        )}
        
        {/* ISBN Input */}
        {(searchType === 'isbn' && !manualEntry) && (
          <div className="mb-6">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Camera className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Enter ISBN or scan barcode..."
                  value={isbnInput}
                  onChange={(e) => setIsbnInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleIsbnLookup()}
                  className="input pl-10"
                />
              </div>
              <Button 
                onClick={() => openModal('barcodeScanner')}
                variant="secondary"
                aria-label="Scan barcode"
                title="Scan barcode"
              >
                <Camera size={20} />
              </Button>
              <Button onClick={handleIsbnLookup} loading={loading}>
                Lookup
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Supports ISBN-10 and ISBN-13 formats
            </p>
          </div>
        )}
        
        {/* Manual Entry Form */}
        {manualEntry && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Manual Entry</h2>
            <div className="space-y-4">
              <CoverUpload
                value={newBook.coverUrl}
                onChange={(coverUrl) => setNewBook({ ...newBook, coverUrl })}
                bookTitle={newBook.title || 'book'}
              />
              
              <Input
                label="Title *"
                value={newBook.title}
                onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                placeholder="Enter book title"
              />
              <Input
                label="Author"
                value={newBook.authors?.join(', ') || ''}
                onChange={(e) => setNewBook({ ...newBook, authors: e.target.value.split(',').map(a => a.trim()).filter(Boolean) })}
                placeholder="Enter author name(s), separated by commas"
              />
              <Input
                label="ISBN"
                value={newBook.isbn13 || ''}
                onChange={(e) => setNewBook({ ...newBook, isbn13: e.target.value })}
                placeholder="Enter ISBN (optional)"
              />
              <div className="space-y-1">
                <label htmlFor="book-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Format
                </label>
                <select
                  id="book-format"
                  value={newBook.format}
                  onChange={(e) => setNewBook({ ...newBook, format: e.target.value as BookFormat })}
                  className="input"
                >
                  <option value="physical">Physical Book</option>
                  <option value="kindle">Kindle</option>
                  <option value="kobo">Kobo</option>
                  <option value="audible">Audible</option>
                  <option value="audiobook">Audiobook</option>
                  <option value="pdf">PDF</option>
                  <option value="other">Other</option>
                </select>
              </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleManualAdd} className="flex-1">
                <Plus size={20} />
                Add Book
              </Button>
              <Button type="button" variant="secondary" onClick={() => setManualEntry(false)}>
                Cancel
              </Button>
            </div>
            </div>
          </Card>
        )}
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Search Results ({searchResults.length})
            </h2>
            
            {searchResults.map((book) => (
              <SearchResultCard
                key={book.id}
                book={book}
                onAdd={() => handleAddBook(book)}
              />
            ))}
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-primary-600" size={48} />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Searching...</p>
          </div>
        )}
        
        {/* Empty State */}
        {!loading && searchResults.length === 0 && !manualEntry && searchType === 'search' && (
          <div className="text-center py-12">
            <Search className="mx-auto text-gray-300 dark:text-gray-600" size={48} />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Search for books by title, author, or keywords
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

interface SearchResultCardProps {
  book: BookType;
  onAdd: () => void;
}

function SearchResultCard({ book, onAdd }: SearchResultCardProps) {
  return (
    <Card className="overflow-hidden">
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
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {book.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {book.authors.join(', ')}
          </p>
          {(book.publishedYear || book.publisher) && (
            <p className="text-xs text-gray-500 mt-1">
              {[book.publishedYear, book.publisher].filter(Boolean).join(' • ')}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={onAdd}>
              <Plus size={16} />
              Add to Collection
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
