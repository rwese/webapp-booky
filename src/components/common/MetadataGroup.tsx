import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

interface MetadataGroupProps {
  title: string;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function MetadataGroup({
  title,
  icon,
  defaultExpanded = true,
  children,
  className,
}: MetadataGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  // Calculate content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    }
  }, [isExpanded]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className={clsx('border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-3',
          'bg-gray-50 dark:bg-gray-800/50',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'transition-colors duration-200',
          'text-left'
        )}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-gray-500 dark:text-gray-400">
              {icon}
            </span>
          )}
          <span className="font-medium text-gray-900 dark:text-white">
            {title}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={clsx(
            'text-gray-500 dark:text-gray-400 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Content */}
      <div
        ref={contentRef}
        style={{ height: typeof contentHeight === 'number' ? `${contentHeight}px` : contentHeight }}
        className="overflow-hidden transition-all duration-300 ease-in-out"
      >
        <div className="p-4 bg-white dark:bg-gray-900">
          {children}
        </div>
      </div>
    </div>
  );
}

// Inline metadata item for consistent display
interface MetadataItemProps {
  label: string;
  value?: string | number | null | React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function MetadataItem({ label, value, icon, className }: MetadataItemProps) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div className={clsx('flex items-start gap-3', className)}>
      {icon && (
        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <span className="text-gray-500 dark:text-gray-400">
            {icon}
          </span>
        </div>
      )}
      <div className={clsx(!icon && 'pl-11')}>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
          {value}
        </p>
      </div>
    </div>
  );
}

// Grid layout for metadata items
interface MetadataGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function MetadataGrid({ children, columns = 2, className }: MetadataGridProps) {
  return (
    <div
      className={clsx(
        'grid gap-4',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  );
}

// Section wrapper for grouping multiple metadata groups
interface MetadataSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function MetadataSection({ title, children, className }: MetadataSectionProps) {
  return (
    <section className={className}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}
