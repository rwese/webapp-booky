import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { clsx } from 'clsx';

// Focus trap for modals
interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
  onDeactivate?: () => void;
  className?: string;
}

export function FocusTrap({
  children,
  active = true,
  initialFocus,
  onDeactivate,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
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
      targetElement?.focus();
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
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (document.activeElement === container) {
        previousActiveElement.current?.focus();
      }
    };
  }, [active, initialFocus, onDeactivate]);

  return (
    <div ref={containerRef} className={className} data-focus-trap-active={active}>
      {children}
    </div>
  );
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
