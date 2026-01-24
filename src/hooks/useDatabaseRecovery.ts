/**
 * Database Recovery Hook
 * 
 * This hook provides database version error recovery functionality.
 * It monitors the database state and can automatically recover from version errors.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  checkDatabaseVersion, 
  normalizeDatabaseVersion, 
  deleteDatabase,
  type VersionCheckResult
} from '../lib/db-migration';

// User-friendly error messages for different version scenarios
const ERROR_MESSAGES: Record<string, string> = {
  VERSION_TOO_OLD: 'Your database is from an older version of the app. Some features may not work correctly.',
  VERSION_TOO_NEW: 'Your database was created with a newer version of the app. Please update the app to continue.',
  VERSION_CORRUPTED: 'Your database appears to be corrupted. We will try to recover it.',
  GENERIC_ERROR: 'There was a problem with the database. Please refresh the page.',
};

export interface DatabaseRecoveryState {
  isRecovering: boolean;
  error: string | null;
  needsReload: boolean;
  diagnostics: {
    version: {
      stored: number | null;
      code: number;
      isValid: boolean;
      needsMigration: boolean;
    };
    database: {
      name: string;
      exists: boolean;
    };
    stores: string[];
    error?: string;
  } | null;
}

export interface DatabaseRecoveryActions {
  checkVersion: () => Promise<VersionCheckResult>;
  attemptRecovery: () => Promise<{ success: boolean; requiresReload: boolean; error?: string }>;
  clearDatabase: () => Promise<{ success: boolean; error?: string }>;
  reloadPage: () => void;
}

export function useDatabaseRecovery(): [DatabaseRecoveryState, DatabaseRecoveryActions] {
  const [state, setState] = useState<DatabaseRecoveryState>({
    isRecovering: false,
    error: null,
    needsReload: false,
    diagnostics: null,
  });

  // Check database version
  const checkVersion = useCallback(async (): Promise<VersionCheckResult> => {
    const result = await checkDatabaseVersion();
    return result;
  }, []);

  // Attempt automatic recovery
  const attemptRecovery = useCallback(async (): Promise<{ success: boolean; requiresReload: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isRecovering: true, error: null }));

    try {
      const result = await normalizeDatabaseVersion();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          isRecovering: false,
          needsReload: result.requiresReload,
          error: result.requiresReload ? 'Database recovered. Please reload the page.' : null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isRecovering: false,
          error: result.error || ERROR_MESSAGES.GENERIC_ERROR,
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC_ERROR;
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: errorMessage,
      }));
      
      return { success: false, requiresReload: false, error: errorMessage };
    }
  }, []);

  // Clear database completely (last resort)
  const clearDatabase = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isRecovering: true, error: null }));

    try {
      await deleteDatabase();
      setState(prev => ({
        ...prev,
        isRecovering: false,
        needsReload: true,
        error: 'Database cleared. Please reload the page.',
      }));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC_ERROR;
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  // Reload the page
  const reloadPage = useCallback(() => {
    window.location.reload();
  }, []);

  return [state, { checkVersion, attemptRecovery, clearDatabase, reloadPage }];
}

/**
 * Hook for displaying database status and providing user feedback
 */
export function useDatabaseStatus() {
  const [status, setStatus] = useState<{
    isHealthy: boolean;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>({
    isHealthy: true,
    message: 'Database is healthy',
    severity: 'info',
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await checkDatabaseVersion();
        
        if (result.isValid) {
          setStatus({
            isHealthy: true,
            message: 'Database is healthy',
            severity: 'info',
          });
        } else if (result.storedVersion !== null && result.storedVersion < 1) {
          setStatus({
            isHealthy: false,
            message: ERROR_MESSAGES.VERSION_TOO_OLD,
            severity: 'error',
          });
        } else if (result.storedVersion !== null && result.storedVersion > result.codeVersion) {
          setStatus({
            isHealthy: false,
            message: ERROR_MESSAGES.VERSION_TOO_NEW,
            severity: 'warning',
          });
        } else {
          setStatus({
            isHealthy: false,
            message: ERROR_MESSAGES.VERSION_CORRUPTED,
            severity: 'error',
          });
        }
      } catch (error) {
        setStatus({
          isHealthy: false,
          message: ERROR_MESSAGES.GENERIC_ERROR,
          severity: 'error',
        });
      }
    };

    checkStatus();

    // Check status periodically
    const interval = setInterval(checkStatus, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  return status;
}
