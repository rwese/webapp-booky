import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Tag, Search } from 'lucide-react';
import { Button } from '../common/Button';
import { tagOperations } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Tag as TagType } from '../../types';
import { clsx } from 'clsx';

// Predefined tag colors
export const TAG_COLORS = [
  { name: 'Red', value: '#ef4444', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  { name: 'Orange', value: '#f97316', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { name: 'Yellow', value: '#eab308', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  { name: 'Green', value: '#22c55e', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { name: 'Purple', value: '#a855f7', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
];

interface TagInputProps {
  selectedTags: TagType[];
  onTagsChange: (tags: TagType[]) => void;
  className?: string;
}

export function TagInput({ selectedTags, onTagsChange, className }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[3]); // Default green
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const currentWrapper = wrapperRef.current;
  
  // Get all existing tags
  const allTagsRaw = useLiveQuery(() => tagOperations.getAll());
  const allTags = useMemo(() => {
    return allTagsRaw || [];
  }, [allTagsRaw]);
  const existingTags = allTags;
  
  // Filter suggestions based on input
  const suggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    return allTags.filter(tag =>
      tag.name.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [inputValue, allTags]);

  // Handle click outside to close suggestions
  useEffect(() => {
    if (!currentWrapper) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (currentWrapper && !currentWrapper.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentWrapper]);

  const handleCreateTag = useCallback(async () => {
    const name = inputValue.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const newTag: TagType = {
        id: crypto.randomUUID(),
        name,
        color: selectedColor.value,
        createdAt: new Date()
      };

      await tagOperations.add(newTag);
      onTagsChange([...selectedTags, newTag]);
      setInputValue('');
      setSelectedColor(TAG_COLORS[3]); // Reset to default color
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  }, [inputValue, selectedColor, selectedTags, onTagsChange]);

  const handleSelectExistingTag = useCallback((tag: TagType) => {
    onTagsChange([...selectedTags, tag]);
    setInputValue('');
    setShowSuggestions(false);
  }, [selectedTags, onTagsChange]);

  const handleRemoveTag = useCallback((tagId: string) => {
    onTagsChange(selectedTags.filter(tag => tag.id !== tagId));
  }, [selectedTags, onTagsChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestions.length > 0) {
        handleSelectExistingTag(suggestions[0]);
      } else if (inputValue.trim()) {
        handleCreateTag();
      }
    } else if (event.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1].id);
    }
  }, [inputValue, selectedTags, suggestions, handleSelectExistingTag, handleCreateTag, handleRemoveTag]);

  const getColorClasses = (colorValue: string) => {
    const colorObj = TAG_COLORS.find(c => c.value === colorValue);
    return colorObj || TAG_COLORS[3]; // Default to green if not found
  };

  return (
    <div ref={wrapperRef} className={className}>
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {selectedTags.map(tag => {
          const colorClasses = getColorClasses(tag.color);
          return (
            <span
              key={tag.id}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium',
                colorClasses.bg,
                colorClasses.text,
                colorClasses.border
              )}
            >
              <Tag size={12} />
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:opacity-70 transition-opacity"
              >
                <X size={14} />
              </button>
            </span>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Add tags..."
              className="input pl-9 pr-4"
            />
          </div>
          
          {/* Color Picker */}
          <div className="flex gap-1 items-center">
            {TAG_COLORS.map(color => (
              <button
                key={color.value}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={clsx(
                  'w-6 h-6 rounded-full transition-transform hover:scale-110',
                  color.bg,
                  selectedColor.value === color.value && 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500'
                )}
                style={{ backgroundColor: color.value }}
                title={`Select ${color.name} color`}
              />
            ))}
          </div>
          
          <Button 
            onClick={handleCreateTag} 
            disabled={!inputValue.trim() || isCreating}
            size="sm"
          >
            <Plus size={16} />
            Add
          </Button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (suggestions.length > 0 || (inputValue.trim() && !existingTags.some(t => t.name.toLowerCase() === inputValue.toLowerCase()))) && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  Existing Tags
                </div>
                {suggestions.map(tag => {
                  const colorClasses = getColorClasses(tag.color);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleSelectExistingTag(tag)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <span className={clsx('w-3 h-3 rounded-full', colorClasses.bg)} style={{ backgroundColor: tag.color }} />
                      <span className="text-sm text-gray-900 dark:text-white">{tag.name}</span>
                    </button>
                  );
                })}
              </>
            )}
            
            {inputValue.trim() && !existingTags.some(t => t.name.toLowerCase() === inputValue.toLowerCase()) && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                  Create New Tag
                </div>
                <button
                  type="button"
                  onClick={handleCreateTag}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Plus size={16} className="text-primary-600" />
                  <span className="text-sm text-gray-900 dark:text-white">&quot;{inputValue}&quot;</span>
                  <span className="text-xs text-gray-500">({selectedColor.name})</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Tag Badge component for display
interface TagBadgeProps {
  tag: TagType;
  size?: 'sm' | 'md' | 'lg';
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({ tag, size = 'md', removable = false, onRemove, className }: TagBadgeProps) {
  const colorObj = TAG_COLORS.find(c => c.value === tag.color) || TAG_COLORS[3];
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        colorObj.bg,
        colorObj.text,
        colorObj.border,
        sizeClasses[size],
        className
      )}
    >
      <Tag size={size === 'sm' ? 10 : size === 'md' ? 12 : 14} />
      {tag.name}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <X size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
        </button>
      )}
    </span>
  );
}

// Tag management interface
interface TagManagerProps {
  onClose: () => void;
  className?: string;
}

export function TagManager({ onClose, className }: TagManagerProps) {
  const allTagsRaw = useLiveQuery(() => tagOperations.getAll());
  const allTags = useMemo(() => {
    return allTagsRaw || [];
  }, [allTagsRaw]);
  const [editTag, setEditTag] = useState<TagType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return allTags;
    return allTags.filter(tag => 
      tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allTags, searchQuery]);

  const handleDeleteTag = useCallback(async (tagId: string) => {
    if (confirm('Are you sure you want to delete this tag? It will be removed from all books.')) {
      await tagOperations.delete(tagId);
    }
  }, []);

  const handleUpdateTag = useCallback(async (tagId: string, updates: Partial<TagType>) => {
    await tagOperations.update(tagId, updates);
    setEditTag(null);
  }, []);

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg shadow-xl', className)}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Tags</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        {/* Search and Creation Area */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags or create new..."
            className="input pl-9 pr-20"
          />
          {searchQuery.trim() && !allTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase()) && (
            <Button 
              size="sm" 
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => {
                if (searchQuery.trim()) {
                  const handleCreateTag = async () => {
                    const newTag: TagType = {
                      id: crypto.randomUUID(),
                      name: searchQuery.trim(),
                      color: TAG_COLORS[3].value,
                      createdAt: new Date()
                    };
                    await tagOperations.add(newTag);
                    setSearchQuery('');
                  };
                  handleCreateTag();
                }
              }}
            >
              <Plus size={14} />
              Create
            </Button>
          )}
        </div>

        {/* Suggestions for existing tags */}
        {searchQuery.trim() && (
          <div className="mb-4">
            {(() => {
              const matchingTags = allTags.filter(tag => 
                tag.name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              
              if (matchingTags.length > 0) {
                return (
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-xs font-medium text-gray-500">
                      Existing Tags
                    </div>
                    {matchingTags.map(tag => {
                      const colorObj = TAG_COLORS.find(c => c.value === tag.color) || TAG_COLORS[3];
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => setEditTag(tag)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded"
                        >
                          <span 
                            className={clsx('w-3 h-3 rounded-full', colorObj.bg)} 
                            style={{ backgroundColor: tag.color }} 
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{tag.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              } else if (!allTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase())) {
                return (
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-xs font-medium text-gray-500">
                      Create New Tag
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const handleCreateTag = async () => {
                          const newTag: TagType = {
                            id: crypto.randomUUID(),
                            name: searchQuery.trim(),
                            color: TAG_COLORS[3].value,
                            createdAt: new Date()
                          };
                          await tagOperations.add(newTag);
                          setSearchQuery('');
                        };
                        handleCreateTag();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-primary-50 dark:hover:bg-primary-900 flex items-center gap-2 rounded"
                    >
                      <Plus size={16} className="text-primary-600" />
<span className="text-sm text-primary-600 dark:text-primary-400">
                         &quot;{searchQuery}&quot;
                       </span>
                    </button>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredTags.map(tag => {
            const colorObj = TAG_COLORS.find(c => c.value === tag.color) || TAG_COLORS[3];
            
            return (
              <div
                key={tag.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                {editTag?.id === tag.id ? (
                  <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editTag.name}
                onChange={(e) => setEditTag({ ...editTag, name: e.target.value })}
                className="input flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateTag(tag.id, editTag);
                  } else if (e.key === 'Escape') {
                    setEditTag(null);
                  }
                }}
              />
                    <div className="flex gap-1">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setEditTag({ ...editTag, color: color.value })}
                          className={clsx(
                            'w-6 h-6 rounded-full transition-transform hover:scale-110',
                            editTag.color === color.value && 'ring-2 ring-offset-1 ring-gray-400'
                          )}
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                    </div>
                    <Button size="sm" onClick={() => handleUpdateTag(tag.id, editTag)}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditTag(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx('w-4 h-4 rounded-full', colorObj.bg)}
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditTag(tag)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTag(tag.id)}>
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {filteredTags.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No tags found' : 'No tags yet. Create some tags above!'}
          </div>
        )}
      </div>
    </div>
  );
}