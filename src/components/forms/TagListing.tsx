import { useMemo } from 'react';
import { Tag, X } from 'lucide-react';
import { Card } from '../common/Button';
import { tagOperations } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { clsx } from 'clsx';

// Predefined tag colors (matching TagInput.tsx)
const TAG_COLORS = [
  { name: 'Red', value: '#ef4444', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  { name: 'Orange', value: '#f97316', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { name: 'Yellow', value: '#eab308', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  { name: 'Green', value: '#22c55e', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { name: 'Purple', value: '#a855f7', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
];

interface TagWithCount {
  id: string;
  name: string;
  color: string;
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
}

export function TagListing({
  onTagClick,
  onTagDelete,
  className,
  showCounts = true,
  maxTags
}: TagListingProps) {
  const tagsWithCounts = useLiveQuery(
    () => tagOperations.getAllWithCount(),
    []
  );

  const displayedTags = useMemo(() => {
    if (!tagsWithCounts) return [];
    if (maxTags) {
      return tagsWithCounts.slice(0, maxTags);
    }
    return tagsWithCounts;
  }, [tagsWithCounts, maxTags]);

  const getColorClasses = (colorValue: string) => {
    const colorObj = TAG_COLORS.find(c => c.value === colorValue);
    return colorObj || TAG_COLORS[3]; // Default to green if not found
  };

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
      <div className="flex flex-wrap gap-2">
        {displayedTags.map(tag => {
          const colorClasses = getColorClasses(tag.color);

          return (
            <TagItem
              key={tag.id}
              tag={tag}
              colorClasses={colorClasses}
              showCount={showCounts}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
              onDelete={onTagDelete ? () => onTagDelete(tag.id) : undefined}
            />
          );
        })}
      </div>

      {maxTags && tagsWithCounts.length > maxTags && (
        <p className="text-sm text-gray-500 mt-2">
          Showing {maxTags} of {tagsWithCounts.length} tags
        </p>
      )}
    </div>
  );
}

interface TagItemProps {
  tag: TagWithCount;
  colorClasses: typeof TAG_COLORS[0];
  showCount: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

function TagItem({ tag, colorClasses, showCount, onClick, onDelete }: TagItemProps) {
  const content = (
    <>
      <Tag size={14} />
      <span>{tag.name}</span>
      {showCount && (
        <span className={clsx(
          'text-xs px-1.5 py-0.5 rounded-full',
          colorClasses.bg === 'bg-red-100' ? 'bg-red-200/50' :
          colorClasses.bg === 'bg-orange-100' ? 'bg-orange-200/50' :
          colorClasses.bg === 'bg-yellow-100' ? 'bg-yellow-200/50' :
          colorClasses.bg === 'bg-green-100' ? 'bg-green-200/50' :
          colorClasses.bg === 'bg-blue-100' ? 'bg-blue-200/50' :
          'bg-purple-200/50'
        )}>
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
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
          colorClasses.bg,
          colorClasses.text,
          colorClasses.border,
          'cursor-pointer hover:opacity-80 hover:scale-105',
          'ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
        colorClasses.bg,
        colorClasses.text,
        colorClasses.border
      )}
    >
      {content}
    </span>
  );
}
