import { useState, useCallback, useRef } from 'react';
import { Bold, Italic, List, Quote, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '../common/Button';
import { clsx } from 'clsx';

interface ReviewEditorProps {
  initialReview?: string;
  onSave: (review: string) => void;
  onCancel: () => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}

export function ReviewEditor({ 
  initialReview = '', 
  onSave, 
  onCancel,
  maxLength = 5000,
  placeholder = 'Write your review here...',
  className 
}: ReviewEditorProps) {
  const [review, setReview] = useState(initialReview);
  const [showToolbar, setShowToolbar] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = useCallback((before: string, after: string = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = review.substring(start, end);
    const newText = review.substring(0, start) + before + selectedText + after + review.substring(end);
    
    if (newText.length <= maxLength) {
      setReview(newText);
      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, end + before.length);
      }, 0);
    }
  }, [review, maxLength]);

  const handleSave = useCallback(() => {
    if (review.length <= maxLength) {
      onSave(review);
    }
  }, [review, maxLength, onSave]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (event.metaKey || event.ctrlKey) {
      switch (event.key) {
        case 'b':
          event.preventDefault();
          insertFormatting('**');
          break;
        case 'i':
          event.preventDefault();
          insertFormatting('*');
          break;
        case 's':
          event.preventDefault();
          handleSave();
          break;
      }
    }
    
    // Handle Tab for indentation
    if (event.key === 'Tab') {
      event.preventDefault();
      insertFormatting('  ');
    }
  }, [insertFormatting, handleSave]);

  const characterCount = review.length;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className={clsx('border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className={clsx(
        'flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
        !showToolbar && 'hidden'
      )}>
        <button
          type="button"
          onClick={() => insertFormatting('**')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('*')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('\n- ')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('> ')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Quote"
        >
          <Quote size={16} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setReview('')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Clear"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={review}
        onChange={(e) => setReview(e.target.value.slice(0, maxLength))}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowToolbar(true)}
        placeholder={placeholder}
        className={clsx(
          'w-full p-3 min-h-[150px] resize-y bg-white dark:bg-gray-900',
          'text-gray-900 dark:text-white placeholder-gray-400',
          'focus:outline-none'
        )}
        aria-label="Review text area"
      />

      {/* Footer */}
      <div className={clsx(
        'flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700'
      )}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowToolbar(!showToolbar)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {showToolbar ? 'Hide formatting' : 'Show formatting'}
          </button>
          <span className={clsx(
            'text-xs',
            isOverLimit ? 'text-red-500' : 'text-gray-500'
          )}>
            {characterCount}/{maxLength} characters
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X size={16} />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isOverLimit}>
            <Save size={16} />
            Save Review
          </Button>
        </div>
      </div>
    </div>
  );
}

// Simple read-only review display with basic formatting
export function ReviewDisplay({ review }: { review: string }) {
  // Simple markdown parsing
  const parseReview = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|\n- .*?\n|> .*?\n)/g);
    
    return parts.map((part, index) => {
      const key = `part-${index}-${part.slice(0, 10)}`;
      
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('> ')) {
        return (
          <blockquote key={key} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
            {part.slice(2)}
          </blockquote>
        );
      }
      if (part.startsWith('- ')) {
        return (
          <li key={key} className="ml-4">
            {part.slice(2)}
          </li>
        );
      }
      if (part === '\n') {
        return <br key={key} />;
      }
      return <span key={key}>{part}</span>;
    });
  };

  return (
    <div className="prose dark:prose-invert max-w-none">
      {parseReview(review)}
    </div>
  );
}