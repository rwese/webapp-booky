import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { BookForm } from '../components/forms/BookForm';
import { bookOperations, tagOperations, coverImageOperations, readingLogOperations } from '../lib/db';
import { useToastStore } from '../store/useStore';
import { useBookMetadataRefresh } from '../hooks/useBookMetadataRefresh';
import { StatusSelector } from '../components/forms/StatusSelector';
import type { Book as BookType, Tag as TagType, ReadingStatus } from '../types';

export function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  
  const [book, setBook] = useState<BookType | null>(null);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ReadingStatus | undefined>(undefined);
  const { isRefreshing, refreshMetadata } = useBookMetadataRefresh();

  useEffect(() => {
    const loadBook = async () => {
      if (!id) {
        addToast({ type: 'error', message: 'Book ID is required' });
        navigate('/library');
        return;
      }

      try {
        const loadedBook = await bookOperations.getById(id);
        if (!loadedBook) {
          addToast({ type: 'error', message: 'Book not found' });
          navigate('/library');
          return;
        }

        // Resolve localCoverPath to a URL if coverUrl is not set
        // This ensures cover images from imports are visible in the edit view
        if (!loadedBook.coverUrl && loadedBook.localCoverPath) {
          const coverUrl = await coverImageOperations.getUrl(loadedBook.localCoverPath);
          if (coverUrl) {
            loadedBook.coverUrl = coverUrl;
          }
        }

        setBook(loadedBook);
        
        // Load existing tags for this book
        const bookTags = await tagOperations.getBookTags(id);
        setTags(bookTags);

        // Load reading status
        const readingLog = await readingLogOperations.getByBookId(id);
        setCurrentStatus(readingLog?.status);
      } catch (error) {
        console.error('Failed to load book:', error);
        addToast({ type: 'error', message: 'Failed to load book' });
        navigate('/library');
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [id, navigate, addToast]);

  const handleSave = async (updatedBook: BookType, selectedTags: TagType[]) => {
    if (!id) return;

    setSaving(true);
    try {
      await bookOperations.update(id, updatedBook);
      
      // Sync tags: get current tags and update associations
      const currentTags = await tagOperations.getBookTags(id);
      const currentTagIds = new Set(currentTags.map(t => t.id));
      const newTagIds = new Set(selectedTags.map(t => t.id));
      
      // Remove tags that are no longer associated
      for (const currentTag of currentTags) {
        if (!newTagIds.has(currentTag.id)) {
          await tagOperations.removeTagFromBook(id, currentTag.id);
        }
      }
      
      // Add new tags
      for (const newTag of selectedTags) {
        if (!currentTagIds.has(newTag.id)) {
          await tagOperations.addTagToBook(id, newTag.id);
        }
      }
      
      addToast({ type: 'success', message: 'Book updated successfully!' });
      navigate(`/book/${id}`);
    } catch (error) {
      console.error('Failed to update book:', error);
      addToast({ type: 'error', message: 'Failed to update book' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (!book || !book.isbn13) return;

    try {
      const metadata = await refreshMetadata(book.id, book.isbn13);
      if (metadata) {
        const updatedBook = { ...book, ...metadata };
        await bookOperations.update(book.id, updatedBook);
        setBook(updatedBook);
        addToast({ type: 'success', message: 'Metadata refreshed!' });
      }
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
      addToast({ type: 'error', message: 'Failed to refresh metadata' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Book
          </h1>
          {book && (
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-600 dark:text-gray-400">
                {book.title}
              </p>
              {book.isbn13 && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                  aria-label="Refresh metadata"
                  title="Refresh metadata from external sources"
                >
                  {isRefreshing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                </button>
              )}
            </div>
          )}
          
          {/* Reading Status */}
          {book && (
            <div className="mt-4">
              <StatusSelector
                bookId={book.id}
                currentStatus={currentStatus}
                onStatusChange={setCurrentStatus}
                variant="tabs"
              />
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-6">
        {book && (
          <BookForm
            initialData={book}
            initialTags={tags}
            onSubmit={handleSave}
            onCancel={() => navigate(`/book/${id}`)}
            isLoading={saving}
            submitLabel="Save Changes"
          />
        )}
      </main>
    </div>
  );
}