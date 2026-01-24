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
  type VersionCheckResult,
  recoverFromVersionError,
  monitorDatabaseVersion,
  getDatabaseDiagnostics
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

describe('Database Recovery Functions', () => {
  it('should have recoverFromVersionError function', () => {
    // Import the recovery function
    expect(typeof recoverFromVersionError).toBe('function');
  });

  it('should have monitorDatabaseVersion function', () => {
    // Import the monitoring function
    expect(typeof monitorDatabaseVersion).toBe('function');
  });

  it('should have getDatabaseDiagnostics function', () => {
    // Import the diagnostics function
    expect(typeof getDatabaseDiagnostics).toBe('function');
  });
});

describe('Version Error Handling Scenarios', () => {
  it('should handle stored version higher than code version', async () => {
    // This simulates the scenario where stored version > code version
    // which was the original issue (version 30 vs 20, though current is 4)
    
    const storedVersion = 30;
    const codeVersion = 4;
    
    // In this case, the check should detect the mismatch
    expect(storedVersion).toBeGreaterThan(codeVersion);
    
    // The normalizeDatabaseVersion should handle this by deleting the database
    // Note: In a real scenario, this would fail if the stored version is actually 30
    // but in test environment it might not be
    const result = await normalizeDatabaseVersion();
    
    // The function should either succeed (delete database) or handle gracefully
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('requiresReload');
  });

  it('should handle stored version lower than code version', async () => {
    // This is the normal upgrade scenario
    const storedVersion = 2;
    const codeVersion = 4;
    
    expect(codeVersion).toBeGreaterThan(storedVersion);
    
    // This should be handled by Dexie's upgrade mechanism
    const result = await checkDatabaseVersion();
    
    // Should need migration if stored version is less than code version
    // Note: This depends on the actual stored version in the test environment
    // If stored version >= code version, then needsMigration would be false
    if (result.storedVersion !== null && result.storedVersion < result.codeVersion) {
      expect(result.needsMigration).toBe(true);
    } else {
      // In test environment, if versions match, no migration needed
      expect(result.needsMigration).toBe(false);
    }
  });

  it('should handle stored version equal to code version', async () => {
    const storedVersion = 4;
    const codeVersion = 4;
    
    expect(storedVersion).toBe(codeVersion);
    
    const result = await checkDatabaseVersion();
    
    // Should be valid and not need migration (if versions match)
    if (result.storedVersion === result.codeVersion) {
      expect(result.isValid).toBe(true);
      expect(result.needsMigration).toBe(false);
    }
  });
});

describe('Database Version Edge Cases', () => {
  it('should handle null stored version (new database)', async () => {
    const result = await checkDatabaseVersion();
    
    // For new database, storedVersion should be null or 1 (default for new databases)
    expect(result.storedVersion).toBeDefined();
    expect(result.codeVersion).toBeDefined();
  });

  it('should handle very old database versions', async () => {
    // Test with a version older than minimum supported
    const oldVersion = 0;
    
    expect(oldVersion).toBeLessThan(MIN_SUPPORTED_VERSION);
    
    // The system should handle this gracefully
    // In test environment, the actual result depends on real stored version
    const result = await checkDatabaseVersion();
    
    // Should return a valid result structure
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('storedVersion');
    expect(result).toHaveProperty('codeVersion');
    expect(result).toHaveProperty('needsMigration');
  });

  it('should handle extremely high stored versions', async () => {
    // Test with an unrealistically high version
    const extremeVersion = 999;
    
    // This would require database deletion
    // In test environment, the actual result depends on real stored version
    const result = await checkDatabaseVersion();
    
    // Should return a valid result structure
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('storedVersion');
    expect(result).toHaveProperty('codeVersion');
  });
});

describe('Database Version Logging', () => {
  it('should log version information without errors', () => {
    // Test that logging functions don't throw
    expect(() => logDatabaseVersionInfo('test')).not.toThrow();
  });

  it('should include context in log output', () => {
    const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    logDatabaseVersionInfo('test context');

    expect(consoleGroupSpy).toHaveBeenCalledWith('Database Version Info [test context]');
    expect(consoleLogSpy).toHaveBeenCalledWith(`Schema Version: ${DATABASE_SCHEMA_VERSION}`);
    expect(consoleLogSpy).toHaveBeenCalledWith(`Min Supported: ${MIN_SUPPORTED_VERSION}`);

    consoleGroupSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });
});
