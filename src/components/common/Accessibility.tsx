import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';

// Focus trap for modals
interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
  returnFocus?: boolean;
  onDeactivate?: () => void;
  className?: string;
}

export function FocusTrap({
  children,
  active = true,
  initialFocus,
  returnFocus = true,
  onDeactivate,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      if (returnFocus && previousActiveElement.current) {
        // Use setTimeout to ensure element is still in DOM
        setTimeout(() => {
          previousActiveElement.current?.focus();
        }, 0);
      }
      return;
    }

    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus the initial element or first focusable element
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      const targetElement = initialFocus?.current || focusableElements[0];
      // Use setTimeout to ensure proper focus
      setTimeout(() => {
        targetElement?.focus();
      }, 0);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDeactivate?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement || !focusableElements[0].contains(document.activeElement as HTMLElement)) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement || !focusableElements[0].contains(document.activeElement as HTMLElement)) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (returnFocus && document.activeElement === container) {
        previousActiveElement.current?.focus();
      }
    };
  }, [active, initialFocus, returnFocus, onDeactivate]);

  return (
    <div ref={containerRef} className={className} data-focus-trap-active={active}>
      {children}
    </div>
  );
}

// Focus ring component for visible focus indicators
interface FocusRingProps {
  children: React.ReactNode;
  visible?: boolean;
  className?: string;
}

export function FocusRing({ children, visible = true, className }: FocusRingProps) {
  return (
    <div className={clsx('focus-within:outline-none', visible && 'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2', className)}>
      {children}
    </div>
  );
}

// Focus styles for keyboard navigation
export function useFocusVisible() {
  const isFocusVisible = useRef(true);

  useEffect(() => {
    const handleKeyDown = () => {
      isFocusVisible.current = true;
    };

    const handleMouseDown = () => {
      isFocusVisible.current = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return isFocusVisible.current;
}

// Skip link component
interface SkipLinkProps {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ targetId, children, className }: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.tabIndex = -1;
      target.focus();
      target.removeAttribute('tabindex');
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={clsx(
        'sr-only focus:not-sr-only',
        'focus:absolute focus:top-4 focus:left-4 focus:z-50',
        'focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white',
        'focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        className
      )}
    >
      {children}
    </a>
  );
}

// Live region for announcements
interface LiveRegionProps {
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function LiveRegion({
  politeness = 'polite',
  atomic = true,
  children,
  className,
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className={clsx('sr-only', className)}
    >
      {children}
    </div>
  );
}

// Announcer for screen reader announcements
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Accessible modal component
interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: AccessibleModalProps) {
  const titleId = useMemo(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`, []);
  const descriptionId = useMemo(() => `modal-description-${Math.random().toString(36).substr(2, 9)}`, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <FocusTrap onDeactivate={onClose}>
          <div
            className={clsx(
              'relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full',
              'transform transition-all scale-100',
              sizeClasses[size]
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">{children}</div>
          </div>
        </FocusTrap>
      </div>
    </div>
  );
}

// Icon button with proper accessibility
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  loading = false,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variant === 'primary' && 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
        variant === 'secondary' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500',
        variant === 'ghost' && 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className={clsx('animate-spin', iconSizes[size])} viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <span className={iconSizes[size]}>{icon}</span>
      )}
    </button>
  );
}

// Accessible form field wrapper
interface AccessibleFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function AccessibleField({
  label,
  required = false,
  hint,
  children,
  className,
}: AccessibleFieldProps) {
  const labelId = useMemo(() => `field-label-${Math.random().toString(36).substr(2, 9)}`, []);
  const hintId = useMemo(() => `field-hint-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <label
          id={labelId}
          className="block text-sm font-medium text-gray-900 dark:text-white"
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {required && (
          <span className="sr-only">(required)</span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-gray-600 dark:text-gray-400">
          {hint}
        </p>
      )}
      <div aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable;

      if (isInputField && e.key.length === 1) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const metaMatch = shortcut.meta ? e.metaKey : true;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
          if (preventDefault) {
            e.preventDefault();
          }
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled, preventDefault]);
}

// Keyboard shortcut help dialog
interface ShortcutListProps {
  shortcuts: Array<{
    key: string;
    description: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  }>;
  className?: string;
}

export function ShortcutList({ shortcuts, className }: ShortcutListProps) {
  const formatKey = (key: string) => {
    const parts: string[] = [];
    if (key.length === 1) {
      parts.push(key.toUpperCase());
    } else {
      parts.push(key);
    }
    return parts;
  };

  return (
    <ul className={clsx('space-y-2 list-none', className)} aria-label="Keyboard shortcuts">
      {shortcuts.map((shortcut) => (
        <li 
          key={`${shortcut.ctrl}-${shortcut.key}`}
          className="flex items-center justify-between py-1"
        >
          <span className="text-gray-700 dark:text-gray-300">{shortcut.description}</span>
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">
            {[
              shortcut.ctrl && 'Ctrl',
              shortcut.meta && '⌘',
              shortcut.alt && 'Alt',
              shortcut.shift && 'Shift',
              ...formatKey(shortcut.key)
            ].filter(Boolean).join(' + ')}
          </kbd>
        </li>
      ))}
    </ul>
  );
}

// Global keyboard shortcut listener for showing/hiding help
export function useGlobalShortcutHelp(
  showHelp: () => void,
  isHelpOpen: boolean,
  toggleHelp: () => void
) {
  useKeyboardShortcuts(
    [
      {
        key: '?',
        action: toggleHelp,
        description: 'Show keyboard shortcuts'
      },
      {
        key: 'Escape',
        action: () => {
          if (isHelpOpen) {
            toggleHelp();
          }
        },
        description: 'Close dialog'
      }
    ],
    { enabled: true, preventDefault: true }
  );
}

// ============================================================================
// Live Region Enhancements
// ============================================================================

interface EnhancedLiveRegionProps {
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

// Enhanced live region with clear function
export function EnhancedLiveRegion({
  politeness = 'polite',
  atomic = true,
  children,
  className,
  id,
}: EnhancedLiveRegionProps) {
  const regionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={regionRef}
      id={id}
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className={clsx('sr-only', className)}
    >
      {children}
    </div>
  );
}

// Toast announcement helper
export function announceToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const priority = type === 'error' || type === 'warning' ? 'assertive' : 'polite';
  announce(message, priority);
}

// Search results announcement
export function announceSearchResults(count: number, query: string) {
  if (count === 0) {
    announce(`No results found for "${query}"`);
  } else if (count === 1) {
    announce(`Found 1 result for "${query}"`);
  } else {
    announce(`Found ${count} results for "${query}"`);
  }
}

// Loading state announcement
export function announceLoading(isLoading: boolean, context: string = 'content') {
  if (isLoading) {
    announce(`Loading ${context}`, 'polite');
  } else {
    announce(`${context} loaded`, 'polite');
  }
}

// Form submission announcement
export function announceFormSubmit(success: boolean, action: string = 'Form') {
  if (success) {
    announce(`${action} submitted successfully`, 'polite');
  } else {
    announce(`${action} submission failed`, 'assertive');
  }
}

// ============================================================================
// Chart Accessibility
// ============================================================================

interface ChartAccessibilityProps {
  title: string;
  description: string;
  dataSummary: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartAccessibility({
  title,
  description,
  dataSummary,
  children,
  className,
}: ChartAccessibilityProps) {
  const dataSummaryId = `chart-summary-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <figure className={className} aria-labelledby={`chart-title-${title}`} aria-describedby={dataSummaryId}>
      <figcaption id={`chart-title-${title}`} className="sr-only">
        {title}
      </figcaption>
      <div aria-hidden="true" className="sr-only">
        {description}
      </div>
      <div>
        {children}
      </div>
      <p id={dataSummaryId} className="sr-only">
        {dataSummary}
      </p>
    </figure>
  );
}

// Accessible data table as chart alternative
interface AccessibleDataTableProps {
  caption: string;
  data: Record<string, string | number>[];
  columns: Array<{
    key: string;
    header: string;
    format?: (value: string | number) => string;
  }>;
  className?: string;
}

export function AccessibleDataTable({
  caption,
  data,
  columns,
  className,
}: AccessibleDataTableProps) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const rowKey = Object.values(row).join('-');
            return (
              <tr key={rowKey} className="border-t border-gray-200 dark:border-gray-700">
                {columns.map((column) => (
                  <td
                    key={`${rowKey}-${column.key}`}
                    className="px-4 py-2 text-gray-900 dark:text-white"
                  >
                    {column.format ? column.format(row[column.key]) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Chart legend with proper ARIA
interface AccessibleChartLegendProps {
  items: Array<{
    label: string;
    color: string;
    value?: string | number;
  }>;
  className?: string;
}

export function AccessibleChartLegend({ items, className }: AccessibleChartLegendProps) {
  return (
    <ul 
      aria-label="Chart legend" 
      className={clsx('flex flex-wrap gap-4 list-none', className)}
    >
      {items.map((item) => (
        <li 
          key={`${item.label}-${item.color}`}
          className="flex items-center gap-2"
        >
          <span 
            aria-hidden="true"
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {item.label}
            {item.value !== undefined && (
              <span className="ml-1 font-medium">({item.value})</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Reduced Motion Support
// ============================================================================

export function useReducedMotion(): boolean {
  const mediaQuery = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  const getInitialState = useCallback(() => {
    if (!mediaQuery) return false;
    return mediaQuery.matches;
  }, [mediaQuery]);

  const [reducedMotion, setReducedMotion] = React.useState(getInitialState);

  useEffect(() => {
    if (!mediaQuery) return;

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mediaQuery]);

  return reducedMotion;
}

// Animation wrapper with reduced motion support
interface ReducedMotionProps {
  children: React.ReactNode;
  className?: string;
}

export function ReducedMotion({ children, className }: ReducedMotionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div 
      className={clsx(
        reducedMotion ? 'transition-none' : 'transition-all duration-200',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// High Contrast Mode Support
// ============================================================================

export function useHighContrastMode(): boolean {
  const mediaQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-contrast: more)')
    : null;

  const getInitialState = useCallback(() => {
    if (!mediaQuery) return false;
    return mediaQuery.matches;
  }, [mediaQuery]);

  const [highContrast, setHighContrast] = React.useState(getInitialState);

  useEffect(() => {
    if (!mediaQuery) return;

    const handler = (event: MediaQueryListEvent) => {
      setHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mediaQuery]);

  return highContrast;
}

// ============================================================================
// Focus Management for Dynamic Content
// ============================================================================

// Hook for managing focus when content changes
export function useFocusOnChange<T>(
  dependency: T,
  options: {
    focusElement?: React.RefObject<HTMLElement>;
    selectText?: boolean;
    delay?: number;
  } = {}
) {
  const { focusElement, selectText = false, delay = 0 } = options;

  useEffect(() => {
    if (!focusElement?.current) return;

    const timer = setTimeout(() => {
      focusElement.current?.focus();
      if (selectText && focusElement.current instanceof HTMLInputElement) {
        focusElement.current.select();
      }
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusElement, delay, selectText]);
}

// Trap focus within a list when items are added/removed
export function useListFocusManagement<T extends { id: string }>(
  _items: T[],
  activeId: string | null,
  listRef: React.RefObject<HTMLElement>
) {
  useEffect(() => {
    if (!listRef.current || !activeId) return;

    const activeElement = listRef.current.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    if (activeElement) {
      activeElement.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, listRef]);
}

// ============================================================================
// Screen Reader Only Content
// ============================================================================

interface VisuallyHiddenProps {
  children: React.ReactNode;
  as?: 'span' | 'div' | 'p' | 'strong' | 'em';
  className?: string;
}

export function VisuallyHidden({ 
  children, 
  as: Component = 'span',
  className 
}: VisuallyHiddenProps) {
  return (
    <Component className={clsx('sr-only', className)}>
      {children}
    </Component>
  );
}

// ============================================================================
// Loading State Accessibility
// ============================================================================

interface LoadingAnnouncementProps {
  isLoading: boolean;
  message: string;
  successMessage?: string;
}

export function useLoadingAnnouncement({
  isLoading,
  message,
  successMessage,
}: LoadingAnnouncementProps) {
  useEffect(() => {
    if (isLoading) {
      announce(message, 'polite');
    } else if (successMessage && !isLoading) {
      announce(successMessage, 'polite');
    }
  }, [isLoading, message, successMessage]);
}

// Skeleton loading with screen reader support
interface AccessibleSkeletonProps {
  className?: string;
  ariaLabel?: string;
}

export function AccessibleSkeleton({ className, ariaLabel = 'Loading content' }: AccessibleSkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200 dark:bg-gray-700 rounded',
        className
      )}
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      <VisuallyHidden>Loading content</VisuallyHidden>
    </div>
  );
}
