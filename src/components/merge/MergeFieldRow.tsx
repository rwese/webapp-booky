import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArrowRight, Copy, X } from 'lucide-react';
import { Button } from '../common/Button';

export type MergeAction = 'keep_existing' | 'copy_fetched' | 'apply_if_empty';

export interface MergeFieldRowProps {
  label: string;
  existingValue: React.ReactNode;
  fetchedValue: React.ReactNode;
  action: MergeAction;
  onActionChange: (action: MergeAction) => void;
  isArrayField?: boolean;
  className?: string;
}

export function MergeFieldRow({
  label,
  existingValue,
  fetchedValue,
  action,
  onActionChange,
  isArrayField = false,
  className,
}: MergeFieldRowProps) {
  const hasExisting = existingValue !== undefined && existingValue !== null && existingValue !== '';
  const hasFetched = fetchedValue !== undefined && fetchedValue !== null && fetchedValue !== '';
  const isDifferent = hasExisting && hasFetched && String(existingValue) !== String(fetchedValue);

  const renderValue = (value: React.ReactNode) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400 italic">Empty</span>;
    }
    if (isArrayField && Array.isArray(value)) {
      return value.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.map((item) => (
            <span
              key={String(item)}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-gray-400 italic">Empty</span>
      );
    }
    return <span className="text-gray-900 dark:text-gray-100">{value}</span>;
  };

  return (
    <div
      className={twMerge(
        clsx(
          'grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-3 rounded-lg border transition-colors',
          isDifferent
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
          className
        )
      )}
    >
      {/* Field Label */}
      <div className="md:col-span-2 flex items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>

      {/* Existing Value */}
      <div className="md:col-span-4 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-600">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current in Collection</div>
        <div className="text-sm">{renderValue(existingValue)}</div>
      </div>

      {/* Action Buttons */}
      <div className="md:col-span-2 flex flex-col gap-1 justify-center">
        {hasFetched && (
          <>
            <Button
              variant={action === 'copy_fetched' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onActionChange('copy_fetched')}
              className="text-xs"
              title="Replace with fetched data"
            >
              <Copy size={14} />
              Copy
            </Button>
            <Button
              variant={action === 'apply_if_empty' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onActionChange('apply_if_empty')}
              className="text-xs"
              disabled={!hasExisting}
              title="Keep existing, but fill empty fields from fetched data"
            >
              <ArrowRight size={14} />
              Fill Empty
            </Button>
          </>
        )}
        <Button
          variant={action === 'keep_existing' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onActionChange('keep_existing')}
          className="text-xs"
          title="Keep current value"
        >
          <X size={14} />
          Keep Original
        </Button>
      </div>

      {/* Fetched Value */}
      <div className="md:col-span-4 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-600">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fetched Data</div>
        <div className="text-sm">{renderValue(fetchedValue)}</div>
      </div>
    </div>
  );
}

export interface MergeActionsProps {
  onApplyAll: () => void;
  onOverwriteAll: () => void;
  onKeepAll: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function MergeActions({
  onApplyAll,
  onOverwriteAll,
  onKeepAll,
  onCancel,
  isProcessing = false,
}: MergeActionsProps) {
  const [showOverwriteConfirm, setShowOverwriteConfirm] = React.useState(false);

  const handleOverwriteAll = () => {
    if (showOverwriteConfirm) {
      onOverwriteAll();
      setShowOverwriteConfirm(false);
    } else {
      setShowOverwriteConfirm(true);
    }
  };

  return (
    <div className="flex flex-wrap gap-3 justify-center pt-4 border-t border-gray-200 dark:border-gray-700">
      <Button
        variant="primary"
        onClick={onApplyAll}
        disabled={isProcessing}
        icon={<Copy size={18} />}
      >
        Apply All
      </Button>

      <Button
        variant={showOverwriteConfirm ? 'danger' : 'secondary'}
        onClick={handleOverwriteAll}
        disabled={isProcessing}
        icon={<ArrowRight size={18} />}
      >
        {showOverwriteConfirm ? 'Confirm Overwrite?' : 'Overwrite All'}
      </Button>

      <Button
        variant="ghost"
        onClick={onKeepAll}
        disabled={isProcessing}
        icon={<X size={18} />}
      >
        Keep Original
      </Button>

      <Button
        variant="ghost"
        onClick={onCancel}
        disabled={isProcessing}
      >
        Cancel
      </Button>

      {showOverwriteConfirm && (
        <div className="w-full text-center mt-2">
          <p className="text-sm text-red-600 dark:text-red-400">
            This will replace all current values with fetched data. This action cannot be undone.
          </p>
        </div>
      )}
    </div>
  );
}
