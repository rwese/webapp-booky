/**
 * Hooks Index
 *
 * Barrel export file for all custom React hooks.
 */

// Book hooks
export { useBooks, useBook, useSearchBooks, useFilteredBooks, useFilteredBooksPaginated, useRating, useRatings, useTags, useBookTags } from './useBooks';
export { useBookLookup } from './useBookLookup';
export { useBookMetadataRefresh } from './useBookMetadataRefresh';

// Backup hooks
export { useBackup } from './useBackup';

// Barcode Scanner hooks
export { useBarcodeScanner } from './useBarcodeScanner';
export { useManualISBNEntry } from './useManualISBNEntry';
export { useBatchScanning } from './useBatchScanning';

// Reading hooks
export { useReadingGoals, useGoalForm } from './useReadingGoals';
export { useReadingStreak } from './useReadingStreak';

// Analytics hooks
export { useReadingAnalytics, useReadingHistory, useGenreDistribution, useGenreRanking, useTagDistribution, useTagRanking, useFormatDistribution, useRatingDistribution, useStarCountRanking } from './useAnalytics';

// Offline hooks
export { useOnlineStatus } from './useOffline';
export { useDatabaseRecovery } from './useDatabaseRecovery';

// Camera hooks
export { useCameraCapture } from './useCameraCapture';

// Merge hooks
export { useMerge } from './useMerge';

// Performance hooks (utility functions)
export { useDebounce, useThrottle, useIntersectionObserver, useLocalStorage, useMediaQuery, usePrevious, useClickOutside, useKeyboardNavigation, useCopyToClipboard, useIsTouchDevice, usePerformanceMetrics, useLazyLoad, useImageLazyLoad } from './usePerformance';

// Utility hooks
export { useUrlFilterSync } from './useUrlFilterSync';

// Cloud hooks
export { useCloudBooks } from './useCloudBooks';
