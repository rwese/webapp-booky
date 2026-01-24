import { useState, useCallback, useMemo } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../common/Button';

interface NotesEditorProps {
  initialNotes?: string;
  onSave: (notes: string) => Promise<void>;
  onCancel: () => void;
  maxLength?: number;
  placeholder?: string;
}

export function NotesEditor({
  initialNotes = '',
  onSave,
  onCancel,
  maxLength = 2000,
  placeholder = 'Add your personal notes about this book...'
}: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const characterCount = useMemo(() => notes.length, [notes]);
  const isOverLimit = characterCount > maxLength;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength + 100) { // Allow some buffer
      setNotes(newValue);
      setIsDirty(true);
    }
  }, [maxLength]);

  const handleSave = useCallback(async () => {
    if (isOverLimit) return;
    
    setIsSaving(true);
    try {
      await onSave(notes);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }, [notes, isOverLimit, onSave]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Discard them?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  }, [isDirty, onCancel]);

  // Auto-save indicator
  const autoSaveStatus = useMemo(() => {
    if (isSaving) return 'Saving...';
    if (isDirty) return 'Unsaved changes';
    return 'All changes saved';
  }, [isSaving, isDirty]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label 
          htmlFor="notes-editor" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Personal Notes
        </label>
        <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
          {characterCount} / {maxLength} characters
        </span>
      </div>
      
      <textarea
        id="notes-editor"
        value={notes}
        onChange={handleChange}
        placeholder={placeholder}
        className={`input min-h-[150px] resize-y w-full ${
          isOverLimit ? 'border-red-500 focus:ring-red-500' : ''
        }`}
        aria-describedby="notes-help"
      />
      
      <p id="notes-help" className="text-xs text-gray-500 dark:text-gray-400">
        Supports markdown formatting. {autoSaveStatus}
      </p>
      
      <div className="flex gap-2 justify-end">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X size={16} className="mr-1" />
          Cancel
        </Button>
        <Button 
          type="button" 
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          loading={isSaving}
        >
          <Save size={16} className="mr-1" />
          Save Notes
        </Button>
      </div>
    </div>
  );
}

// Simple notes display component with show more functionality
interface NotesDisplayProps {
  notes?: string;
  maxLength?: number;
  onEdit?: () => void;
}

export function NotesDisplay({
  notes,
  maxLength = 150,
  onEdit
}: NotesDisplayProps) {
  if (!notes) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        <p>No notes yet</p>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="mt-2">
            Add Notes
          </Button>
        )}
      </div>
    );
  }

  const isLong = notes.length > maxLength;
  const displayText = isLong ? notes.slice(0, maxLength) + '...' : notes;

  return (
    <div className="space-y-2">
      <div className="prose dark:prose-invert max-w-none">
        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
          {displayText}
        </p>
      </div>
      {isLong && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Show more
        </Button>
      )}
      {onEdit && !isLong && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      )}
    </div>
  );
}
