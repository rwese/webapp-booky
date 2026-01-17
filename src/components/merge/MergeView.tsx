import React, { useState, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AlertTriangle, BookOpen, RefreshCw, X } from 'lucide-react';
import { Button, Card } from '../common/Button';
import { MergeFieldRow, MergeActions, type MergeAction } from './MergeFieldRow';
import type { Book } from '../../types';

export interface MergeViewProps {
  existingBook: Book;
  fetchedBook: Book;
  onMerge: (mergedData: Book) => Promise<void>;
  onCancel: () => void;
}

type FieldName = keyof Book;

interface FieldConfig {
  label: string;
  field: FieldName;
  isArray?: boolean;
  format?: (value: unknown) => React.ReactNode;
}

const FIELD_CONFIGS: FieldConfig[] = [
  { label: 'Title', field: 'title' },
  { label: 'Subtitle', field: 'subtitle' },
  { label: 'Authors', field: 'authors', isArray: true },
  { label: 'Publisher', field: 'publisher' },
  {
    label: 'Published Year',
    field: 'publishedYear',
    format: (v: unknown) => (v ? String(v) : 'Unknown'),
  },
  {
    label: 'Page Count',
    field: 'pageCount',
    format: (v: unknown) => (v ? String(v) : 'Unknown'),
  },
  { label: 'Description', field: 'description' },
  { label: 'Cover URL', field: 'coverUrl' },
  { label: 'Categories', field: 'categories', isArray: true },
  { label: 'Subjects', field: 'subjects', isArray: true },
  { label: 'Language', field: 'languageCode' },
  {
    label: 'Rating',
    field: 'averageRating',
    format: (v: unknown) => (v ? `${v}/5` : 'No rating'),
  },
];

export function MergeView({
  existingBook,
  fetchedBook,
  onMerge,
  onCancel,
}: MergeViewProps) {
  const [fieldActions, setFieldActions] = useState<Record<string, MergeAction>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCoverPreview, setShowCoverPreview] = useState<'existing' | 'fetched' | null>(null);

  // Initialize field actions with default strategy
  React.useEffect(() => {
    const initialActions: Record<string, MergeAction> = {};
    FIELD_CONFIGS.forEach((config) => {
      const existingValue = existingBook[config.field];
      const fetchedValue = fetchedBook[config.field];

      const hasExisting =
        existingValue !== undefined && existingValue !== null && existingValue !== '';
      const hasFetched =
        fetchedValue !== undefined && fetchedValue !== null && fetchedValue !== '';

      if (hasExisting && hasFetched && String(existingValue) !== String(fetchedValue)) {
        // If both have values and they're different, default to keeping existing
        initialActions[config.field] = 'keep_existing';
      } else if (hasFetched && !hasExisting) {
        // If fetched has value but existing doesn't, default to copying
        initialActions[config.field] = 'copy_fetched';
      } else {
        // Otherwise keep existing
        initialActions[config.field] = 'keep_existing';
      }
    });
    setFieldActions(initialActions);
  }, [existingBook, fetchedBook]);

  const handleActionChange = useCallback((field: string, action: MergeAction) => {
    setFieldActions((prev) => ({ ...prev, [field]: action }));
  }, []);

  const handleApplyAll = useCallback(() => {
    const newActions: Record<string, MergeAction> = {};
    FIELD_CONFIGS.forEach((config) => {
      const fetchedValue = fetchedBook[config.field];
      const hasFetched =
        fetchedValue !== undefined && fetchedValue !== null && fetchedValue !== '';
      newActions[config.field] = hasFetched ? 'copy_fetched' : 'keep_existing';
    });
    setFieldActions(newActions);
  }, [fetchedBook]);

  const handleOverwriteAll = useCallback(() => {
    const newActions: Record<string, MergeAction> = {};
    FIELD_CONFIGS.forEach((config) => {
      newActions[config.field] = 'copy_fetched';
    });
    setFieldActions(newActions);
  }, []);

  const handleKeepAll = useCallback(() => {
    const newActions: Record<string, MergeAction> = {};
    FIELD_CONFIGS.forEach((config) => {
      newActions[config.field] = 'keep_existing';
    });
    setFieldActions(newActions);
  }, []);

  const mergeBooks = useCallback((): Book => {
    const merged: Book = { ...existingBook };

    FIELD_CONFIGS.forEach((config) => {
      const action = fieldActions[config.field] ?? 'keep_existing';
      const fetchedValue = fetchedBook[config.field];
      const existingValue = existingBook[config.field];

      switch (action) {
        case 'copy_fetched':
          if (fetchedValue !== undefined && fetchedValue !== null && fetchedValue !== '') {
            (merged as unknown as Record<string, unknown>)[config.field] = fetchedValue;
          }
          break;
        case 'apply_if_empty':
          if (
            existingValue === undefined ||
            existingValue === null ||
            existingValue === ''
          ) {
            if (fetchedValue !== undefined && fetchedValue !== null && fetchedValue !== '') {
              (merged as unknown as Record<string, unknown>)[config.field] = fetchedValue;
            }
          }
          break;
        case 'keep_existing':
        default:
          // Keep existing value (already copied from existingBook)
          break;
      }
    });

    // Preserve immutable fields from existing book
    merged.id = existingBook.id;
    merged.addedAt = existingBook.addedAt;
    merged.externalIds = {
      ...existingBook.externalIds,
      ...fetchedBook.externalIds,
    };

    // Update sync flags
    merged.needsSync = true;
    merged.lastSyncedAt = undefined;

    return merged;
  }, [existingBook, fetchedBook, fieldActions]);

  const handleMerge = async () => {
    setIsProcessing(true);
    try {
      const mergedBook = mergeBooks();
      await onMerge(mergedBook);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasConflicts = useMemo(() => {
    return FIELD_CONFIGS.some((config) => {
      const existingValue = existingBook[config.field];
      const fetchedValue = fetchedBook[config.field];
      const hasExisting =
        existingValue !== undefined && existingValue !== null && existingValue !== '';
      const hasFetched =
        fetchedValue !== undefined && fetchedValue !== null && fetchedValue !== '';
      return hasExisting && hasFetched && String(existingValue) !== String(fetchedValue);
    });
  }, [existingBook, fetchedBook]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <button
          type="button"
          className="fixed inset-0 bg-black/50 transition-opacity cursor-default"
          onClick={onCancel}
          aria-label="Close modal"
        />

        {/* Modal Content */}
        <div
          className={twMerge(
            clsx(
              'relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full',
              'transform transition-all',
              'max-h-[90vh] flex flex-col'
            )
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Book Already Exists
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ISBN: {existingBook.isbn13 || fetchedBook.isbn13 || 'Unknown'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Summary Card */}
            <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Choose how to merge book data
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {hasConflicts
                      ? 'Some fields have different values. Choose which version to keep for each field.'
                      : 'All fields are either the same or one source is empty. Review and confirm the merge.'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Cover Preview Section */}
            {(existingBook.coverUrl || fetchedBook.coverUrl) && (
              <div className="flex gap-4 items-center">
                {existingBook.coverUrl && (
                  <button
                    type="button"
                    className={twMerge(
                      clsx(
                        'cursor-pointer rounded-lg border-2 p-1',
                        showCoverPreview === 'existing'
                          ? 'border-primary-500'
                          : 'border-transparent'
                      )
                    )}
                    onClick={() =>
                      setShowCoverPreview(showCoverPreview === 'existing' ? null : 'existing')
                    }
                  >
                    <img
                      src={existingBook.coverUrl}
                      alt="Existing cover"
                      className="w-24 h-36 object-cover rounded"
                    />
                    <p className="text-xs text-center mt-1 text-gray-500">Current Cover</p>
                  </button>
                )}
                {fetchedBook.coverUrl && (
                  <button
                    type="button"
                    className={twMerge(
                      clsx(
                        'cursor-pointer rounded-lg border-2 p-1',
                        showCoverPreview === 'fetched'
                          ? 'border-primary-500'
                          : 'border-transparent'
                      )
                    )}
                    onClick={() =>
                      setShowCoverPreview(showCoverPreview === 'fetched' ? null : 'fetched')
                    }
                  >
                    <img
                      src={fetchedBook.coverUrl}
                      alt="Fetched cover"
                      className="w-24 h-36 object-cover rounded"
                    />
                    <p className="text-xs text-center mt-1 text-gray-500">Fetched Cover</p>
                  </button>
                )}
              </div>
            )}

            {/* Field Comparison Rows */}
            <div className="space-y-3">
              {FIELD_CONFIGS.map((config) => {
                const existingValue = existingBook[config.field];
                const fetchedValue = fetchedBook[config.field];
                const action = fieldActions[config.field] ?? 'keep_existing';

                return (
                  <MergeFieldRow
                    key={config.field}
                    label={config.label}
                    existingValue={
                      config.format ? config.format(existingValue) : (existingValue as React.ReactNode)
                    }
                    fetchedValue={
                      config.format ? config.format(fetchedValue) : (fetchedValue as React.ReactNode)
                    }
                    action={action}
                    onActionChange={(newAction) => handleActionChange(config.field, newAction)}
                    isArrayField={config.isArray}
                  />
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <MergeActions
              onApplyAll={handleApplyAll}
              onOverwriteAll={handleOverwriteAll}
              onKeepAll={handleKeepAll}
              onCancel={onCancel}
              isProcessing={isProcessing}
            />

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleMerge}
                loading={isProcessing}
                icon={<RefreshCw size={18} />}
              >
                Merge and Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
