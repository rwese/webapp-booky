import React, { useEffect, useRef, useCallback, useState } from 'react';

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Throttle hook
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledCallback = useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);

  return throttledCallback as T;
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true);
      }
    }, options);

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [options, hasIntersected]);

  return { targetRef, isIntersecting, hasIntersected };
}

// Local storage hook with SSR support
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

// Media query hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// Previous value hook
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// Click outside hook
export function useClickOutside(
  callback: () => void
): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback]);

  return ref;
}

// Keyboard navigation hook
export function useKeyboardNavigation(
  itemsCount: number,
  options?: {
    loop?: boolean;
    orientation?: 'horizontal' | 'vertical' | 'both';
  }
) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { loop = true, orientation = 'both' } = options || {};
      
      let newIndex = focusedIndex;

      switch (event.key) {
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') {
            event.preventDefault();
            newIndex = Math.min(focusedIndex + 1, itemsCount - 1);
          }
          break;
        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') {
            event.preventDefault();
            newIndex = Math.max(focusedIndex - 1, 0);
          }
          break;
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') {
            event.preventDefault();
            newIndex = Math.min(focusedIndex + 1, itemsCount - 1);
          }
          break;
        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') {
            event.preventDefault();
            newIndex = Math.max(focusedIndex - 1, 0);
          }
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = itemsCount - 1;
          break;
        case 'Tab':
          if (!loop && focusedIndex === itemsCount - 1) {
            return;
          }
          break;
      }

      if (loop && newIndex >= itemsCount) {
        newIndex = 0;
      } else if (loop && newIndex < 0) {
        newIndex = itemsCount - 1;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
      }
    },
    [focusedIndex, itemsCount, options]
  );

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}

// Copy to clipboard hook
export function useCopyToClipboard(): [
  boolean,
  (text: string) => Promise<boolean>
] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopied(false);
      return false;
    }
  }, []);

  return [copied, copy];
}

// Touch device detection hook
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);

    const handleTouchStart = () => setIsTouch(true);
    window.addEventListener('touchstart', handleTouchStart, { once: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  return isTouch;
}

// Performance measurement hook
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<{
    fcp: number | null;
    lcp: number | null;
    cls: number | null;
    fid: number | null;
  }>({
    fcp: null,
    lcp: null,
    cls: null,
    fid: null,
  });

  useEffect(() => {
    if ('PerformanceObserver' in window) {
      try {
        // First Contentful Paint
        const fcpObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntriesByName('first-contentful-paint')) {
            setMetrics((prev) => ({ ...prev, fcp: entry.startTime }));
          }
        });
        fcpObserver.observe({ type: 'paint', buffered: true });

        // Largest Contentful Paint
        let lcpObserver: PerformanceObserver | null = null;
        if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('lcp')) {
          try {
            lcpObserver = new PerformanceObserver((entryList) => {
              const entries = entryList.getEntries();
              const lastEntry = entries[entries.length - 1];
              setMetrics((prev) => ({ ...prev, lcp: lastEntry.startTime }));
            });
            lcpObserver.observe({ type: 'lcp', buffered: true });
          } catch (error) {
            console.debug('LCP observation failed:', error);
            lcpObserver = null;
          }
        } else {
          console.debug('LCP entry type not supported in this browser');
        }

        // Cumulative Layout Shift
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(entry as any).hadRecentInput) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              clsValue += (entry as any).value;
              setMetrics((prev) => ({ ...prev, cls: clsValue }));
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });

        // First Input Delay
        const fidObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMetrics((prev) => ({ ...prev, fid: (entry as any).processingStart - entry.startTime }));
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });

        return () => {
          fcpObserver.disconnect();
          if (lcpObserver) lcpObserver.disconnect();
          clsObserver.disconnect();
          fidObserver.disconnect();
        };
      } catch (error) {
        console.error('PerformanceObserver not supported:', error);
      }
    }
  }, []);

  return metrics;
}

// Lazy loading hook for components
export function useLazyLoad(threshold = 0.1) {
  const { targetRef, hasIntersected } = useIntersectionObserver({
    threshold,
    rootMargin: '100px',
  });

  return { containerRef: targetRef, shouldLoad: hasIntersected };
}

// Image lazy loading hook
export function useImageLazyLoad(src: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { targetRef, hasIntersected } = useIntersectionObserver();

  useEffect(() => {
    if (!hasIntersected || isLoaded || error) return;

    const img = new Image();
    img.src = src;
    
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setError(true);

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [hasIntersected, src, isLoaded, error]);

  return { isLoaded, error, containerRef: targetRef };
}
