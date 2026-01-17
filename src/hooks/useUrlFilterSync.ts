import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FilterConfig, SortConfig } from '../types';

/**
 * URL query parameter keys for filter state
 */
const URL_PARAMS = {
  search: 'q',
  tags: 'tags',
  collections: 'collections',
  formats: 'formats',
  statuses: 'statuses',
  minRating: 'minRating',
  maxRating: 'maxRating',
  sortField: 'sort',
  sortDirection: 'dir',
  page: 'page',
} as const;

/**
 * Maps filter configuration to URL search params
 */
export function filtersToUrlParams(config: FilterConfig, sortConfig: SortConfig): URLSearchParams {
  const params = new URLSearchParams();

  // Search query
  if (config.search) {
    params.set(URL_PARAMS.search, config.search);
  }

  // Tags (comma-separated)
  if (config.tags && config.tags.length > 0) {
    params.set(URL_PARAMS.tags, config.tags.join(','));
  }

  // Collections (comma-separated)
  if (config.collections && config.collections.length > 0) {
    params.set(URL_PARAMS.collections, config.collections.join(','));
  }

  // Formats (comma-separated)
  if (config.formats && config.formats.length > 0) {
    params.set(URL_PARAMS.formats, config.formats.join(','));
  }

  // Statuses (comma-separated)
  if (config.statuses && config.statuses.length > 0) {
    params.set(URL_PARAMS.statuses, config.statuses.join(','));
  }

  // Rating range
  if (config.minRating !== undefined && config.minRating !== null) {
    params.set(URL_PARAMS.minRating, String(config.minRating));
  }

  if (config.maxRating !== undefined && config.maxRating !== null) {
    params.set(URL_PARAMS.maxRating, String(config.maxRating));
  }

  // Sort config
  if (sortConfig.field) {
    params.set(URL_PARAMS.sortField, sortConfig.field);
  }

  if (sortConfig.direction) {
    params.set(URL_PARAMS.sortDirection, sortConfig.direction);
  }

  return params;
}

/**
 * Parses URL search params into filter and sort configurations
 */
export function urlParamsToFilters(searchParams: URLSearchParams): {
  filterConfig: Partial<FilterConfig>;
  sortConfig: Partial<SortConfig>;
  page: number | undefined;
} {
  const filterConfig: Partial<FilterConfig> = {};
  const sortConfig: Partial<SortConfig> = {};

  // Search query
  const search = searchParams.get(URL_PARAMS.search);
  if (search) {
    filterConfig.search = search;
  }

  // Tags
  const tags = searchParams.get(URL_PARAMS.tags);
  if (tags) {
    filterConfig.tags = tags.split(',').filter(Boolean);
  }

  // Collections
  const collections = searchParams.get(URL_PARAMS.collections);
  if (collections) {
    filterConfig.collections = collections.split(',').filter(Boolean);
  }

  // Formats
  const formats = searchParams.get(URL_PARAMS.formats);
  if (formats) {
    filterConfig.formats = formats.split(',') as FilterConfig['formats'];
  }

  // Statuses
  const statuses = searchParams.get(URL_PARAMS.statuses);
  if (statuses) {
    filterConfig.statuses = statuses.split(',') as FilterConfig['statuses'];
  }

  // Rating range
  const minRating = searchParams.get(URL_PARAMS.minRating);
  if (minRating !== null) {
    const parsed = parseFloat(minRating);
    if (!isNaN(parsed)) {
      filterConfig.minRating = parsed;
    }
  }

  const maxRating = searchParams.get(URL_PARAMS.maxRating);
  if (maxRating !== null) {
    const parsed = parseFloat(maxRating);
    if (!isNaN(parsed)) {
      filterConfig.maxRating = parsed;
    }
  }

  // Sort config
  const sortField = searchParams.get(URL_PARAMS.sortField);
  if (sortField) {
    sortConfig.field = sortField;
  }

  const sortDirection = searchParams.get(URL_PARAMS.sortDirection);
  if (sortDirection) {
    sortConfig.direction = sortDirection as 'asc' | 'desc';
  }

  // Page
  const page = searchParams.get(URL_PARAMS.page);
  const parsedPage = page ? parseInt(page, 10) : undefined;

  return { filterConfig, sortConfig, page: parsedPage };
}

/**
 * Hook for synchronizing library filter state with URL query parameters
 *
 * Features:
 * - Two-way sync: filters ↔ URL params
 * - Handles browser back/forward navigation
 * - Supports shareable/bookmarkable URLs
 * - Debounced updates to avoid excessive history entries
 */
export function useUrlFilterSync(
  filterConfig: FilterConfig,
  sortConfig: SortConfig,
  onFilterChange: (config: FilterConfig) => void,
  onSortChange: (config: SortConfig) => void,
  options: {
    debounceMs?: number;
    excludedParams?: (keyof FilterConfig | 'sortField' | 'sortDirection')[];
  } = {}
) {
  const { debounceMs = 300, excludedParams = [] } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  // Track if the update is from URL (to avoid infinite loops)
  const isUpdatingFromUrl = useRef(false);

  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse URL params on mount and when params change
  useEffect(() => {
    const { filterConfig: urlFilterConfig, sortConfig: urlSortConfig } =
      urlParamsToFilters(searchParams);

    // Only update if there are actual changes from URL
    const hasFilterChanges =
      urlFilterConfig.search !== filterConfig.search ||
      JSON.stringify(urlFilterConfig.tags) !== JSON.stringify(filterConfig.tags) ||
      JSON.stringify(urlFilterConfig.collections) !== JSON.stringify(filterConfig.collections) ||
      JSON.stringify(urlFilterConfig.formats) !== JSON.stringify(filterConfig.formats) ||
      JSON.stringify(urlFilterConfig.statuses) !== JSON.stringify(filterConfig.statuses) ||
      urlFilterConfig.minRating !== filterConfig.minRating ||
      urlFilterConfig.maxRating !== filterConfig.maxRating;

    const hasSortChanges =
      urlSortConfig.field !== sortConfig.field ||
      urlSortConfig.direction !== sortConfig.direction;

    if (hasFilterChanges) {
      isUpdatingFromUrl.current = true;
      onFilterChange({ ...filterConfig, ...urlFilterConfig });
    }

    if (hasSortChanges) {
      isUpdatingFromUrl.current = true;
      onSortChange({ ...sortConfig, ...urlSortConfig });
    }

    // Short timeout to reset the flag after state updates
    const timer = setTimeout(() => {
      isUpdatingFromUrl.current = false;
    }, 50);

    return () => clearTimeout(timer);
  }, [searchParams, filterConfig, sortConfig, onFilterChange, onSortChange]);

  // Update URL when filter/sort config changes (not from URL)
  useEffect(() => {
    if (isUpdatingFromUrl.current) {
      return;
    }

    // Clear any pending update
    if (updateTimer.current) {
      clearTimeout(updateTimer.current);
      updateTimer.current = null;
    }

    // Debounce URL updates
    const timer = setTimeout(() => {
      const params = filtersToUrlParams(filterConfig, sortConfig);

      // Preserve existing params that are excluded
      excludedParams.forEach((key) => {
        const urlKey = URL_PARAMS[key as keyof typeof URL_PARAMS];
        if (urlKey) {
          const value = searchParams.get(urlKey);
          if (value !== null) {
            params.set(urlKey, value);
          }
        }
      });

      setSearchParams(params, { replace: true });
    }, debounceMs);

    updateTimer.current = timer;

    return () => clearTimeout(timer);
  }, [filterConfig, sortConfig, debounceMs, excludedParams, setSearchParams, searchParams]);

  // Clear filters function that also updates URL
  const clearFilters = useCallback(() => {
    onFilterChange({});
    onSortChange({ field: 'addedAt', direction: 'desc' });
    setSearchParams({}, { replace: true });
  }, [onFilterChange, onSortChange, setSearchParams]);

  // Get current page from URL
  const getCurrentPage = useCallback((): number => {
    const page = searchParams.get(URL_PARAMS.page);
    return page ? parseInt(page, 10) : 1;
  }, [searchParams]);

  // Set page in URL
  const setPageInUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams);
      if (page > 1) {
        params.set(URL_PARAMS.page, String(page));
      } else {
        params.delete(URL_PARAMS.page);
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return {
    clearFilters,
    getCurrentPage,
    setPageInUrl,
    // Expose URL params for advanced use cases
    urlParams: URL_PARAMS,
  };
}
