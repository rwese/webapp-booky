import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Trash2, Book, Calendar, User, Building, 
  Tag, Star, Clock, Check, X, ExternalLink, Share2, Heart
} from 'lucide-react';
import { Button, Card, Badge, Input } from '../components/common/Button';
import { StarRating, StarRatingDisplay } from '../components/forms/StarRating';
import { ReviewEditor, ReviewDisplay } from '../components/forms/ReviewEditor';
import { TagInput, TagBadge, TagManager } from '../components/forms/TagInput';
import { CollectionSelector, CollectionBadge } from '../components/forms/CollectionManager';
import { bookOperations, ratingOperations, tagOperations, collectionOperations } from '../lib/db';
import { formatISBN } from '../lib/api';
import { useToastStore, useLibraryStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Book as BookType, Rating, Tag as TagType, Collection } from '../types';
import { clsx } from 'clsx';

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  
  const [book, setBook] = useState<BookType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [showReviewEditor, setShowReviewEditor] = useState(false);
  const [bookTags, setBookTags] = useState<TagType[]>([]);
  const [bookCollections, setBookCollections] = useState<Collection[]>([]);
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [previousRating, setPreviousRating] = useState<number>(0);
  const [currentReview, setCurrentReview] = useState<string>('');

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
        
        // Load related data
        const [tags, rating] = await Promise.all([
          tagOperations.getBookTags(id),
          ratingOperations.getByBookId(id)
        ]);
        
        setBookTags(tags);
        setPreviousRating(rating?.stars || 0);
        setCurrentRating(rating?.stars || 0);
        setCurrentReview(rating?.review || '');
        
        // Load collections
        await loadBookCollections(id);
        
      } catch (error) {
        console.error('Failed to load book:', error);
        addToast({ type: 'error', message: 'Failed to load book details' });
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [id, navigate, addToast, loadBookCollections]);

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
      setPreviousRating(rating);
      
      addToast({ type: 'success', message: 'Rating saved!' });
    } catch (error) {
      console.error('Failed to save rating:', error);
      addToast({ type: 'error', message: 'Failed to save rating' });
    }
  }, [book, currentReview, addToast]);

  // Handle review save
  const handleReviewSave = useCallback(async (review: string) => {
    if (!book) return;
    
    try {
      const ratingRecord: Rating = {
        id: crypto.randomUUID(),
        bookId: book.id,
        stars: currentRating,
        review: review,
        reviewCreatedAt: currentReview ? undefined : new Date(),
        updatedAt: new Date(),
        containsSpoilers: false
      };
      
      await ratingOperations.upsert(ratingRecord);
      setCurrentReview(review);
      setShowReviewEditor(false);
      
      addToast({ type: 'success', message: 'Review saved!' });
    } catch (error) {
      console.error('Failed to save review:', error);
      addToast({ type: 'error', message: 'Failed to save review' });
    }
  }, [book, currentRating, currentReview, addToast]);

  // Handle tags change
  const handleTagsChange = useCallback(async (tags: TagType[]) => {
    if (!book) return;
    
    try {
      // Remove all existing tags
      const existingTags = await tagOperations.getBookTags(book.id);
      for (const tag of existingTags) {
        await tagOperations.removeTagFromBook(book.id, tag.id);
      }
      
      // Add new tags
      for (const tag of tags) {
        await tagOperations.addTagToBook(book.id, tag.id);
      }
      
      setBookTags(tags);
      addToast({ type: 'success', message: 'Tags updated!' });
    } catch (error) {
      console.error('Failed to update tags:', error);
      addToast({ type: 'error', message: 'Failed to update tags' });
    }
  }, [book, addToast]);


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
          <p className="text-gray-500 mb-4">This book doesn't exist or has been removed.</p>
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
              {book.coverUrl ? (
                <img 
                  src={book.coverUrl} 
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Book size={48} className="text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Book Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{book.title}</h2>
            
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-1">
              by {book.authors.join(', ')}
            </p>
            
            <div className="flex items-center gap-2 mb-4">
              
              <Badge variant="neutral">{book.format}</Badge>
            </div>

            {/* Rating Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <StarRating 
                    rating={currentRating} 
                    onRatingChange={handleRatingChange}
                    interactive={true}
                    size="lg"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  {currentRating > 0 ? `Your rating: ${currentRating.toFixed(1)} stars` : 'Rate this book'}
                </div>
              </div>
              
              {currentReview ? (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{currentReview}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-1"
                    onClick={() => setShowReviewEditor(true)}
                  >
                    Edit Review
                  </Button>
                </div>
              ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowReviewEditor(true)}
              >
                Write a Review
              </Button>
              )}
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
                onClick={() => setShowTagManager(true)}
              >
                <Tag size={16} />
                Manage Tags
              </Button>
            </div>
          </div>
        </div>

        {/* Collections Section */}
        {showCollectionSelector && (
          <Card className="p-4 mb-6">
            <h3 className="font-semibold mb-3">Add to Collections</h3>
            <CollectionSelector
              selectedCollections={bookCollections}
              onCollectionsChange={async (collections) => {
                // This would need implementation to add/remove from collections
                await loadBookCollections(book.id);
              }}
            />
          </Card>
        )}

        {/* Tags Section */}
        {bookTags.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} />
              <h3 className="font-semibold text-gray-900 dark:text-white">Tags</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {bookTags.map(tag => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          </div>
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

        {/* Book Metadata */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {book.isbn && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                  <Tag size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">ISBN</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatISBN(book.isbn)}
                  </p>
                </div>
              </div>
            )}
            
            {book.publishedYear && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                  <Calendar size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Published</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {book.publishedYear}
                  </p>
                </div>
              </div>
            )}
            
            {book.publisher && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                  <Building size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Publisher</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {book.publisher}
                  </p>
                </div>
              </div>
            )}
            
            {book.pageCount && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                  <Book size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pages</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {book.pageCount}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                <Clock size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Added to Library</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(book.addedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          
          {/* External Links */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {book.externalIds.openLibrary && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open(`https://openlibrary.org/works/${book.externalIds.openLibrary}`, '_blank')}
              >
                <ExternalLink size={14} />
                View on Open Library
              </Button>
            )}
            {book.externalIds.googleBooks && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open(`https://books.google.com/books?id=${book.externalIds.googleBooks}`, '_blank')}
              >
                <ExternalLink size={14} />
                View on Google Books
              </Button>
            )}
          </div>
        </Card>

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
          
        </Card>
      </main>

      {/* Tag Manager Modal */}
      {showTagManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <TagManager onClose={() => setShowTagManager(false)} />
        </div>
      )}

      {/* Review Editor Modal */}
      {showReviewEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Write Review</h2>
            </div>
            <div className="p-4">
              <ReviewEditor
                initialReview={currentReview}
                onSave={handleReviewSave}
                onCancel={() => setShowReviewEditor(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}