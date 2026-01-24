import { useState, type FormEvent } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '../common/Button';
import { CoverUpload } from '../image/CoverUpload';
import { TagInput } from './TagInput';
import type { Book as BookType, BookFormat, Tag as TagType } from '../../types';

interface BookFormProps {
  initialData?: Partial<BookType>;
  onSubmit: (book: BookType, tags: TagType[]) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  initialTags?: TagType[];
}

export function BookForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  submitLabel = 'Add Book',
  initialTags = []
}: BookFormProps) {
  const [formData, setFormData] = useState<Partial<BookType>>({
    title: initialData?.title || '',
    subtitle: initialData?.subtitle || '',
    authors: initialData?.authors || [],
    isbn13: initialData?.isbn13 || '',
    coverUrl: initialData?.coverUrl || '',
    description: initialData?.description || '',
    publisher: initialData?.publisher || '',
    publishedYear: initialData?.publishedYear || undefined,
    publishedDate: initialData?.publishedDate || '',
    pageCount: initialData?.pageCount || undefined,
    format: initialData?.format || 'physical',
    subjects: initialData?.subjects || [],
    languageCode: initialData?.languageCode || '',
    categories: initialData?.categories || [],
    averageRating: initialData?.averageRating,
    notes: initialData?.notes || '',
  });
  
  const [selectedTags, setSelectedTags] = useState<TagType[]>(initialTags);

  const handleCoverChange = (coverUrl: string) => {
    setFormData({ ...formData, coverUrl });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      // Show error - title is required
      return;
    }

    const book: BookType = {
      id: initialData?.id || crypto.randomUUID(),
      title: formData.title!,
      subtitle: formData.subtitle,
      authors: formData.authors || [],
      isbn13: formData.isbn13,
      coverUrl: formData.coverUrl,
      description: formData.description,
      publisher: formData.publisher,
      publishedYear: formData.publishedYear,
      publishedDate: formData.publishedDate,
      pageCount: formData.pageCount,
      format: formData.format as BookFormat,
      addedAt: initialData?.addedAt || new Date(),
      externalIds: initialData?.externalIds || {},
      needsSync: true,
      localOnly: true,
      subjects: formData.subjects,
      languageCode: formData.languageCode,
      categories: formData.categories,
      averageRating: formData.averageRating,
      notes: formData.notes,
      notesUpdatedAt: formData.notes ? new Date() : undefined,
    };

    await onSubmit(book, selectedTags);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          {initialData?.id ? 'Edit Book' : 'Manual Entry'}
        </h2>
        
        <div className="space-y-4">
          <Input
            label="Title *"
            value={formData.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter book title"
            required
          />
          
          <Input
            label="Subtitle"
            value={formData.subtitle || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, subtitle: e.target.value })}
            placeholder="Enter subtitle (optional)"
          />
          
          <Input
            label="Author"
            value={formData.authors?.join(', ') || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
              ...formData, 
              authors: e.target.value.split(',').map((a: string) => a.trim()).filter(Boolean) 
            })}
            placeholder="Enter author name(s), separated by commas"
          />
          
          <Input
            label="ISBN"
            value={formData.isbn13 || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, isbn13: e.target.value })}
            placeholder="Enter ISBN (optional)"
          />
          
          <CoverUpload
            value={formData.coverUrl}
            onChange={handleCoverChange}
            bookTitle={formData.title || 'book'}
          />
          
          <Input
            label="Publisher"
            value={formData.publisher || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, publisher: e.target.value })}
            placeholder="Enter publisher (optional)"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Published Year"
              type="number"
              value={formData.publishedYear || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
                ...formData, 
                publishedYear: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="Year"
              min="1800"
              max={new Date().getFullYear() + 1}
            />
            
            <Input
              label="Page Count"
              type="number"
              value={formData.pageCount || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
                ...formData, 
                pageCount: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="Pages"
              min="1"
            />
          </div>
          
          <Input
            label="Language"
            value={formData.languageCode || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, languageCode: e.target.value })}
            placeholder="Language (e.g., en, de, fr)"
          />
          
          <Input
            label="Categories"
            value={formData.categories?.join(', ') || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
              ...formData, 
              categories: e.target.value.split(',').map((c: string) => c.trim()).filter(Boolean) 
            })}
            placeholder="Categories/Genres (comma-separated)"
          />
          
          <Input
            label="Subjects"
            value={formData.subjects?.join(', ') || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
              ...formData, 
              subjects: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) 
            })}
            placeholder="Subjects/Topics (comma-separated)"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Rating"
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={formData.averageRating || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
                ...formData, 
                averageRating: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              placeholder="0-5"
            />
          </div>
          
          <div className="space-y-1">
            <label htmlFor="book-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Format
            </label>
            <select
              id="book-format"
              value={formData.format}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, format: e.target.value as BookFormat })}
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
          
          <div className="space-y-1">
            <label htmlFor="book-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="book-description"
              value={formData.description || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter book description (optional)"
              className="input min-h-[100px] resize-y"
              rows={4}
            />
          </div>
          
          <div className="space-y-1">
            <label htmlFor="book-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Personal Notes
            </label>
            <textarea
              id="book-notes"
              value={formData.notes || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add your personal notes about this book... (max 2000 characters)"
              className="input min-h-[100px] resize-y"
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {(formData.notes?.length || 0)} / 2000 characters
            </p>
          </div>
          
          {/* Tags Section */}
          <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tags
            </span>
            <TagInput
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button type="submit" loading={isLoading} className="flex-1">
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Plus size={20} />
                {submitLabel}
              </>
            )}
          </Button>
          
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </Card>
    </form>
  );
}