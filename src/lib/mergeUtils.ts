import type { Book } from '../types';

// ============================================================================
// Types
// ============================================================================

export type MergeStrategy = 'keep-existing' | 'keep-fetched' | 'fill-empty' | 'selective';

export type MergeAction = 'keep-existing' | 'copy-fetched' | 'apply-if-empty';

export interface MergeFieldComparison {
  field: string;
  existing: unknown;
  fetched: unknown;
  hasConflict: boolean;
  hasExisting: boolean;
  hasFetched: boolean;
}

export interface MergePreview {
  fields: MergeFieldComparison[];
  emptyFields: string[];
  conflicts: string[];
  totalFields: number;
  fieldsWithData: number;
}

// ============================================================================
// Field Configuration
// ============================================================================

// Fields to consider for merge operations
const MERGE_FIELDS: (keyof Book)[] = [
  'title',
  'subtitle',
  'authors',
  'isbn13',
  'coverUrl',
  'localCoverPath',
  'description',
  'publisher',
  'publishedYear',
  'publishedDate',
  'pageCount',
  'format',
  'subjects',
  'languageCode',
  'categories',
  'averageRating',
  'seriesName',
  'seriesVolume',
  'edition',
];

// Fields that should be treated as arrays
const ARRAY_FIELDS: Set<keyof Book> = new Set(['authors', 'subjects', 'categories']);

// Fields that are never merged (immutable)
const IMMUTABLE_FIELDS: Set<keyof Book> = new Set([
  'id',
  'addedAt',
  'externalIds',
  'needsSync',
  'localOnly',
  'lastSyncedAt',
]);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a value is considered "empty"
 */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

/**
 * Check if two values are considered different
 */
function isDifferent(existing: unknown, fetched: unknown): boolean {
  if (Array.isArray(existing) && Array.isArray(fetched)) {
    if (existing.length !== fetched.length) return true;
    return !existing.every((item, idx) => String(item) === String(fetched[idx]));
  }
  return String(existing) !== String(fetched);
}

/**
 * Format a field name for display
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ============================================================================
// compareBooks
// ============================================================================

/**
 * Compare all relevant fields between two Book objects
 * Identifies conflicts, empty fields, and matching fields
 */
export function compareBooks(existing: Book, fetched: Book): MergeFieldComparison[] {
  return MERGE_FIELDS.map((field) => {
    const existingValue = existing[field];
    const fetchedValue = fetched[field];
    const hasExisting = !isEmpty(existingValue);
    const hasFetched = !isEmpty(fetchedValue);
    const hasConflict = hasExisting && hasFetched && isDifferent(existingValue, fetchedValue);

    return {
      field: field as string,
      existing: existingValue,
      fetched: fetchedValue,
      hasConflict,
      hasExisting,
      hasFetched,
    };
  });
}

// ============================================================================
// getMergePreview
// ============================================================================

/**
 * Generate a preview of what will change before actual merge
 */
export function getMergePreview(existing: Book, fetched: Book): MergePreview {
  const comparisons = compareBooks(existing, fetched);

  const emptyFields = comparisons
    .filter((c) => !c.hasExisting && c.hasFetched)
    .map((c) => c.field);

  const conflicts = comparisons.filter((c) => c.hasConflict).map((c) => c.field);

  const totalFields = MERGE_FIELDS.length;
  const fieldsWithData = comparisons.filter((c) => c.hasExisting || c.hasFetched).length;

  return {
    fields: comparisons,
    emptyFields,
    conflicts,
    totalFields,
    fieldsWithData,
  };
}

// ============================================================================
// mergeBooks
// ============================================================================

/**
 * Combine two Book objects based on merge strategy
 */
export function mergeBooks(
  existing: Book,
  fetched: Book,
  strategy: MergeStrategy,
  fieldActions?: Record<string, MergeAction>
): Book {
  // Start with a copy of existing book
  const merged: Book = { ...existing };

  MERGE_FIELDS.forEach((field) => {
    // Skip immutable fields
    if (IMMUTABLE_FIELDS.has(field)) {
      return;
    }

    const existingValue = existing[field];
    const fetchedValue = fetched[field];
    const hasExisting = !isEmpty(existingValue);
    const hasFetched = !isEmpty(fetchedValue);

    let shouldUpdate = false;
    let newValue: unknown;

    switch (strategy) {
      case 'keep-existing':
        // Do nothing - keep existing value
        return;

      case 'keep-fetched':
        // Always use fetched value if it exists
        if (hasFetched) {
          newValue = fetchedValue;
          shouldUpdate = true;
        }
        break;

      case 'fill-empty':
        // Use fetched value only if existing is empty
        if (!hasExisting && hasFetched) {
          newValue = fetchedValue;
          shouldUpdate = true;
        }
        break;

      case 'selective': {
        // Use field-specific actions
        const action = fieldActions?.[field] ?? 'keep-existing';
        switch (action) {
          case 'keep-existing':
            return; // Keep existing
          case 'copy-fetched':
            if (hasFetched) {
              newValue = fetchedValue;
              shouldUpdate = true;
            }
            break;
          case 'apply-if-empty':
            if (!hasExisting && hasFetched) {
              newValue = fetchedValue;
              shouldUpdate = true;
            }
            break;
        }
        break;
      }
    }

    if (shouldUpdate) {
      // Handle array merging
      if (ARRAY_FIELDS.has(field) && Array.isArray(fetchedValue)) {
        // For arrays, we can merge with deduplication
        const existingArray = (Array.isArray(existingValue) ? existingValue : []) as unknown[];
        const fetchedArray = fetchedValue;
        const mergedArray = [...new Set([...existingArray, ...fetchedArray])];
        (merged as unknown as Record<string, unknown>)[field] = mergedArray;
      } else {
        (merged as unknown as Record<string, unknown>)[field] = fetchedValue;
      }
    }
  });

  // Merge external IDs (combine both)
  merged.externalIds = {
    ...existing.externalIds,
    ...fetched.externalIds,
  };

  // Update sync flags
  merged.needsSync = true;
  merged.lastSyncedAt = undefined;

  // Preserve immutable fields
  merged.id = existing.id;
  merged.addedAt = existing.addedAt;

  return merged;
}

// ============================================================================
// Merge Field Utilities
// ============================================================================

/**
 * Get a human-readable summary of merge preview
 */
export function getMergeSummary(existing: Book, fetched: Book): {
  willChange: number;
  conflicts: number;
  emptyFilled: number;
} {
  const preview = getMergePreview(existing, fetched);

  return {
    willChange: preview.conflicts.length + preview.emptyFields.length,
    conflicts: preview.conflicts.length,
    emptyFilled: preview.emptyFields.length,
  };
}

/**
 * Calculate the merge actions that would result from a given strategy
 */
export function getDefaultFieldActions(
  existing: Book,
  fetched: Book,
  strategy: MergeStrategy
): Record<string, MergeAction> {
  const actions: Record<string, MergeAction> = {};

  MERGE_FIELDS.forEach((field) => {
    if (IMMUTABLE_FIELDS.has(field)) {
      return;
    }

    const existingValue = existing[field];
    const fetchedValue = fetched[field];
    const hasExisting = !isEmpty(existingValue);
    const hasFetched = !isEmpty(fetchedValue);

    if (!hasExisting && hasFetched) {
      // Fetched has value, existing doesn't
      actions[field] = 'copy-fetched';
    } else if (hasExisting && hasFetched && isDifferent(existingValue, fetchedValue)) {
      // Both have values but they're different
      switch (strategy) {
        case 'keep-existing':
          actions[field] = 'keep-existing';
          break;
        case 'keep-fetched':
          actions[field] = 'copy-fetched';
          break;
        case 'fill-empty':
          actions[field] = 'keep-existing'; // Keep existing when both have values
          break;
        case 'selective':
          actions[field] = 'keep-existing'; // Default to keeping existing
          break;
      }
    } else {
      // Both empty or both same - default action
      actions[field] = 'keep-existing';
    }
  });

  return actions;
}

/**
 * Validate that a merge result is a valid Book
 */
export function validateMergeResult(merged: Book): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!merged.id) {
    errors.push('Missing required field: id');
  }
  if (!merged.title || merged.title.trim() === '') {
    errors.push('Missing or empty required field: title');
  }
  if (!merged.format) {
    errors.push('Missing required field: format');
  }
  if (!merged.authors || !Array.isArray(merged.authors) || merged.authors.length === 0) {
    errors.push('Missing or empty required field: authors');
  }
  if (!merged.addedAt) {
    errors.push('Missing required field: addedAt');
  }

  // Check type constraints
  if (merged.pageCount !== undefined && (typeof merged.pageCount !== 'number' || merged.pageCount < 0)) {
    errors.push('Invalid pageCount: must be a non-negative number');
  }
  if (merged.averageRating !== undefined && (typeof merged.averageRating !== 'number' || merged.averageRating < 0 || merged.averageRating > 5)) {
    errors.push('Invalid averageRating: must be between 0 and 5');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Export Types for External Use
// ============================================================================

export {
  MERGE_FIELDS,
  ARRAY_FIELDS,
  IMMUTABLE_FIELDS,
  isEmpty,
  isDifferent,
  formatFieldName,
};
