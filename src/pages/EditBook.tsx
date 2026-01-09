import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { BookForm } from '../components/forms/BookForm';
import { bookOperations } from '../lib/db';
import { useToastStore } from '../store/useStore';
import type { Book as BookType } from '../types';

export function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  
  const [book, setBook] = useState<BookType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        setBook(loadedBook);
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

  const handleSave = async (updatedBook: BookType) => {
    if (!id) return;

    setSaving(true);
    try {
      await bookOperations.update(id, updatedBook);
      addToast({ type: 'success', message: 'Book updated successfully!' });
      navigate(`/book/${id}`);
    } catch (error) {
      console.error('Failed to update book:', error);
      addToast({ type: 'error', message: 'Failed to update book' });
    } finally {
      setSaving(false);
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
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {book.title}
            </p>
          )}
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-6">
        {book && (
          <BookForm
            initialData={book}
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