/**
 * Database Migration Utilities for Book Collection App
 *
 * This module provides centralized database versioning and migration management
 * to handle version mismatches that can occur when:
 * 1. Schema definitions change during development
 * 2. Users have stale database versions from previous development cycles
 * 3. Features are added/removed causing version changes
 *
 * @module db-migration
 */

/**
 * CURRENT DATABASE SCHEMA VERSION
 *
 * This is the authoritative source for the database schema version.
 * Increment this value whenever the database schema changes.
 *
 * Version History:
 * - Version 1: Initial schema (before reading goals)
 * - Version 2: Added readingGoals store (commit 484a723)
 * - Version 3: Added borrowers and lendingRecords stores (commit ce227d6) - later removed
 * - Version 4: Current version with normalized schema (removed lending feature)
 */
export const DATABASE_SCHEMA_VERSION = 4 as const;

/**
 * Minimum supported database version for migration
 * Databases older than this will require a full reset
 */
export const MIN_SUPPORTED_VERSION = 1 as const;

/**
 * Error codes for database operations
 */
export const DB_ERROR_CODES = {
  VERSION_ERROR: 'VersionError',
  NOT_FOUND_ERROR: 'NotFoundError',
  DATABASE_CLOSED_ERROR: 'DatabaseClosedError',
} as const;

/**
 * Result of a version check operation
 */
export interface VersionCheckResult {
  isValid: boolean;
  storedVersion: number | null;
  codeVersion: number;
  needsMigration: boolean;
  error?: string;
}

/**
 * Get the database name used throughout the application
 */
export function getDatabaseName(): string {
  return 'BookCollectionDB';
}

/**
 * Check if an error is a VersionError
 * VersionError is thrown when attempting to open a database with a lower
 * version number than what's currently stored in the browser
 */
export function isVersionError(error: unknown): boolean {
  if (!error) return false;

  const errorName = error instanceof Error ? error.name : String(error);
  return (
    errorName === DB_ERROR_CODES.VERSION_ERROR ||
    errorName === 'DOMException' ||
    (error instanceof Error && error.message.includes('version'))
  );
}

/**
 * Check if an error indicates the database was closed unexpectedly
 */
export function isDatabaseClosedError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes('DatabaseClosedError') ||
    errorMessage.includes('database closed')
  );
}

/**
 * Get the stored database version from IndexedDB
 * Returns null if the database doesn't exist yet
 */
export async function getStoredDatabaseVersion(): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(getDatabaseName());

      request.onsuccess = () => {
        const version = request.result.version;
        // Close the connection immediately since we just wanted to check version
        try {
          request.result.close();
        } catch {
          // Ignore close errors
        }
        resolve(version);
      };

      request.onerror = () => {
        // Database doesn't exist or can't be opened
        resolve(null);
      };

      request.onupgradeneeded = () => {
        // Database doesn't exist yet, abort
        // The version in this case is 1 by default for new databases
        resolve(1);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Check if the current database state is compatible with the code version
 */
export async function checkDatabaseVersion(): Promise<VersionCheckResult> {
  const storedVersion = await getStoredDatabaseVersion();
  const codeVersion = DATABASE_SCHEMA_VERSION;

  // Database doesn't exist yet - no migration needed
  if (storedVersion === null) {
    return {
      isValid: true,
      storedVersion: null,
      codeVersion,
      needsMigration: false,
    };
  }

  // Version is lower than minimum supported - will need reset
  if (storedVersion < MIN_SUPPORTED_VERSION) {
    return {
      isValid: false,
      storedVersion,
      codeVersion,
      needsMigration: true,
      error: `Database version ${storedVersion} is too old. Minimum supported is ${MIN_SUPPORTED_VERSION}.`,
    };
  }

  // Version mismatch - code version is lower than stored version
  // This is the main issue this module handles
  if (storedVersion > codeVersion) {
    return {
      isValid: false,
      storedVersion,
      codeVersion,
      needsMigration: true,
      error: `Database version mismatch: code expects ${codeVersion}, but stored version is ${storedVersion}.`,
    };
  }

  // All good - stored version is less than or equal to code version
  return {
    isValid: true,
    storedVersion,
    codeVersion,
    needsMigration: storedVersion < codeVersion,
  };
}

/**
 * Attempt to normalize the database version
 * When stored version > code version, we need to delete and recreate the database
 * This is the only way to handle version decreases in IndexedDB
 */
export async function normalizeDatabaseVersion(): Promise<{
  success: boolean;
  requiresReload: boolean;
  error?: string;
}> {
  const versionCheck = await checkDatabaseVersion();

  // No normalization needed if versions match
  if (versionCheck.storedVersion !== null && versionCheck.storedVersion <= versionCheck.codeVersion) {
    return { success: true, requiresReload: false };
  }

  try {
    // Delete the existing database
    await deleteDatabase();
    return { success: true, requiresReload: true };
  } catch (error) {
    return {
      success: false,
      requiresReload: false,
      error: error instanceof Error ? error.message : 'Failed to normalize database version',
    };
  }
}

/**
 * Delete the IndexedDB database
 * This will result in data loss - should only be used when version normalization is required
 */
export async function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.deleteDatabase(getDatabaseName());

      request.onsuccess = () => {
        // Also clear any related storage
        if (typeof localStorage !== 'undefined') {
          try {
            // Clear database-related localStorage items
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('booky_')) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach((key) => {
              if (key) localStorage.removeItem(key);
            });
          } catch {
            // Ignore localStorage errors
          }
        }
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete database'));
      };

      request.onblocked = () => {
        // Database deletion is blocked - might need to close all connections
        console.warn('Database deletion is blocked. Please close other tabs using this application.');
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a version upgrade handler that gracefully handles missing stores
 * This ensures all stores exist regardless of how the database was created
 */
export function createUpgradeHandler() {
  return async (tx: { table: (name: string) => { count: () => Promise<number> } }) => {
    const tables = [
      'books',
      'ratings',
      'tags',
      'bookTags',
      'collections',
      'collectionBooks',
      'syncQueue',
      'settings',
      'readingLogs',
      'coverImages',
      'readingGoals',
    ];

    for (const table of tables) {
      try {
        await tx.table(table).count();
      } catch {
        // Table doesn't exist - this can happen with imported databases
        console.warn(`Table '${table}' does not exist during upgrade. It will be created.`);
      }
    }
  };
}

/**
 * Log database version information for debugging
 */
export function logDatabaseVersionInfo(context: string): void {
  console.group(`Database Version Info [${context}]`);
  console.log(`Schema Version: ${DATABASE_SCHEMA_VERSION}`);
  console.log(`Min Supported: ${MIN_SUPPORTED_VERSION}`);
  console.groupEnd();
}
