import { useState, useCallback } from 'react';
import { BookOpen, Check, Clock, XCircle, Calendar, ChevronDown } from 'lucide-react';
import { Button, Card, Badge } from '../common/Button';
import { readingLogOperations, bookOperations } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ReadingStatus, Book as BookType } from '../../types';
import { clsx } from 'clsx';

// Reading status configurations
export const READING_STATUS_CONFIG: Record<ReadingStatus, { 
  label: string; 
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  description: string;
}> = {
  want_to_read: {
    label: 'Want to Read',
    icon: BookOpen,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Books you plan to read'
  },
  currently_reading: {
    label: 'Currently Reading',
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    description: 'Books you are reading now'
  },
  read: {
    label: 'Read',
    icon: Check,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Books you have finished'
  },
  dnf: {
    label: 'Did Not Finish',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Books you did not finish'
  }
};

interface ReadingStatusSelectorProps {
  bookId: string;
  currentStatus?: ReadingStatus;
  onStatusChange: (status: ReadingStatus, additionalData?: { finishedAt?: Date; dnfReason?: string }) => void;
  className?: string;
}

export function ReadingStatusSelector({ 
  currentStatus, 
  onStatusChange,
  className 
}: ReadingStatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDnfReason, setShowDnfReason] = useState(false);
  const [dnfReason, setDnfReason] = useState('');

  const currentStatusConfig = currentStatus ? READING_STATUS_CONFIG[currentStatus] : null;

  const handleStatusSelect = useCallback((status: ReadingStatus) => {
    if (status === 'dnf') {
      setShowDnfReason(true);
    } else {
      const additionalData = status === 'read' ? { finishedAt: new Date() } : undefined;
      onStatusChange(status, additionalData);
      setIsOpen(false);
    }
  }, [onStatusChange]);

  const handleDnfConfirm = useCallback(() => {
    onStatusChange('dnf', { dnfReason: dnfReason.trim() || undefined });
    setShowDnfReason(false);
    setDnfReason('');
    setIsOpen(false);
  }, [dnfReason, onStatusChange]);

  return (
    <div className={clsx('relative', className)}>
      {/* Current Status Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'input flex items-center justify-between gap-2 min-w-[180px]',
          currentStatusConfig && currentStatusConfig.bgColor
        )}
      >
        <span className="flex items-center gap-2">
          {currentStatusConfig ? (
            <>
              <currentStatusConfig.icon size={16} className={currentStatusConfig.color} />
              <span className="text-sm font-medium">{currentStatusConfig.label}</span>
            </>
          ) : (
            <>
              <BookOpen size={16} />
              <span className="text-sm font-medium">Set Status</span>
            </>
          )}
        </span>
        <ChevronDown size={16} className={clsx('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Status Selection Dropdown */}
      {isOpen && !showDnfReason && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
          {(Object.keys(READING_STATUS_CONFIG) as ReadingStatus[]).map(status => {
            const config = READING_STATUS_CONFIG[status];
            const isCurrent = status === currentStatus;
            
            return (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusSelect(status)}
                disabled={isCurrent}
                className={clsx(
                  'w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700',
                  isCurrent && 'bg-gray-50 dark:bg-gray-700 cursor-default',
                  !isCurrent && 'cursor-pointer'
                )}
              >
                <config.icon size={16} className={config.color} />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{config.label}</span>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
                {isCurrent && <Check size={14} className="text-green-600" />}
              </button>
            );
          })}
        </div>
      )}

      {/* DNF Reason Input */}
      {showDnfReason && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Why didn't you finish this book?</h4>
          <textarea
            value={dnfReason}
            onChange={(e) => setDnfReason(e.target.value)}
            placeholder="Optional: Add a reason (lost interest, too long, etc.)"
            className="input min-h-[80px] mb-2"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleDnfConfirm}>Confirm DNF</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowDnfReason(false); setDnfReason(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reading History Component
interface ReadingHistoryProps {
  bookId: string;
  className?: string;
}

export function ReadingHistory({ bookId, className }: ReadingHistoryProps) {
  const readingHistory = useLiveQuery(
    () => readingLogOperations.getHistory(bookId),
    [bookId]
  );

  if (!readingHistory || readingHistory.length === 0) {
    return (
      <div className={clsx('text-center py-4 text-gray-500', className)}>
        <Clock size={24} className="mx-auto mb-2 opacity-50" />
        <p>No reading history yet</p>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-2', className)}>
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Reading History</h4>
      {readingHistory.map((log, index) => {
        const config = READING_STATUS_CONFIG[log.status];
        const isLatest = index === readingHistory.length - 1;
        
        return (
          <div
            key={log.id}
            className={clsx(
              'flex items-center gap-3 p-2 rounded-lg',
              isLatest ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-800'
            )}
          >
            <div className={clsx('p-1.5 rounded', config.bgColor)}>
              <config.icon size={14} className={config.color} />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{config.label}</span>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={10} />
                {new Date(log.createdAt).toLocaleDateString()}
              </div>
            </div>
            {isLatest && <Badge variant="primary">Latest</Badge>}
          </div>
        );
      })}
    </div>
  );
}

// Currently Reading Section
interface CurrentlyReadingProps {
  limit?: number;
  className?: string;
}

export function CurrentlyReadingSection({ limit = 5, className }: CurrentlyReadingProps) {
  const currentlyReading = useLiveQuery(
    async () => {
      const logs = await readingLogOperations.getAllByStatus('currently_reading');
      const recentLogs = logs.slice(-10); // Get most recent
      const bookIds = recentLogs.map(log => log.bookId);
      const books = await bookOperations.getAll();
      return bookIds
        .map(id => books.find(book => book.id === id))
        .filter(Boolean)
        .slice(0, limit) as BookType[];
    },
    [limit]
  );

  if (!currentlyReading || currentlyReading.length === 0) {
    return (
      <div className={clsx('text-center py-6 text-gray-500', className)}>
        <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
        <p>Not reading anything right now</p>
      </div>
    );
  }

  return (
    <div className={clsx('grid gap-3', className)}>
      {currentlyReading.map(book => (
        <Card key={book.id} hover className="p-3">
          <div className="flex gap-3">
            <div className="w-12 h-16 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen size={20} className="text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">{book.title}</h4>
              <p className="text-sm text-gray-500 truncate">{book.authors.join(', ')}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Status Badge Component
interface StatusBadgeProps {
  status: ReadingStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = READING_STATUS_CONFIG[status];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.bgColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <Icon size={size === 'sm' ? 10 : size === 'md' ? 12 : 14} />
      {config.label}
    </span>
  );
}
