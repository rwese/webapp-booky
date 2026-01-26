import { useCallback, useRef, useState } from 'react';

// Extend Performance interface to include memory API
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

/**
 * Performance monitoring hook for tracking large library operations
 */
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<{
    lastQueryTime: number | null;
    averageQueryTime: number;
    totalQueries: number;
    memoryUsage: number | null;
  }>({
    lastQueryTime: null,
    averageQueryTime: 0,
    totalQueries: 0,
    memoryUsage: null
  });

  const queryTimesRef = useRef<number[]>([]);

  const measureQuery = useCallback(async <T,>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await queryFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Update metrics
      queryTimesRef.current.push(duration);
      if (queryTimesRef.current.length > 100) {
        queryTimesRef.current.shift(); // Keep last 100 queries
      }
      
      const total = queryTimesRef.current.reduce((a, b) => a + b, 0);
      const average = total / queryTimesRef.current.length;
      
      // Get memory usage if available
      let memoryUsage: number | null = null;
      const perfWithMemory = performance as PerformanceWithMemory;
      if (perfWithMemory.memory) {
        memoryUsage = perfWithMemory.memory.usedJSHeapSize;
      }
      
      setMetrics({
        lastQueryTime: duration,
        averageQueryTime: Math.round(average * 100) / 100,
        totalQueries: queryTimesRef.current.length,
        memoryUsage
      });
      
      return result;
    } catch (error) {
      console.error(`[Performance] ${queryName} failed:`, error);
      throw error;
    }
  }, []);

  const getMemoryUsage = useCallback(() => {
    const perfWithMemory = performance as PerformanceWithMemory;
    if (perfWithMemory.memory) {
      const mem = perfWithMemory.memory;
      return {
        used: (mem.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        total: (mem.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
        limit: (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
      };
    }
    return null;
  }, []);

  const clearMetrics = useCallback(() => {
    queryTimesRef.current = [];
    setMetrics({
      lastQueryTime: null,
      averageQueryTime: 0,
      totalQueries: 0,
      memoryUsage: null
    });
  }, []);

  return {
    metrics,
    measureQuery,
    getMemoryUsage,
    clearMetrics
  };
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualList<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  overscan: number = 3
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = {
    start: Math.floor(scrollTop / itemHeight),
    end: Math.ceil((scrollTop + containerHeight) / itemHeight)
  };

  const renderStart = Math.max(0, visibleRange.start - overscan);
  const renderEnd = Math.min(items.length, visibleRange.end + overscan);

  const visibleItems = items.slice(renderStart, renderEnd).map((item, index) => ({
    item,
    index: renderStart + index,
    style: {
      position: 'absolute' as const,
      top: (renderStart + index) * itemHeight,
      height: itemHeight,
      width: '100%'
    }
  }));

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    scrollTop,
    renderStart,
    renderEnd
  };
}

/**
 * Intersection observer hook for lazy loading
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const _elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      const observer = new IntersectionObserver(([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      }, options);

      observerRef.current = observer;
      observer.observe(node);
    }
  }, [hasIntersected, options]);

  return { ref: setRef, isIntersecting, hasIntersected };
}

/**
 * Debounced search hook optimized for large datasets
 */
export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T>,
  delay: number = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!newQuery.trim()) {
      setResults(null);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchFn(newQuery);
        setResults(result);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, delay);
  }, [searchFn, delay]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setQuery('');
    setResults(null);
    setLoading(false);
  }, []);

  return { query, results, loading, search, clear };
}
