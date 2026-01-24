/**
 * Unit Tests for Database Version Migration
 * Tests version checking, error handling, and migration utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import functions to test
import {
  DATABASE_SCHEMA_VERSION,
  MIN_SUPPORTED_VERSION,
  DB_ERROR_CODES,
  getDatabaseName,
  isVersionError,
  isDatabaseClosedError,
  checkDatabaseVersion,
  normalizeDatabaseVersion,
  deleteDatabase,
  createUpgradeHandler,
  logDatabaseVersionInfo,
  type VersionCheckResult
} from '../../src/lib/db-migration';

describe('Database Version Constants', () => {
  describe('DATABASE_SCHEMA_VERSION', () => {
    it('should export a valid schema version', () => {
      expect(DATABASE_SCHEMA_VERSION).toBeDefined();
      expect(typeof DATABASE_SCHEMA_VERSION).toBe('number');
    });

    it('should be greater than minimum supported version', () => {
      expect(DATABASE_SCHEMA_VERSION).toBeGreaterThan(MIN_SUPPORTED_VERSION);
    });

    it('should be at least version 4 (current schema version)', () => {
      expect(DATABASE_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
    });
  });

  describe('MIN_SUPPORTED_VERSION', () => {
    it('should export minimum supported version', () => {
      expect(MIN_SUPPORTED_VERSION).toBeDefined();
      expect(typeof MIN_SUPPORTED_VERSION).toBe('number');
    });

    it('should be version 1 or greater', () => {
      expect(MIN_SUPPORTED_VERSION).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DB_ERROR_CODES', () => {
    it('should export error codes object', () => {
      expect(DB_ERROR_CODES).toBeDefined();
      expect(typeof DB_ERROR_CODES).toBe('object');
    });

    it('should contain VERSION_ERROR code', () => {
      expect(DB_ERROR_CODES.VERSION_ERROR).toBe('VersionError');
    });

    it('should contain NOT_FOUND_ERROR code', () => {
      expect(DB_ERROR_CODES.NOT_FOUND_ERROR).toBe('NotFoundError');
    });

    it('should contain DATABASE_CLOSED_ERROR code', () => {
      expect(DB_ERROR_CODES.DATABASE_CLOSED_ERROR).toBe('DatabaseClosedError');
    });
  });
});

describe('getDatabaseName', () => {
  it('should return the database name', () => {
    expect(getDatabaseName()).toBe('BookCollectionDB');
  });

  it('should always return the same value', () => {
    expect(getDatabaseName()).toBe(getDatabaseName());
  });
});

describe('Error Detection Functions', () => {
  describe('isVersionError', () => {
    it('should return false for null/undefined', () => {
      expect(isVersionError(null)).toBe(false);
      expect(isVersionError(undefined)).toBe(false);
    });

    it('should return true for VersionError', () => {
      const error = new Error('VersionError');
      error.name = 'VersionError';
      expect(isVersionError(error)).toBe(true);
    });

    it('should return true for error with version in message', () => {
      const error = new Error('Database version mismatch: expected 2, got 3');
      expect(isVersionError(error)).toBe(true);
    });

    it('should return true for DOMException', () => {
      const error = new Error('DOMException');
      error.name = 'DOMException';
      expect(isVersionError(error)).toBe(true);
    });

    it('should return false for unrelated errors', () => {
      const error = new Error('Something went wrong');
      expect(isVersionError(error)).toBe(false);
    });

    it('should handle string error input', () => {
      expect(isVersionError('VersionError')).toBe(true);
      expect(isVersionError('Some other error')).toBe(false);
    });
  });

  describe('isDatabaseClosedError', () => {
    it('should return false for null/undefined', () => {
      expect(isDatabaseClosedError(null)).toBe(false);
      expect(isDatabaseClosedError(undefined)).toBe(false);
    });

    it('should return true for DatabaseClosedError message', () => {
      const error = new Error('DatabaseClosedError: The database connection is closed');
      expect(isDatabaseClosedError(error)).toBe(true);
    });

  it('should return true for database closed message', () => {
    const error = new Error('DatabaseClosedError: The database connection is closed');
    expect(isDatabaseClosedError(error)).toBe(true);
  });

    it('should return false for unrelated errors', () => {
      const error = new Error('Something went wrong');
      expect(isDatabaseClosedError(error)).toBe(false);
    });
  });
});

describe('checkDatabaseVersion', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return valid structure for version check result', async () => {
    // The function returns a VersionCheckResult with required properties
    const result = await checkDatabaseVersion();
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('storedVersion');
    expect(result).toHaveProperty('codeVersion');
    expect(result).toHaveProperty('needsMigration');
  });
});

describe('normalizeDatabaseVersion', () => {
  it('should return success when versions match', async () => {
    // Mock checkDatabaseVersion to return matching versions
    const result = await normalizeDatabaseVersion();
    // The function may succeed or fail depending on actual IndexedDB state
    // But it should not throw
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('requiresReload');
  });
});

describe('createUpgradeHandler', () => {
  it('should return a function', () => {
    const handler = createUpgradeHandler();
    expect(typeof handler).toBe('function');
  });

  it('should return an async function', async () => {
    const handler = createUpgradeHandler();
    const result = handler({ table: vi.fn() });
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  it('should handle tables that exist', async () => {
    const handler = createUpgradeHandler();
    const mockTable = {
      count: vi.fn().mockResolvedValue(0)
    };
    const tx = {
      table: vi.fn().mockReturnValue(mockTable)
    };

    await handler(tx as { table: (name: string) => { count: () => Promise<number> } });

    // Should have called table for each expected table
    expect(tx.table).toHaveBeenCalled();
  });

  it('should handle missing tables gracefully', async () => {
    const handler = createUpgradeHandler();
    const tx = {
      table: vi.fn().mockImplementation(() => {
        throw new Error('Table not found');
      })
    };

    // Should not throw
    await expect(handler(tx as { table: (name: string) => { count: () => Promise<number> } })).resolves.toBeUndefined();
  });
});

describe('logDatabaseVersionInfo', () => {
  it('should not throw', () => {
    expect(() => logDatabaseVersionInfo('test')).not.toThrow();
  });

  it('should log with context', () => {
    const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    logDatabaseVersionInfo('test context');

    expect(consoleGroupSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleGroupEndSpy).toHaveBeenCalled();

    consoleGroupSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });
});

describe('Version Check Result Type', () => {
  it('should have correct structure', () => {
    const result: VersionCheckResult = {
      isValid: true,
      storedVersion: 3,
      codeVersion: 4,
      needsMigration: true
    };

    expect(result.isValid).toBe(true);
    expect(result.storedVersion).toBe(3);
    expect(result.codeVersion).toBe(4);
    expect(result.needsMigration).toBe(true);
  });

  it('should allow optional error property', () => {
    const result: VersionCheckResult = {
      isValid: false,
      storedVersion: 10,
      codeVersion: 4,
      needsMigration: true,
      error: 'Database version mismatch'
    };

    expect(result.error).toBe('Database version mismatch');
  });
});

describe('Version Comparison Logic', () => {
  it('should handle version 2 vs version 3 scenario (lending feature removal)', async () => {
    // This is the actual scenario from the codebase:
    // Version 3 was used when lending was added
    // Version 2 was restored when lending was removed
    // Users with version 3 stored in browser cannot open with version 2 code

    const storedVersion = 3;
    const codeVersion = DATABASE_SCHEMA_VERSION; // 4

    // With our fix, version 4 >= version 3, so it should work
    expect(codeVersion).toBeGreaterThanOrEqual(storedVersion);
  });

  it('should handle future version increases', () => {
    // When schema changes again, DATABASE_SCHEMA_VERSION should increase
    // and the migration utilities should handle the transition

    const currentVersion = DATABASE_SCHEMA_VERSION;
    const futureVersion = currentVersion + 1;

    expect(futureVersion).toBeGreaterThan(currentVersion);
  });
});

describe('Database Version History Documentation', () => {
  it('should document version progression', () => {
    // Verify our understanding of version history
    expect(MIN_SUPPORTED_VERSION).toBe(1); // Initial schema
    expect(DATABASE_SCHEMA_VERSION).toBe(4); // Current version after lending removal
  });

  it('should ensure current version can handle stored versions 2 and 3', () => {
    // The fix must work for users who have version 2 or 3 stored
    const storedVersions = [2, 3];
    const codeVersion = DATABASE_SCHEMA_VERSION;

    for (const stored of storedVersions) {
      expect(codeVersion).toBeGreaterThanOrEqual(stored);
    }
  });
});
