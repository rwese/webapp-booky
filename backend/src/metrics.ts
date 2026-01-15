// Prometheus metrics for Booky Backend
// File: backend/src/metrics.ts

import client from 'prom-client';

// Create a Registry to register metrics
export const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for the application

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

// HTTP requests total counter
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

// Active connections gauge
export const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});
register.registerMetric(activeConnections);

// Database operation duration
export const dbOperationDuration = new client.Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations',
  labelNames: ['operation', 'entity'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});
register.registerMetric(dbOperationDuration);

// Sync operations counter
export const syncOperationsTotal = new client.Counter({
  name: 'sync_operations_total',
  help: 'Total number of sync operations',
  labelNames: ['type', 'status']
});
register.registerMetric(syncOperationsTotal);

// File upload metrics
export const fileUploadSize = new client.Histogram({
  name: 'file_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  labelNames: ['type'],
  buckets: [1000, 10000, 100000, 500000, 1000000, 5000000, 10000000]
});
register.registerMetric(fileUploadSize);

export const fileUploadTotal = new client.Counter({
  name: 'file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['status', 'type']
});
register.registerMetric(fileUploadTotal);

// Authentication metrics
export const authOperationsTotal = new client.Counter({
  name: 'auth_operations_total',
  help: 'Total number of authentication operations',
  labelNames: ['type', 'status']
});
register.registerMetric(authOperationsTotal);

// Rate limit exceeded counter
export const rateLimitExceeded = new client.Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['route']
});
register.registerMetric(rateLimitExceeded);

// Active users gauge
export const activeUsers = new client.Gauge({
  name: 'active_users',
  help: 'Number of currently active users'
});
register.registerMetric(activeUsers);

// Storage usage metrics
export const storageUsage = new client.Gauge({
  name: 'storage_usage_bytes',
  help: 'Storage usage in bytes',
  labelNames: ['type']
});
register.registerMetric(storageUsage);

// Error counter
export const errorsTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route']
});
register.registerMetric(errorsTotal);

// Helper function to record request metrics
export function recordRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void {
  const labels = {
    method,
    route,
    status_code: statusCode.toString()
  };
  
  httpRequestDuration.observe(labels, duration);
  httpRequestsTotal.inc(labels);
}

// Helper function to record database operation
export function recordDbOperation(
  operation: string,
  entity: string,
  duration: number
): void {
  dbOperationDuration.observe({ operation, entity }, duration);
}

// Helper function to record sync operation
export function recordSyncOperation(type: string, status: 'success' | 'failure'): void {
  syncOperationsTotal.inc({ type, status });
}

// Helper function to record file upload
export function recordFileUpload(
  status: 'success' | 'failure',
  type: string,
  size: number
): void {
  fileUploadTotal.inc({ status, type });
  if (status === 'success') {
    fileUploadSize.observe({ type }, size);
  }
}

// Helper function to record auth operation
export function recordAuthOperation(
  type: string,
  status: 'success' | 'failure'
): void {
  authOperationsTotal.inc({ type, status });
}

// Helper function to record rate limit exceeded
export function recordRateLimitExceeded(route: string): void {
  rateLimitExceeded.inc({ route });
}

// Helper function to record error
export function recordError(type: string, route: string): void {
  errorsTotal.inc({ type, route });
}
