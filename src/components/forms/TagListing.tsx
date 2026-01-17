import { useMemo, useState } from 'react';
import { Tag, X, Search } from 'lucide-react';
import { Card } from '../common/Button';
import { tagOperations } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface TagWithCount {
  id: string;
  name: string;
  createdAt: Date;
  bookCount: number;
}

export type { TagWithCount };

interface TagListingProps {
  onTagClick?: (tag: TagWithCount) => void;
  onTagDelete?: (tagId: string) => void;
  className?: string;
  showCounts?: boolean;
  maxTags?: number;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function TagListing({
  onTagClick,
  onTagDelete,
  className,
  showCounts = true,
  maxTags,
  showSearch = false,
  searchQuery = '',
  onSearchChange
}: TagListingProps) {
  const [localSearch, setLocalSearch] = useState('');
  const effectiveSearch = showSearch && onSearchChange ? searchQuery : localSearch;
  const handleSearchChange = showSearch && onSearchChange ? onSearchChange : setLocalSearch;

  const tagsWithCounts = useLiveQuery(
    () => tagOperations.getAllWithCount(),
    []
  );

  const displayedTags = useMemo(() => {
    if (!tagsWithCounts) return [];

    // Filter by search query
    let filtered = tagsWithCounts;
    if (effectiveSearch.trim()) {
      const query = effectiveSearch.toLowerCase();
      filtered = tagsWithCounts.filter(tag =>
        tag.name.toLowerCase().includes(query)
      );
    }

    if (maxTags) {
      return filtered.slice(0, maxTags);
    }
    return filtered;
  }, [tagsWithCounts, maxTags, effectiveSearch]);

  if (!tagsWithCounts) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (tagsWithCounts.length === 0) {
    return (
      <div className={className}>
        <Card className="p-6 text-center">
          <Tag size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600 dark:text-gray-400">No tags yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Add tags when editing books to organize your library
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Search Input */}
      {showSearch && (
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search tags..."
              value={effectiveSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input pl-9 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {displayedTags.map(tag => (
            <TagItem
              key={tag.id}
              tag={tag}
              showCount={showCounts}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
              onDelete={onTagDelete ? () => onTagDelete(tag.id) : undefined}
            />
          ))}
      </div>

      {effectiveSearch.trim() && displayedTags.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">
          No tags found matching &quot;{effectiveSearch}&quot;
        </p>
      )}

      {maxTags && tagsWithCounts.length > maxTags && !effectiveSearch.trim() && (
        <p className="text-sm text-gray-500 mt-2">
          Showing {maxTags} of {tagsWithCounts.length} tags
        </p>
      )}
    </div>
  );
}

interface TagItemProps {
  tag: TagWithCount;
  showCount: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

function TagItem({ tag, showCount, onClick, onDelete }: TagItemProps) {
  const content = (
    <>
      <Tag size={14} />
      <span>{tag.name}</span>
      {showCount && (
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200/50 dark:bg-gray-600/50">
          {tag.bookCount}
        </span>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-0.5 hover:opacity-70 transition-opacity p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
          aria-label={`Delete ${tag.name} tag`}
        >
          <X size={12} />
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer hover:opacity-80 hover:scale-105 ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600"
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
    >
      {content}
    </span>
  );
}
