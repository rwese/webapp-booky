import { useState, useCallback } from 'react';
import { BookOpen, Clock, CheckCircle, XCircle } from 'lucide-react';
import { readingLogOperations } from '../../lib/db';
import type { ReadingStatus } from '../../types';
import { useToastStore } from '../../store/useStore';
import { clsx } from 'clsx';

interface StatusSelectorProps {
  bookId: string;
  currentStatus?: ReadingStatus;
  onStatusChange?: (status: ReadingStatus) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'buttons' | 'dropdown' | 'tabs';
}

const statusConfig: Record<ReadingStatus, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  want_to_read: {
    label: 'Want to Read',
    icon: <BookOpen size={16} />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  },
  currently_reading: {
    label: 'Reading',
    icon: <Clock size={16} />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
  },
  read: {
    label: 'Finished',
    icon: <CheckCircle size={16} />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
  },
  dnf: {
    label: 'Did Not Finish',
    icon: <XCircle size={16} />,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700',
  },
};

export function StatusSelector({
  bookId,
  currentStatus,
  onStatusChange,
  size = 'md',
  variant = 'buttons',
}: StatusSelectorProps) {
  const { addToast } = useToastStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = useCallback(
    async (status: ReadingStatus) => {
      if (status === currentStatus) return;

      setIsUpdating(true);
      try {
        const readingLog = {
          id: crypto.randomUUID(),
          bookId,
          status,
          startedAt: status === 'currently_reading' ? new Date() : undefined,
          finishedAt: status === 'read' ? new Date() : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await readingLogOperations.upsert(readingLog);
        onStatusChange?.(status);
        addToast({ type: 'success', message: `Status updated to ${statusConfig[status].label}` });
      } catch (error) {
        console.error('Failed to update status:', error);
        addToast({ type: 'error', message: 'Failed to update reading status' });
      } finally {
        setIsUpdating(false);
      }
    },
    [bookId, currentStatus, onStatusChange, addToast]
  );

  const buttonClassName = size === 'sm' ? 'px-2 py-1 text-xs' : size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-sm';

  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <select
          value={currentStatus || ''}
          onChange={(e) => handleStatusChange(e.target.value as ReadingStatus)}
          disabled={isUpdating}
          className={clsx(
            'input appearance-none pr-8',
            buttonClassName,
            currentStatus && statusConfig[currentStatus]?.bgColor
          )}
        >
          <option value="">Set Status</option>
          {(Object.keys(statusConfig) as ReadingStatus[]).map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {currentStatus && (
            <span className={statusConfig[currentStatus as ReadingStatus]?.color}>
              {statusConfig[currentStatus as ReadingStatus]?.icon}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'tabs') {
    return (
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {(Object.keys(statusConfig) as ReadingStatus[]).map((status) => {
          const isActive = currentStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              disabled={isUpdating}
              className={clsx(
                'flex items-center gap-1.5 rounded-md transition-all flex-1 justify-center',
                buttonClassName,
                isActive
                  ? statusConfig[status].bgColor + ' ' + statusConfig[status].color + ' font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'
              )}
            >
              {statusConfig[status].icon}
              <span className="hidden sm:inline">{statusConfig[status].label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default: buttons variant
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(statusConfig) as ReadingStatus[]).map((status) => {
        const isActive = currentStatus === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => handleStatusChange(status)}
            disabled={isUpdating}
            className={clsx(
              'flex items-center gap-1.5 rounded-full border transition-all',
              buttonClassName,
              isActive
                ? statusConfig[status].bgColor + ' ' + statusConfig[status].color + ' font-medium'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            {statusConfig[status].icon}
            <span>{statusConfig[status].label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Compact version for use in cards and lists
export function StatusBadge({
  status,
  size = 'md',
}: {
  status?: ReadingStatus;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
        <BookOpen size={12} />
        <span>Unread</span>
      </span>
    );
  }

  const config = statusConfig[status];
  const iconSize = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1.5 text-base' : 'px-2 py-0.5 text-xs',
        config.bgColor + ' ' + config.color + ' font-medium'
      )}
    >
      <span style={{ width: iconSize, height: iconSize }}>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
