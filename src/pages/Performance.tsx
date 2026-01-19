import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Database, 
  RefreshCw, 
  TrendingUp,
  MemoryStick,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card, Badge, Button } from '../components/common/Button';
import { performanceMonitoring } from '../services/performanceMonitoring';

export function PerformancePage() {
  const [stats, setStats] = useState(performanceMonitoring.getStatistics());
  const [trends, setTrends] = useState<Record<string, { avgQueryTime: number; queryCount: number; slowQueries: number }>>({});
  const [slowQueries, setSlowQueries] = useState<Array<{ id: string; timestamp: number; queryName: string; duration: number; success: boolean }>>([]);
  const [alerts, setAlerts] = useState(performanceMonitoring.getUnacknowledgedAlerts());
  const [selectedTimeRange, setSelectedTimeRange] = useState(24);
  const [isLoading, setIsLoading] = useState(false);

  // Refresh data
  const refreshData = useCallback(() => {
    setIsLoading(true);
    try {
      setStats(performanceMonitoring.getStatistics());
      setTrends(performanceMonitoring.getTrends(selectedTimeRange));
      setSlowQueries(performanceMonitoring.getSlowQueries());
      setAlerts(performanceMonitoring.getUnacknowledgedAlerts());
    } finally {
      setIsLoading(false);
    }
  }, [selectedTimeRange]);

  // Refresh data periodically
  useEffect(() => {
    refreshData();
    
    const interval = setInterval(() => {
      refreshData();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [refreshData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return Object.entries(trends).map(([time, data]) => ({
      time: time.slice(11), // Just show hour
      avgQueryTime: Math.round(data.avgQueryTime * 100) / 100,
      queryCount: data.queryCount,
      slowQueries: data.slowQueries
    }));
  }, [trends]);

  // Calculate performance score
  const performanceScore = useMemo(() => {
    const { statistics } = stats;
    if (statistics.totalQueriesLastHour === 0) return 100;
    
    const slowQueryRatio = statistics.slowQueryCount / statistics.totalQueriesLastHour;
    const memoryUsageValue = typeof statistics.memoryUsage === 'string' 
      ? parseFloat(statistics.memoryUsage) 
      : 0;
    const memoryPenalty = memoryUsageValue > 50 ? 20 : 0;
    
    let score = 100;
    score -= slowQueryRatio * 50; // Up to 50 points for slow queries
    score -= memoryPenalty;
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    return score;
  }, [stats]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'slow_query': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'memory_warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'memory_critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    performanceMonitoring.acknowledgeAlert(alertId);
    refreshData();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Performance Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitor application performance and detect issues
            </p>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            >
              <option value={6}>Last 6 hours</option>
              <option value={12}>Last 12 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 48 hours</option>
            </select>
            <Button onClick={refreshData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Performance Score Card */}
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold ${getScoreColor(performanceScore)}`}>
                {performanceScore}
              </div>
              <div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  Performance Score
                </div>
                <div className="text-sm text-gray-500">
                  Based on query speed, memory usage, and error rates
                </div>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.statistics.totalQueriesLastHour}
                </div>
                <div className="text-gray-500">Queries/hr</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${stats.statistics.slowQueryCount > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {stats.statistics.slowQueryCount}
                </div>
                <div className="text-gray-500">Slow Queries</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${stats.unacknowledgedAlertCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {stats.unacknowledgedAlertCount}
                </div>
                <div className="text-gray-500">Alerts</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Query Time Chart */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Query Performance Over Time
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="avgQueryTime" 
                    stroke="#3b82f6" 
                    name="Avg Query Time (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Query Volume Chart */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Query Volume
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="queryCount" fill="#10b981" name="Queries" />
                  <Bar dataKey="slowQueries" fill="#ef4444" name="Slow Queries" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Average Query Time */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.statistics.averageQueryTime.toFixed(2)}ms
                </div>
                <div className="text-sm text-gray-500">Avg Query Time</div>
              </div>
            </div>
          </Card>

          {/* Average Render Time */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.statistics.averageRenderTime.toFixed(2)}ms
                </div>
                <div className="text-sm text-gray-500">Avg Render Time</div>
              </div>
            </div>
          </Card>

          {/* Memory Usage */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <MemoryStick className="w-8 h-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {String(stats.statistics.memoryUsage)} MB
                </div>
                <div className="text-sm text-gray-500">Memory Usage</div>
              </div>
            </div>
          </Card>

          {/* Thresholds */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-orange-500" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Thresholds
                </div>
                <div className="text-xs text-gray-500">
                  Slow Query: {stats.thresholds.slowQuery}ms
                </div>
                <div className="text-xs text-gray-500">
                  Memory: {stats.thresholds.memoryWarning}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Alerts and Slow Queries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slow Queries */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Slow Queries
            </h2>
            {slowQueries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                No slow queries detected
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {slowQueries.slice(0, 10).map((query) => (
                  <div 
                    key={query.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {query.queryName}
                      </span>
                    </div>
                    <Badge variant="warning">
                      {query.duration.toFixed(2)}ms
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Active Alerts */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Active Alerts
            </h2>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                No active alerts
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {alert.message}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Actions */}
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Actions
              </h3>
              <p className="text-sm text-gray-500">
                Manage performance monitoring data
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => {
                performanceMonitoring.clearAll();
                refreshData();
              }}>
                Clear Metrics
              </Button>
              <Button variant="secondary" onClick={() => {
                const data = performanceMonitoring.exportMetrics();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `performance-metrics-${new Date().toISOString()}.json`;
                a.click();
              }}>
                Export Metrics
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
