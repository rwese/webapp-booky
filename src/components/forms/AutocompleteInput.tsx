import { useState, useEffect, useRef } from 'react';
import { searchService } from '../../lib/searchService';
import { clsx } from 'clsx';

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: Array<{ value: string; label: string; count: number }>;
  isLoading?: boolean;
  onSelect?: (value: string) => void;
  className?: string;
}

export function AutocompleteInput({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
  isLoading,
  onSelect,
  className
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    onChange(suggestion);
    onSelect?.(suggestion);
    setIsOpen(false);
  };

  const displaySuggestions = suggestions.filter(s =>
    s.value.toLowerCase().includes(inputValue.toLowerCase()) &&
    s.value.toLowerCase() !== inputValue.toLowerCase()
  );

  return (
    <div ref={wrapperRef} className={clsx('relative', className)}>
      <div className="space-y-1">
        {label && (
          <label htmlFor="autocomplete-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          id="autocomplete-input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
          className={clsx(
            'w-full px-4 py-2.5 rounded-lg border transition-colors duration-200',
            'bg-white dark:bg-gray-800',
            'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'border-gray-300 dark:border-gray-600'
          )}
        />
      </div>

      {isOpen && (isLoading || displaySuggestions.length > 0 || inputValue.length >= 2) && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              Loading suggestions...
            </div>
          ) : displaySuggestions.length > 0 ? (
            <ul className="py-1">
              {displaySuggestions.map((suggestion) => (
                <li key={suggestion.value}>
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleSelect(suggestion.value)}
                  >
                    <span className="font-medium">{suggestion.value}</span>
                    {suggestion.count !== undefined && (
                      <span className="text-gray-400 text-xs ml-2">
                        ({suggestion.count} books)
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : inputValue.length >= 2 ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              No suggestions found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Hook-based version for more flexible usage
export function useAutocomplete(key: 'authors' | 'publishers', limit = 10) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ value: string; label: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        if (key === 'authors') {
          const results = await searchService.searchAuthors(query, limit);
          setSuggestions(results);
        } else {
          // For publishers, we'll search in books and extract unique publishers
          const result = await searchService.search({ query, limit });
          const publisherCounts = new Map<string, number>();
          result.books.forEach(book => {
            if (book.publisher) {
              publisherCounts.set(book.publisher, (publisherCounts.get(book.publisher) || 0) + 1);
            }
          });
          const publishers = Array.from(publisherCounts.entries())
            .map(([value, count]) => ({ value, label: value, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
          setSuggestions(publishers);
        }
      } catch (e) {
        console.error(`${key} search error:`, e);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, key, limit]);

  return { query, setQuery, suggestions, isLoading };
}
