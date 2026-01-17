import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Plus, X, Search, Folder } from 'lucide-react';
import { Button, Input, Card } from '../common/Button';
import { bookOperations } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { clsx } from 'clsx';

interface CategorySelectorProps {
  bookId: string;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  className?: string;
}

// Get all unique categories from all books in the library
function useAllCategories() {
  const books = useLiveQuery(() => bookOperations.getAll()) || [];
  
  return useMemo(() => {
    const categorySet = new Set<string>();
    for (const book of books) {
      if (book.categories && Array.isArray(book.categories)) {
        for (const cat of book.categories) {
          categorySet.add(cat);
        }
      }
    }
    return Array.from(categorySet).sort();
  }, [books]);
}

export function CategorySelector({ bookId, selectedCategories, onCategoriesChange, className }: CategorySelectorProps) {
  const allCategories = useAllCategories();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close suggestions
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter categories based on input
  const filteredCategories = useMemo(() => {
    if (!inputValue.trim()) return allCategories;
    return allCategories.filter(category => 
      category.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [allCategories, inputValue]);

  // Check if input matches an existing category (case-insensitive)
  const matchingCategory = useMemo(() => {
    if (!inputValue.trim()) return null;
    return allCategories.find(c => c.toLowerCase() === inputValue.toLowerCase());
  }, [allCategories, inputValue]);

  // Check if category is already selected
  const isSelected = useCallback((category: string) => {
    return selectedCategories.some(c => c.toLowerCase() === category.toLowerCase());
  }, [selectedCategories]);

  const handleAddCategory = useCallback((category: string) => {
    if (!category.trim() || isSelected(category)) return;
    onCategoriesChange([...selectedCategories, category.trim()]);
    setInputValue('');
    setShowSuggestions(false);
  }, [selectedCategories, onCategoriesChange, isSelected]);

  const handleCreateCategory = useCallback(async () => {
    const category = inputValue.trim();
    if (!category || isSelected(category)) return;

    setIsCreating(true);
    try {
      // Add the new category to the book
      await handleAddCategory(category);
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setIsCreating(false);
    }
  }, [inputValue, isSelected, handleAddCategory]);

  const handleRemoveCategory = useCallback((categoryToRemove: string) => {
    onCategoriesChange(selectedCategories.filter(c => c !== categoryToRemove));
  }, [selectedCategories, onCategoriesChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (matchingCategory) {
        handleAddCategory(matchingCategory);
      } else if (inputValue.trim()) {
        handleCreateCategory();
      }
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
    }
  }, [inputValue, matchingCategory, handleAddCategory, handleCreateCategory]);

  return (
    <div ref={wrapperRef} className={className}>
      {/* Selected Categories Display */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedCategories.map(category => (
            <span
              key={category}
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium',
                'bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200'
              )}
            >
              <Folder size={12} />
              {category}
              <button
                type="button"
                onClick={() => handleRemoveCategory(category)}
                className="ml-1 hover:opacity-70 transition-opacity"
                aria-label={`Remove ${category} category`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

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
              placeholder="Search or create category..."
              className="input pl-9 pr-4"
            />
          </div>
          
          <Button 
            onClick={handleCreateCategory} 
            disabled={!inputValue.trim() || isCreating || !!matchingCategory}
            size="sm"
          >
            <Plus size={16} />
            Add
          </Button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (filteredCategories.length > 0 || (inputValue.trim() && !matchingCategory)) && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {/* Existing Categories */}
            {filteredCategories.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  Existing Categories
                </div>
                {filteredCategories.map(category => {
                  const selected = isSelected(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleAddCategory(category)}
                      disabled={selected}
                      className={clsx(
                        'w-full px-3 py-2 text-left flex items-center gap-2',
                        selected 
                          ? 'bg-secondary-50 dark:bg-secondary-900 opacity-50' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <Folder size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">{category}</span>
                      {selected && <span className="ml-auto text-xs text-secondary-600">Selected</span>}
                    </button>
                  );
                })}
              </>
            )}

            {/* Create New Category Option */}
            {inputValue.trim() && !matchingCategory && (
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={isCreating}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-secondary-50 dark:hover:bg-secondary-900 border-t border-gray-200 dark:border-gray-700"
              >
                <Plus size={16} className="text-secondary-600" />
                <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400">
                  Create new category &quot;{inputValue.trim()}&quot;
                </span>
              </button>
            )}

            {/* Empty State */}
            {allCategories.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No categories yet. Create your first one above!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple Category Badge Component
interface CategoryBadgeProps {
  category: string;
  onRemove?: () => void;
  className?: string;
}

export function CategoryBadge({ category, onRemove, className }: CategoryBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium',
        'bg-secondary-100 text-secondary-800 dark:bg-secondary-900 dark:text-secondary-200',
        className
      )}
    >
      <Folder size={12} />
      {category}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 hover:opacity-70 transition-opacity"
          aria-label={`Remove ${category} category`}
        >
          <X size={14} />
        </button>
      )}
    </span>
  );
}
