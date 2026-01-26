import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Book, Calendar, Building,
  Tag, Clock, ExternalLink, Share2, Heart, RefreshCw, Folder,
  BookOpen, CheckCircle, Info, Globe, Layers
} from 'lucide-react';
import { Button, Card, Badge } from '../components/common/Button';
import { StarRating } from '../components/forms/StarRating';
import { CollectionSelector, CollectionBadge } from '../components/forms/CollectionManager';
import { CategorySelector, CategoryBadge } from '../components/forms/CategorySelector';
import { StatusSelector, StatusBadge } from '../components/forms/StatusSelector';
import { NotesDisplay } from '../components/forms/NotesEditor';
import { MetadataGroup, MetadataItem, MetadataGrid } from '../components/common/MetadataGroup';
import { bookOperations, ratingOperations, collectionOperations, readingLogOperations } from '../lib/db';
import { useRating } from '../hooks/useBooks';
import { formatISBN } from '../lib/barcodeUtils';
import { useToastStore } from '../store/useStore';
import { useBookMetadataRefresh } from '../hooks/useBookMetadataRefresh';
import type { Book as BookType, Rating, Collection, ReadingStatus, ReadingLog } from '../types';
import { BookCover } from '../components/image';


export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  
  const [book, setBook] = useState<BookType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [bookCollections, setBookCollections] = useState<Collection[]>([]);
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [currentReview, setCurrentReview] = useState<string>('');
  const [currentStatus, setCurrentStatus] = useState<ReadingStatus | undefined>(undefined);
  const [readingLog, setReadingLog] = useState<ReadingLog | undefined>(undefined);
  const [readingHistory, setReadingHistory] = useState<ReadingLog[]>([]);
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  // Metadata refresh hook
  const { isRefreshing, error, refreshMetadata } = useBookMetadataRefresh();

  // Load rating for this book
  const existingRating = useRating(id || '');
  
  // Initialize rating from loaded rating or default to 0
  useEffect(() => {
    if (existingRating) {
      setCurrentRating(existingRating.stars);
      if (existingRating.review) {
        setCurrentReview(existingRating.review);
      }
    }
  }, [existingRating]);

  // Load book collections helper
  const loadBookCollections = useCallback(async (bookId: string): Promise<Collection[]> => {
    const allCollections = await collectionOperations.getAll();
    const bookInCollections: Collection[] = [];
    
    for (const collection of allCollections) {
      if (collection.isSmart) {
        // For smart collections, we'd need to evaluate rules
        // For now, just include them
        bookInCollections.push(collection);
      } else {
        const booksInCollection = await collectionOperations.getBooksInCollection(collection.id);
        if (booksInCollection.some((b) => b?.id === bookId)) {
          bookInCollections.push(collection);
        }
      }
    }
    
    setBookCollections(bookInCollections);
    return bookInCollections;
  }, []);

  // Load reading history
  const loadReadingHistory = useCallback(async (bookId: string) => {
    const allLogs = await readingLogOperations.getAll();
    const bookLogs = allLogs
      .filter(log => log.bookId === bookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setReadingHistory(bookLogs);
  }, []);

  useEffect(() => {
    const loadBook = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const loadedBook = await bookOperations.getById(id);
        if (!loadedBook) {
          addToast({ type: 'error', message: 'Book not found' });
          navigate('/library');
          return;
        }
        setBook(loadedBook);
        
        // Load collections
        await loadBookCollections(id);
        
        // Load reading status
        const readingLog = await readingLogOperations.getByBookId(id);
        setCurrentStatus(readingLog?.status);
        setReadingLog(readingLog);

        // Load reading history
        await loadReadingHistory(id);
        
      } catch (error) {
        console.error('Failed to load book:', error);
        addToast({ type: 'error', message: 'Failed to load book details' });
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [id, navigate, addToast, loadBookCollections, loadReadingHistory]);

  // Handle rating change
  const handleRatingChange = useCallback(async (rating: number) => {
    if (!book) return;
    
    try {
      const ratingRecord: Rating = {
        id: crypto.randomUUID(),
        bookId: book.id,
        stars: rating,
        review: currentReview,
        updatedAt: new Date(),
        containsSpoilers: false
      };
      
      await ratingOperations.upsert(ratingRecord);
      setCurrentRating(rating);
      
      addToast({ type: 'success', message: 'Rating saved!' });
    } catch (error) {
      console.error('Failed to save rating:', error);
      addToast({ type: 'error', message: 'Failed to save rating' });
    }
  }, [book, currentReview, addToast]);

  // Handle book deletion
  const handleDelete = useCallback(async () => {
    if (!book) return;
    
    if (confirm('Are you sure you want to delete this book from your collection?')) {
      try {
        await bookOperations.delete(book.id);
        addToast({ type: 'success', message: 'Book removed from collection' });
        navigate('/library');
      } catch (error) {
        console.error('Failed to delete book:', error);
        addToast({ type: 'error', message: 'Failed to delete book' });
      }
    }
  }, [book, navigate, addToast]);

  // Handle metadata refresh
  const handleRefresh = useCallback(async () => {
    if (!book || !book.isbn13) return;

    try {
      const metadata = await refreshMetadata(book.id, book.isbn13);
      
      if (metadata) {
        // Merge with existing book data, preserving localOnly fields and user data
        const updatedBook: BookType = {
          ...book,
          ...metadata,
          // Ensure localOnly fields are preserved
          addedAt: book.addedAt,
          localOnly: book.localOnly
        };
        
        // Update in IndexedDB
        await bookOperations.update(book.id, updatedBook);
        
        // Update local state
        setBook(updatedBook);
        
        addToast({ type: 'success', message: 'Metadata refreshed!' });
      } else if (error) {
        addToast({ type: 'error', message: error.message });
      }
    } catch (err) {
      console.error('Failed to refresh metadata:', err);
      addToast({ type: 'error', message: 'Failed to refresh book metadata' });
    }
  }, [book, refreshMetadata, error, addToast]);

  // Handle status change with history tracking
  const handleStatusChange = useCallback(async (status: ReadingStatus) => {
    if (!book) return;

    // Create reading log entry
    const readingLogData: ReadingLog = {
      id: readingLog?.id || crypto.randomUUID(),
      bookId: book.id,
      status,
      startedAt: status === 'currently_reading' ? new Date() : readingLog?.startedAt,
      finishedAt: status === 'read' ? new Date() : (status === 'dnf' ? new Date() : undefined),
      createdAt: readingLog?.createdAt || new Date(),
      updatedAt: new Date()
    };

    await readingLogOperations.upsert(readingLogData);
    setCurrentStatus(status);
    setReadingLog(readingLogData);

    // Add to reading history
    const historyEntry: ReadingLog = {
      ...readingLogData,
      id: crypto.randomUUID(),
      createdAt: new Date()
    };
    setReadingHistory(prev => [...prev, historyEntry].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  }, [book, readingLog]);

  // Handle category changes
  const handleCategoriesChange = useCallback(async (categories: string[]) => {
    if (!book) return;
    
    try {
      const updatedBook: BookType = {
        ...book,
        categories
      };
      
      await bookOperations.update(book.id, updatedBook);
      setBook(updatedBook);
      setShowCategorySelector(false);
      
      addToast({ type: 'success', message: 'Categories updated!' });
    } catch (error) {
      console.error('Failed to update categories:', error);
      addToast({ type: 'error', message: 'Failed to update categories' });
    }
  }, [book, addToast]);

  // Handle notes save
  const handleNotesSave = useCallback(async (notes: string) => {
    if (!book) return;
    
    try {
      const updatedBook: BookType = {
        ...book,
        notes,
        notesUpdatedAt: new Date()
      };
      
      await bookOperations.update(book.id, updatedBook);
      setBook(updatedBook);
      setShowNotesEditor(false);
      
      addToast({ type: 'success', message: 'Notes saved!' });
    } catch (error) {
      console.error('Failed to save notes:', error);
      addToast({ type: 'error', message: 'Failed to save notes' });
    }
  }, [book, addToast]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Book size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Book Not Found</h2>
          <p className="text-gray-500 mb-4">This book doesn&apos;t exist or has been removed.</p>
          <Button onClick={() => navigate('/library')}>Back to Library</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Book Details</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/edit/${book.id}`)}>
                <Edit size={16} />
              </Button>
              {book.isbn13 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh metadata"
                  title="Refresh metadata"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                </Button>
              )}
              <Button variant="ghost" size="sm">
                <Share2 size={16} />
              </Button>
              <Button variant="ghost" size="sm">
                <Heart size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-6">
        {/* Book Overview */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Cover */}
          <div className="flex-shrink-0">
            <div className="w-48 h-72 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-lg">
              <BookCover book={book} className="w-full h-full" />
            </div>
          </div>

          {/* Book Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{book.title}</h2>
            
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-1">
              by {book.authors.join(', ')}
            </p>

            {/* Tags Display */}
            {book.tags && book.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {book.tags.map((tag) => (
                  <Badge key={tag} variant="primary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Rating Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <StarRating 
                rating={currentRating} 
                onRatingChange={handleRatingChange}
                interactive={true}
                size="lg"
              />
              
              {currentReview ? (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{currentReview}</p>
                </div>
              ) : null}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCollectionSelector(!showCollectionSelector)}
              >
                <Tag size={16} />
                Collections
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCategorySelector(!showCategorySelector)}
              >
                <Folder size={16} />
                Categories
              </Button>
            </div>

            <div className="mt-4">
              <StatusSelector
                bookId={book.id}
                currentStatus={currentStatus}
                onStatusChange={handleStatusChange}
                variant="tabs"
              />
            </div>
          </div>
        </div>

        {/* Collections Section */}
        {showCollectionSelector && (
          <Card className="p-4 mb-6">
            <h3 className="font-semibold mb-3">Add to Collections</h3>
            <CollectionSelector
            selectedCollections={bookCollections}
            onCollectionsChange={async (_collections) => {
              // This would need implementation to add/remove from collections
              await loadBookCollections(book.id);
            }}
          />
          </Card>
        )}

        {/* Categories Section */}
        {showCategorySelector && (
          <Card className="p-4 mb-6">
            <h3 className="font-semibold mb-3">Manage Categories</h3>
            <CategorySelector
              _bookId={book.id}
              selectedCategories={book.categories || []}
              onCategoriesChange={handleCategoriesChange}
            />
          </Card>
        )}

        {/* Collections Section */}
        {bookCollections.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} />
              <h3 className="font-semibold text-gray-900 dark:text-white">Collections</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {bookCollections.map(collection => (
                <CollectionBadge key={collection.id} collection={collection} />
              ))}
            </div>
          </div>
        )}

        {/* Categories Section */}
        {(book.categories && book.categories.length > 0) && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Folder size={16} />
              <h3 className="font-semibold text-gray-900 dark:text-white">Categories</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {book.categories.map(category => (
                <CategoryBadge key={category} category={category} />
              ))}
            </div>
          </div>
        )}

        {/* Book Metadata - Grouped */}
        <div className="space-y-4 mb-6">
          {/* Group 1: Basic Information */}
          <MetadataGroup
            title="Basic Information"
            icon={<Info size={18} />}
            defaultExpanded={true}
          >
            <MetadataGrid columns={2}>
              {book.isbn13 && (
                <MetadataItem
                  label="ISBN"
                  value={formatISBN(book.isbn13)}
                  icon={<Tag size={14} />}
                />
              )}
              {book.publishedYear && (
                <MetadataItem
                  label="Published"
                  value={book.publishedYear}
                  icon={<Calendar size={14} />}
                />
              )}
              {book.pageCount && (
                <MetadataItem
                  label="Pages"
                  value={book.pageCount}
                  icon={<Book size={14} />}
                />
              )}
              <MetadataItem
                label="Added to Library"
                value={new Date(book.addedAt).toLocaleDateString()}
                icon={<Clock size={14} />}
              />
            </MetadataGrid>
          </MetadataGroup>

          {/* Group 2: Publishing Details */}
          <MetadataGroup
            title="Publishing Details"
            icon={<Building size={18} />}
            defaultExpanded={true}
          >
            <MetadataGrid columns={2}>
              {book.publisher && (
                <MetadataItem
                  label="Publisher"
                  value={book.publisher}
                  icon={<Building size={14} />}
                />
              )}
              {book.languageCode && (
                <MetadataItem
                  label="Language"
                  value={book.languageCode.toUpperCase()}
                  icon={<Globe size={14} />}
                />
              )}
              {(book.seriesName || book.seriesVolume) && (
                <MetadataItem
                  label="Series"
                  value={book.seriesVolume 
                    ? `${book.seriesName} #${book.seriesVolume}`
                    : book.seriesName}
                  icon={<Layers size={14} />}
                />
              )}
            </MetadataGrid>
            
            {/* External Links */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {book.externalIds.openLibrary && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.open(`https://openlibrary.org/works/${book.externalIds.openLibrary}`, '_blank')}
                >
                  <ExternalLink size={14} />
                  Open Library
                </Button>
              )}
              {book.externalIds.googleBooks && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.open(`https://books.google.com/books?id=${book.externalIds.googleBooks}`, '_blank')}
                >
                  <ExternalLink size={14} />
                  Google Books
                </Button>
              )}
            </div>
          </MetadataGroup>

          {/* Group 3: Collection & Organization */}
          <MetadataGroup
            title="Collection & Organization"
            icon={<Folder size={18} />}
            defaultExpanded={true}
          >
            <div className="space-y-4">
              {/* Collections */}
              {bookCollections.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Collections</p>
                  <div className="flex flex-wrap gap-2">
                    {bookCollections.map(collection => (
                      <CollectionBadge key={collection.id} collection={collection} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Categories */}
              {(book.categories && book.categories.length > 0) && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {book.categories.map(category => (
                      <CategoryBadge key={category} category={category} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Tags */}
              {book.tags && book.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {book.tags.map((tag) => (
                      <Badge key={tag} variant="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rating */}
              {currentRating > 0 && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Your Rating</p>
                  <StarRating 
                    rating={currentRating} 
                    onRatingChange={handleRatingChange}
                    interactive={true}
                    size="md"
                  />
                </div>
              )}
            </div>
          </MetadataGroup>

          {/* Group 4: Reading Progress */}
          <MetadataGroup
            title="Reading Progress"
            icon={<BookOpen size={18} />}
            defaultExpanded={true}
          >
            <MetadataGrid columns={2}>
              <MetadataItem
                label="Status"
                value={
                  <StatusBadge status={currentStatus} />
                }
                icon={<BookOpen size={14} />}
              />
              <MetadataItem
                label="Added"
                value={new Date(book.addedAt).toLocaleDateString()}
                icon={<Clock size={14} />}
              />
              {currentStatus === 'read' && readingLog?.finishedAt && (
                <MetadataItem
                  label="Finished"
                  value={new Date(readingLog.finishedAt).toLocaleDateString()}
                  icon={<CheckCircle size={14} />}
                />
              )}
            </MetadataGrid>
          </MetadataGroup>
        </div>

          {/* Personal Notes */}
          {(book.notes || true) && (
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">Personal Notes</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowNotesEditor(true)}>
                  {book.notes ? 'Edit' : 'Add Notes'}
                </Button>
              </div>
              <NotesDisplay
                notes={book.notes}
                maxLength={300}
                onEdit={() => setShowNotesEditor(true)}
              />
              {book.notesUpdatedAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Last updated: {new Date(book.notesUpdatedAt).toLocaleDateString()}
                </p>
              )}
            </Card>
          )}

        {/* Description */}
        {book.description && (
          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Description</h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {book.description}
              </p>
            </div>
          </Card>
        )}

        {/* Reading History */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Reading History</h3>
          {readingHistory.length > 0 ? (
            <div className="space-y-3">
              {readingHistory.map((log, index) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    log.status === 'read' ? 'bg-green-500' :
                    log.status === 'currently_reading' ? 'bg-blue-500' :
                    log.status === 'want_to_read' ? 'bg-gray-400' : 'bg-red-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-gray-900 dark:text-white">
                      Status changed to <span className="font-medium capitalize">{log.status.replace(/_/g, ' ')}</span>
                    </p>
                    <p className="text-gray-500 text-xs">
                      {new Date(log.createdAt).toLocaleDateString()} at {new Date(log.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  {index === 0 && (
                    <Badge variant="primary">Latest</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No reading history yet. Status changes will be recorded here.</p>
          )}
        </Card>
      </main>

      {/* Notes Editor Modal */}
      {showNotesEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Notes</h2>
            </div>
            <div className="p-4">
              <NotesDisplay
                notes={book.notes}
                maxLength={300}
                onEdit={() => setEditingNotes(true)}
              />
              {book.notes && !editingNotes && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setEditingNotes(true)}
                >
                  Edit Notes
                </Button>
              )}
              {(editingNotes || !book.notes) && (
                <div className="mt-4">
                  <textarea
                    id="book-notes-detail"
                    value={book.notes || ''}
                    onChange={(e) => {
                      const updatedBook = { ...book, notes: e.target.value };
                      setBook(updatedBook);
                    }}
                    placeholder="Add your personal notes about this book... (max 2000 characters)"
                    className="input min-h-[150px] resize-y w-full"
                    rows={6}
                    maxLength={2000}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className={`text-xs ${
                      (book.notes?.length || 0) > 1800 
                        ? 'text-orange-500 dark:text-orange-400' 
                        : 'text-gray-500'
                    }`}>
                      {(book.notes?.length || 0)} / 2000 characters
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          setShowNotesEditor(false);
                          setEditingNotes(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => handleNotesSave(book.notes || '')}
                      >
                        Save Notes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}