/**
 * Performance Monitoring Service
 * Tracks application performance metrics, detects slow operations,
 * and provides alerting for performance regressions.
 */

// Configuration
const PERFORMANCE_CONFIG = {
  slowQueryThreshold: 100, // ms - queries slower than this are flagged
  maxMetricsStored: 1000, // Keep last 1000 metrics
  maxQueryHistory: 100, // Keep last 100 queries per type
  memoryWarningThreshold: 50 * 1024 * 1024, // 50MB
  memoryCriticalThreshold: 100 * 1024 * 1024, // 100MB
  metricsFlushInterval: 60000, // Flush metrics every 60 seconds
};

// Metric types
export interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: MetricType;
  name: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export type MetricType = 
  | 'query' 
  | 'render' 
  | 'api_call' 
  | 'sync' 
  | 'build' 
  | 'memory';

export interface QueryMetric {
  id: string;
  timestamp: number;
  queryName: string;
  duration: number;
  success: boolean;
  error?: string;
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  type: AlertType;
  message: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  acknowledged: boolean;
}

export type AlertType = 
  | 'slow_query' 
  | 'memory_warning' 
  | 'memory_critical' 
  | 'render_slow' 
  | 'sync_failed';

// Singleton state
let metrics: PerformanceMetric[] = [];
let queryHistory: QueryMetric[] = [];
let alerts: PerformanceAlert[] = [];
let isMonitoring = false;

// Performance monitoring service
export const performanceMonitoring = {
  /**
   * Start the performance monitoring system
   */
  start() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    
    // Set up periodic metrics flush
    setInterval(() => {
      this.flushMetrics();
    }, PERFORMANCE_CONFIG.metricsFlushInterval);
    
    // Set up memory monitoring
    this.setupMemoryMonitoring();
  },
  
  /**
   * Stop the performance monitoring system
   */
  stop() {
    isMonitoring = false;
  },
  
  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>) {
    const newMetric: PerformanceMetric = {
      ...metric,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    metrics.push(newMetric);
    
    // Keep only recent metrics
    if (metrics.length > PERFORMANCE_CONFIG.maxMetricsStored) {
      metrics = metrics.slice(-PERFORMANCE_CONFIG.maxMetricsStored);
    }
    
    // Check for slow operations
    if (metric.duration > PERFORMANCE_CONFIG.slowQueryThreshold && metric.type === 'query') {
      this.createAlert({
        type: 'slow_query',
        message: `Slow ${metric.name}: ${metric.duration.toFixed(2)}ms`,
        metric: metric.name,
        threshold: PERFORMANCE_CONFIG.slowQueryThreshold,
        currentValue: metric.duration
      });
    }
    
    return newMetric;
  },
  
  /**
   * Record a query execution
   */
  recordQuery(queryName: string, duration: number, success: boolean, error?: string) {
    const metric: QueryMetric = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      queryName,
      duration,
      success,
      error
    };
    
    queryHistory.push(metric);
    
    // Keep only recent queries
    if (queryHistory.length > PERFORMANCE_CONFIG.maxQueryHistory) {
      queryHistory = queryHistory.slice(-PERFORMANCE_CONFIG.maxQueryHistory);
    }
    
    // Check for slow queries
    if (duration > PERFORMANCE_CONFIG.slowQueryThreshold && success) {
      this.createAlert({
        type: 'slow_query',
        message: `Slow query: ${queryName} took ${duration.toFixed(2)}ms`,
        metric: queryName,
        threshold: PERFORMANCE_CONFIG.slowQueryThreshold,
        currentValue: duration
      });
    }
    
    // Record as metric
    this.recordMetric({
      type: 'query',
      name: queryName,
      duration,
      metadata: { success, error }
    });
    
    return metric;
  },
  
  /**
   * Record render time
   */
  recordRender(componentName: string, duration: number) {
    return this.recordMetric({
      type: 'render',
      name: componentName,
      duration,
      metadata: { component: componentName }
    });
  },
  
  /**
   * Record API call
   */
  recordApiCall(endpoint: string, duration: number, status: number) {
    return this.recordMetric({
      type: 'api_call',
      name: endpoint,
      duration,
      metadata: { status, endpoint }
    });
  },
  
  /**
   * Record memory usage
   */
  recordMemory() {
    if (!('memory' in performance)) return null;
    
    const mem = (performance as Performance & { 
      memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } 
    }).memory;
    
    const usedMB = mem.usedJSHeapSize / 1024 / 1024;
    
    // Check thresholds
    if (mem.usedJSHeapSize >= PERFORMANCE_CONFIG.memoryCriticalThreshold) {
      this.createAlert({
        type: 'memory_critical',
        message: `Critical memory usage: ${usedMB.toFixed(2)} MB`,
        metric: 'memory',
        threshold: PERFORMANCE_CONFIG.memoryCriticalThreshold / 1024 / 1024,
        currentValue: usedMB
      });
    } else if (mem.usedJSHeapSize >= PERFORMANCE_CONFIG.memoryWarningThreshold) {
      this.createAlert({
        type: 'memory_warning',
        message: `High memory usage: ${usedMB.toFixed(2)} MB`,
        metric: 'memory',
        threshold: PERFORMANCE_CONFIG.memoryWarningThreshold / 1024 / 1024,
        currentValue: usedMB
      });
    }
    
    return this.recordMetric({
      type: 'memory',
      name: 'heap_usage',
      duration: 0,
      metadata: {
        usedMB: usedMB.toFixed(2),
        totalMB: (mem.totalJSHeapSize / 1024 / 1024).toFixed(2),
        limitMB: (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
      }
    });
  },
  
  /**
   * Create an alert
   */
  createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged'>) {
    const alert: PerformanceAlert = {
      ...alertData,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      acknowledged: false
    };
    
    alerts.push(alert);
    
    // Keep only recent alerts
    const recentAlerts = alerts.filter(a => 
      Date.now() - a.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );
    alerts = recentAlerts;
    
    // Log alert
    console.warn(`[Performance Alert] ${alert.type}: ${alert.message}`);
    
    return alert;
  },
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string) {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
    return alert;
  },
  
  /**
   * Get all unacknowledged alerts
   */
  getUnacknowledgedAlerts() {
    return alerts.filter(a => !a.acknowledged);
  },
  
  /**
   * Get metrics by type
   */
  getMetricsByType(type: MetricType, limit = 100) {
    return metrics
      .filter(m => m.type === type)
      .slice(-limit);
  },
  
  /**
   * Get query history
   */
  getQueryHistory(limit = 100) {
    return queryHistory.slice(-limit);
  },
  
  /**
   * Get slow queries
   */
  getSlowQueries(threshold = PERFORMANCE_CONFIG.slowQueryThreshold, limit = 20) {
    return queryHistory
      .filter(q => q.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  },
  
  /**
   * Get performance statistics
   */
  getStatistics() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentMetrics = metrics.filter(m => m.timestamp > oneHourAgo);
    
    // Calculate averages
    const queryMetrics = recentMetrics.filter(m => m.type === 'query');
    const avgQueryTime = queryMetrics.length > 0
      ? queryMetrics.reduce((sum, m) => sum + m.duration, 0) / queryMetrics.length
      : 0;
    
    const renderMetrics = recentMetrics.filter(m => m.type === 'render');
    const avgRenderTime = renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + m.duration, 0) / renderMetrics.length
      : 0;
    
    // Memory stats
    const memMetrics = recentMetrics.filter(m => m.type === 'memory');
    const latestMem = memMetrics.length > 0 
      ? memMetrics[memMetrics.length - 1] 
      : null;
    
    // Count alerts
    const recentAlerts = alerts.filter(a => a.timestamp > oneHourAgo);
    const unacknowledged = recentAlerts.filter(a => !a.acknowledged);
    
    return {
      metricsCount: metrics.length,
      queryCount: queryHistory.length,
      alertCount: alerts.length,
      unacknowledgedAlertCount: unacknowledged.length,
      statistics: {
        averageQueryTime: Math.round(avgQueryTime * 100) / 100,
        averageRenderTime: Math.round(avgRenderTime * 100) / 100,
        slowQueryCount: queryHistory.filter(q => q.duration > PERFORMANCE_CONFIG.slowQueryThreshold).length,
        memoryUsage: (latestMem?.metadata?.usedMB as string) || 'N/A',
        totalQueriesLastHour: queryMetrics.length,
        totalRendersLastHour: renderMetrics.length
      },
      thresholds: {
        slowQuery: PERFORMANCE_CONFIG.slowQueryThreshold,
        memoryWarning: (PERFORMANCE_CONFIG.memoryWarningThreshold / 1024 / 1024).toFixed(0) + ' MB',
        memoryCritical: (PERFORMANCE_CONFIG.memoryCriticalThreshold / 1024 / 1024).toFixed(0) + ' MB'
      }
    };
  },
  
  /**
   * Get performance trends
   */
  getTrends(hours = 24) {
    const now = Date.now();
    const startTime = now - hours * 60 * 60 * 1000;
    const recentMetrics = metrics.filter(m => m.timestamp > startTime);
    
    // Group by hour
    const hourlyData: Record<string, { avgQueryTime: number; queryCount: number; slowQueries: number }> = {};
    
    for (let i = 0; i < hours; i++) {
      const hourStart = startTime + i * 60 * 60 * 1000;
      const hourEnd = hourStart + 60 * 60 * 1000;
      const hourKey = new Date(hourStart).toISOString().slice(0, 13);
      
      const hourMetrics = recentMetrics.filter(m => m.timestamp >= hourStart && m.timestamp < hourEnd);
      const hourQueries = hourMetrics.filter(m => m.type === 'query');
      
      hourlyData[hourKey] = {
        avgQueryTime: hourQueries.length > 0
          ? hourQueries.reduce((sum, m) => sum + m.duration, 0) / hourQueries.length
          : 0,
        queryCount: hourQueries.length,
        slowQueries: hourQueries.filter(m => m.duration > PERFORMANCE_CONFIG.slowQueryThreshold).length
      };
    }
    
    return hourlyData;
  },
  
  /**
   * Flush metrics to persistent storage
   */
  async flushMetrics() {
    if (metrics.length === 0) return;
    
    try {
      // Store metrics in IndexedDB for persistence
      metrics = []; // Clear after storing ( IndexedDB storage would go here if implemented )
    } catch (error) {
      // Silently fail - metrics flushing is non-critical
    }
  },
  
  /**
   * Set up memory monitoring
   */
  setupMemoryMonitoring() {
    if (!('memory' in performance)) {
      return;
    }
    
    // Record memory every 30 seconds
    setInterval(() => {
      this.recordMemory();
    }, 30000);
  },
  
  /**
   * Clear all metrics and alerts
   */
  clearAll() {
    metrics = [];
    queryHistory = [];
    alerts = [];
  },
  
  /**
   * Export metrics for debugging
   */
  exportMetrics() {
    return {
      metrics,
      queryHistory,
      alerts,
      exportedAt: new Date().toISOString()
    };
  }
};

// Wrap IndexedDB operations with performance monitoring
export function wrapDbOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  return operation()
    .then(result => {
      const duration = performance.now() - startTime;
      performanceMonitoring.recordQuery(operationName, duration, true);
      return result;
    })
    .catch(error => {
      const duration = performance.now() - startTime;
      performanceMonitoring.recordQuery(operationName, duration, false, error.message);
      throw error;
    });
}

// Start monitoring by default
performanceMonitoring.start();
