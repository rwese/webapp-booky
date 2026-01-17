import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Tag, Search } from 'lucide-react';
import { Button } from '../common/Button';
import { tagOperations } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Tag as TagType } from '../../types';

interface TagInputProps {
  selectedTags: TagType[];
  onTagsChange: (tags: TagType[]) => void;
  className?: string;
}

export function TagInput({ selectedTags, onTagsChange, className }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
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
        createdAt: new Date()
      };

      await tagOperations.add(newTag);
      onTagsChange([...selectedTags, newTag]);
      setInputValue('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  }, [inputValue, selectedTags, onTagsChange]);

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

  return (
    <div ref={wrapperRef} className={className}>
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {selectedTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
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
          ))}
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
                {suggestions.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleSelectExistingTag(tag)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Tag size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">{tag.name}</span>
                    </button>
                  ))}
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
                  <span className="text-sm text-gray-900 dark:text-white">"{inputValue}"</span>
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
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ${sizeClasses[size]} ${className || ''}`}
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

