/**
 * Error tracking service module
 * Provides a unified interface for error reporting with Sentry support
 */

import type { ErrorInfo } from 'react';

// Type definitions for Sentry (lazy loaded to avoid issues when not configured)
type SentrySeverityLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';
type SentryBreadcrumb = {
  type?: string;
  category?: string;
  message?: string;
  level?: SentrySeverityLevel;
  data?: Record<string, unknown>;
  timestamp?: number;
};

interface SentryModule {
  init: (options: {
    dsn: string;
    environment: string;
    release?: string;
    sampleRate?: number;
    beforeSend?: (event: unknown, hint: { originalException: unknown }) => unknown;
    enabled?: boolean;
    integrations?: unknown[];
    tracesSampleRate?: number;
  }) => void;
  captureException: (error: unknown, options?: { extra?: Record<string, unknown> }) => string;
  captureMessage: (message: string, level?: SentrySeverityLevel) => string;
  setUser: (user: { id: string; email?: string; username?: string } | null) => void;
  addBreadcrumb: (breadcrumb: SentryBreadcrumb) => void;
  flush: (timeout: number) => Promise<boolean>;
  withErrorBoundary: (
    component: React.ReactElement,
    options?: { beforeError?: (error: Error) => Error }
  ) => React.ReactElement;
  browserTracingIntegration?: () => unknown;
  replayIntegration?: (options?: { maskAllText?: boolean; blockAllMedia?: boolean }) => unknown;
}

interface ErrorTrackingConfig {
  dsn: string | null;
  environment: string;
  release?: string;
  sampleRate?: number;
  beforeSend?: (event: unknown, hint: { originalException: unknown }) => unknown;
}

/**
 * Error data structure for reporting
 */
export interface ErrorReportData {
  message: string;
  stack?: string;
  componentStack?: string | null;
  timestamp: string;
  url: string;
  userAgent: string;
  errorType: string;
  level?: SentrySeverityLevel;
  extra?: Record<string, unknown>;
}

// Lazy-loaded Sentry module
let sentryModule: SentryModule | null = null;
let isInitialized = false;

/**
 * Get or load the Sentry module
 */
function getSentry(): SentryModule | null {
  if (sentryModule) return sentryModule;

  try {
    // Using require to avoid bundling Sentry in development
    // eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
    const sentry = require('@sentry/react') as SentryModule;
    sentryModule = sentry;
    return sentryModule;
  } catch {
    return null;
  }
}

/**
 * Check if Sentry is available and initialized
 */
function hasSentry(): boolean {
  return isInitialized && getSentry() !== null;
}

/**
 * Initialize the error tracking service
 * @param config - Configuration options for error tracking
 */
export function initErrorTracking(config: Partial<ErrorTrackingConfig>): void {
  const dsn = config.dsn || import.meta.env?.VITE_SENTRY_DSN || null;
  const environment = config.environment || import.meta.env?.MODE || 'development';

  // Only initialize if DSN is provided and we're in production
  if (!dsn || environment === 'development') {
    isInitialized = false;
    return;
  }

  const sentry = getSentry();
  if (!sentry) {
    console.warn('[ErrorTracking] Sentry module not available');
    return;
  }

  // Check if browserTracingIntegration and replayIntegration are available
  const integrations: unknown[] = [];
  if (typeof sentry.browserTracingIntegration === 'function') {
    integrations.push(sentry.browserTracingIntegration());
  }
  if (typeof sentry.replayIntegration === 'function') {
    integrations.push(sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }));
  }

  sentry.init({
    dsn,
    environment,
    release: config.release,
    sampleRate: config.sampleRate ?? 1.0,
    beforeSend: config.beforeSend ?? defaultBeforeSend,
    enabled: environment === 'production',
    integrations,
    tracesSampleRate: 1.0,
  });

  isInitialized = true;
}

/**
 * Default beforeSend handler that can filter out certain errors
 */
function defaultBeforeSend(event: unknown, hint: { originalException: unknown }): unknown {
  const error = hint.originalException;

  if (error instanceof Error) {
    // Filter out network errors that are handled gracefully
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return null;
    }

    // Filter out AbortErrors (cancelled requests)
    if (error.name === 'AbortError') {
      return null;
    }
  }

  return event;
}

/**
 * Report an error to the tracking service
 * @param error - The error to report
 * @param errorInfo - Optional component stack information
 * @param extra - Additional context data
 */
export function reportError(
  error: Error,
  errorInfo?: ErrorInfo,
  extra?: Record<string, unknown>
): void {
  const data: ErrorReportData = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    errorType: error.name,
    level: 'error',
    extra,
  };

  const sentry = getSentry();
  if (hasSentry() && sentry) {
    sentry.captureException(error, {
      extra: {
        componentStack: errorInfo?.componentStack,
        ...extra,
      },
    });
  } else {
    // Fallback: log to console or send to custom endpoint
    console.error('[ErrorTracking] Error:', data);
    sendToCustomEndpoint(data).catch(console.error);
  }
}

/**
 * Report a message (non-error) to the tracking service
 * @param message - The message to report
 * @param level - Severity level
 * @param extra - Additional context data
 */
export function reportMessage(
  message: string,
  level: SentrySeverityLevel = 'info',
  _extra?: Record<string, unknown>
): void {
  const sentry = getSentry();
  if (hasSentry() && sentry) {
    sentry.captureMessage(message, level);
  }

  if (import.meta.env?.DEV) {
  }
}

/**
 * Set user context for error reports
 * @param user - User information
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
} | null): void {
  const sentry = getSentry();
  if (hasSentry() && sentry) {
    sentry.setUser(user);
  }
}

/**
 * Add breadcrumb for error context
 * @param breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
  const sentry = getSentry();
  if (hasSentry() && sentry) {
    sentry.addBreadcrumb(breadcrumb);
  }
}

/**
 * Fallback: Send error data to custom endpoint
 */
async function sendToCustomEndpoint(data: ErrorReportData): Promise<void> {
  const endpoint = import.meta.env?.VITE_ERROR_ENDPOINT;

  if (!endpoint) {
    return;
  }

  try {
    await fetch(endpoint as string, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[ErrorTracking] Failed to send to custom endpoint:', error);
  }
}

/**
 * Cleanup and flush pending errors
 */
export async function flushErrors(timeout: number = 2000): Promise<boolean> {
  const sentry = getSentry();
  if (hasSentry() && sentry) {
    return sentry.flush(timeout);
  }
  return Promise.resolve(true);
}
