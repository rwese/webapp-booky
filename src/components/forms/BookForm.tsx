import { useState, type FormEvent } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '../common/Button';
import { CoverUpload } from '../image/CoverUpload';
import { TagInput } from './TagInput';
import { StarRating } from './StarRating';
import { AutocompleteInput, useAutocomplete } from './AutocompleteInput';
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

  // Autocomplete hooks for authors and publishers
  const authorSearch = useAutocomplete('authors', 10);
  const publisherSearch = useAutocomplete('publishers', 10);

  const handleCoverChange = (coverUrl: string) => {
    setFormData({ ...formData, coverUrl });
  };

  const handleAuthorChange = (value: string) => {
    // Parse comma-separated values into an array
    const authors = value.split(',').map((a) => a.trim()).filter(Boolean);
    setFormData({ ...formData, authors });
  };

  const handleRatingChange = (rating: number) => {
    setFormData({ ...formData, averageRating: rating });
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

          <AutocompleteInput
            label="Author"
            value={formData.authors?.join(', ') || ''}
            onChange={handleAuthorChange}
            placeholder="Enter author name(s), separated by commas"
            suggestions={authorSearch.suggestions}
            isLoading={authorSearch.isLoading}
            onSelect={(value) => {
              const currentAuthors = formData.authors || [];
              if (!currentAuthors.includes(value)) {
                const newAuthors = [...currentAuthors, value];
                setFormData({ ...formData, authors: newAuthors });
              }
            }}
          />

          <Input
            label="ISBN"
            value={formData.isbn13 || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, isbn13: e.target.value })}
            placeholder="Enter ISBN (optional)"
          />

          <div className="w-1/2">
            <CoverUpload
              value={formData.coverUrl}
              onChange={handleCoverChange}
              bookTitle={formData.title || 'book'}
            />
          </div>

          <AutocompleteInput
            label="Publisher"
            value={formData.publisher || ''}
            onChange={(value) => setFormData({ ...formData, publisher: value })}
            placeholder="Enter publisher (optional)"
            suggestions={publisherSearch.suggestions}
            isLoading={publisherSearch.isLoading}
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

          <div className="space-y-1">
            <label htmlFor="book-rating" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Rating
            </label>
            <div id="book-rating">
              <StarRating
                rating={formData.averageRating || 0}
                onRatingChange={handleRatingChange}
                interactive={true}
                size="lg"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Click to rate (0.5 - 5.0 stars)
            </p>
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
            <p className={`text-xs text-right ${
              (formData.notes?.length || 0) > 1800
                ? 'text-orange-500 dark:text-orange-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
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
