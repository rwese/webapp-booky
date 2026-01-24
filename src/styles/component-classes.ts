import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility function for merging Tailwind classes
export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Layout Component Classes
// ============================================================================

// Card variants
export const cardStyles = {
  base: 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-shadow duration-200 hover:shadow-md',
  interactive: 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 active:scale-[0.99] transition-transform duration-150',
  elevated: 'bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700',
  outlined: 'bg-transparent rounded-xl border-2 border-gray-200 dark:border-gray-700',
};

// Spacing scale
export const spacing = {
  section: 'space-y-6',
  subsection: 'space-y-4',
  item: 'space-y-2',
  inline: 'gap-4',
};

// ============================================================================
// Form Component Classes
// ============================================================================

// Input field styles
export const inputStyles = {
  base: 'w-full px-4 py-2.5 rounded-lg border transition-colors duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
  error: 'border-red-500 focus:ring-red-500',
  disabled: 'opacity-50 cursor-not-allowed',
  withIcon: 'pl-10',
};

// Label styles
export const labelStyles = {
  base: 'block text-sm font-medium text-gray-700 dark:text-gray-300',
  required: 'block text-sm font-medium text-gray-700 dark:text-gray-300 after:content-["*"] after:text-red-500 after:ml-1',
};

// ============================================================================
// Button Component Classes
// ============================================================================

export const buttonStyles = {
  base: 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
  variants: {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md',
    secondary: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500',
    ghost: 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm hover:shadow-md',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-sm hover:shadow-md',
  },
  sizes: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  },
};

// ============================================================================
// Badge Component Classes
// ============================================================================

export const badgeStyles = {
  base: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  variants: {
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
};

// ============================================================================
// Text Component Classes
// ============================================================================

export const textStyles = {
  heading: {
    h1: 'text-4xl font-bold text-gray-900 dark:text-white',
    h2: 'text-3xl font-bold text-gray-900 dark:text-white',
    h3: 'text-2xl font-bold text-gray-900 dark:text-white',
    h4: 'text-xl font-bold text-gray-900 dark:text-white',
    h5: 'text-lg font-bold text-gray-900 dark:text-white',
    h6: 'text-base font-bold text-gray-900 dark:text-white',
  },
  body: {
    large: 'text-lg text-gray-700 dark:text-gray-300',
    medium: 'text-base text-gray-700 dark:text-gray-300',
    small: 'text-sm text-gray-600 dark:text-gray-400',
    tiny: 'text-xs text-gray-500 dark:text-gray-400',
  },
  muted: 'text-gray-500 dark:text-gray-400',
};

// ============================================================================
// Status Indicator Classes
// ============================================================================

export const statusStyles = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  pending: 'bg-yellow-500',
  error: 'bg-red-500',
  success: 'bg-green-500',
};

// Status colors for reading status
export const readingStatusColors = {
  want_to_read: {
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    text: 'text-blue-600 dark:text-blue-400',
  },
  currently_reading: {
    bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
  },
  read: {
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    text: 'text-green-600 dark:text-green-400',
  },
  dnf: {
    bg: 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  },
};

// ============================================================================
// Grid Layout Classes
// ============================================================================

export const gridStyles = {
  cols2: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
  cols3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  cols4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
  auto: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
};

// ============================================================================
// Animation Classes
// ============================================================================

export const animationStyles = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  bounce: 'animate-bounce',
};

// ============================================================================
// Accessibility Classes
// ============================================================================

export const a11yStyles = {
  focus: 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  srOnly: 'sr-only',
  skipLink: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:shadow-lg focus:rounded-lg',
};

// ============================================================================
// Responsive Breakpoint Classes
// ============================================================================

export const breakpointStyles = {
  mobile: 'block sm:hidden',
  tablet: 'hidden sm:block lg:hidden',
  desktop: 'hidden lg:block',
};

// Helper function to create conditional classes
export function conditionalClass(condition: boolean, trueClass: string, falseClass: string = '') {
  return condition ? trueClass : falseClass;
}

// Helper for responsive hiding/showing
export function hideOnMobile(condition: boolean, className: string) {
  return condition ? `${className} mobile:hidden` : className;
}

export function hideOnDesktop(condition: boolean, className: string) {
  return condition ? `${className} desktop:hidden` : className;
}
