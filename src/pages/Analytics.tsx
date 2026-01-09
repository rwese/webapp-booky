import { useState, useMemo } from 'react';
import { 
  BarChart2, 
  Calendar, 
  Book, 
  TrendingUp, 
  Download, 
  Star,
  Clock,
  Target,
  Award,
  Flame
} from 'lucide-react';
import { Card, Button } from '../components/common/Button';
import { 
  useReadingAnalytics, 
  useFormatDistribution, 
  useRatingDistribution,
  useReadingStreak 
} from '../hooks/useAnalytics';
import { useToastStore } from '../store/useStore';
import { format, startOfYear, endOfYear, eachMonthOfInterval, getYear, getMonth } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

export function AnalyticsPage() {
  const analytics = useReadingAnalytics();
  const formatDistribution = useFormatDistribution();
  const ratingDistribution = useRatingDistribution();
  const readingStreak = useReadingStreak();
  const { addToast } = useToastStore();
  
  // Time range filter for charts
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'all'>('year');
  
  // Export functionality
  const handleExportJSON = () => {
    const exportData = {
      summary: {
        totalBooksRead: analytics.totalBooksRead,
        booksReadThisYear: analytics.booksReadThisYear,
        booksReadThisMonth: analytics.booksReadThisMonth,
        currentlyReading: analytics.currentlyReading,
        averageRating: analytics.averageRating,
        pagesReadEstimate: analytics.pagesReadEstimate,
        dnfCount: analytics.totalDNF,
        reReadCount: analytics.reReadCount,
        readingStreak: readingStreak
      },
      formatDistribution,
      ratingDistribution,
      generatedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-summary-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast({ type: 'success', message: 'Analytics exported as JSON' });
  };
  
  // Chart data processing
  const booksByYearData = useMemo(() => {
    const yearData = analytics.readingHistory.yearData;
    const years = Object.keys(yearData).sort();
    return years.map(year => ({
      year,
      books: yearData[year],
      color: getYear(new Date()) === parseInt(year) ? '#3b82f6' : '#93c5fd'
    }));
  }, [analytics.readingHistory.yearData]);
  
  const booksByMonthData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: startOfYear(new Date()),
      end: endOfYear(new Date())
    });
    
    const monthData = analytics.readingHistory.monthData;
    
    return months.map((date, index) => {
      const monthKey = format(date, 'yyyy-MM');
      return {
        month: format(date, 'MMM'),
        fullMonth: format(date, 'MMMM yyyy'),
        books: monthData[monthKey] || 0,
        target: 5, // Example target
        color: getMonth(date) === getMonth(new Date()) ? '#3b82f6' : '#e5e7eb'
      };
    });
  }, [analytics.readingHistory.monthData]);
  
  const formatPieData = useMemo(() => {
    const colors: Record<string, string> = {
      physical: '#3b82f6',
      kindle: '#10b981', 
      kobo: '#8b5cf6',
      audible: '#f59e0b',
      audiobook: '#ec4899',
      pdf: '#6b7280',
      other: '#14b8a6'
    };
    
    return Object.entries(formatDistribution).map(([name, value], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[name] || '#6b7280'
    }));
  }, [formatDistribution]);
  
  const ratingBarData = useMemo(() => {
    return Object.entries(ratingDistribution).map(([rating, count]) => ({
      rating: `${rating} ★`,
      count,
      percentage: analytics.totalBooksRead > 0 ? (count / analytics.totalBooksRead) * 100 : 0
    })).reverse();
  }, [ratingDistribution, analytics.totalBooksRead]);
  
  const readingHeatmapData = useMemo(() => {
    // Generate heatmap data for the last 365 days
    const data = [];
    const today = new Date();
    
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      // This would be populated with actual reading data
      data.push({
        date: dateKey,
        value: Math.random() > 0.8 ? Math.floor(Math.random() * 5) : 0, // Placeholder
        dayOfWeek: format(date, 'EEE'),
        month: format(date, 'MMM')
      });
    }
    
    return data;
  }, []);
  
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="text-primary-600" />
              Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Insights into your reading habits and progress
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              aria-label="Time range"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'month' | 'year' | 'all')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
            
            <Button type="button" variant="secondary" onClick={handleExportJSON}>
              <Download size={20} />
              Export
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {/* Dashboard Widgets */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <DashboardWidget
            icon={<Book className="text-blue-500" />}
            label="Total Books Read"
            value={analytics.totalBooksRead}
            trend="+12%"
            trendUp={true}
            color="blue"
          />
          <DashboardWidget
            icon={<Calendar className="text-green-500" />}
            label="Read This Year"
            value={analytics.booksReadThisYear}
            trend={`${analytics.booksReadThisMonth} this month`}
            trendUp={true}
            color="green"
          />
          <DashboardWidget
            icon={<Clock className="text-yellow-500" />}
            label="Currently Reading"
            value={analytics.currentlyReading}
            subtitle="Active books"
            color="yellow"
          />
          <DashboardWidget
            icon={<Star className="text-purple-500" />}
            label="Average Rating"
            value={analytics.averageRating > 0 ? `${analytics.averageRating}/5` : 'N/A'}
            subtitle={`${Object.values(ratingDistribution).reduce((a, b) => a + b, 0)} ratings`}
            color="purple"
          />
        </div>
        
        {/* Secondary Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <SmallStatWidget
            icon={<TrendingUp className="text-green-500" />}
            label="Pages Read"
            value={analytics.pagesReadEstimate.toLocaleString()}
          />
          <SmallStatWidget
            icon={<Target className="text-blue-500" />}
            label="DNF Books"
            value={analytics.totalDNF}
          />
          <SmallStatWidget
            icon={<RotateCcwIcon className="text-indigo-500" />}
            label="Re-reads"
            value={analytics.reReadCount}
          />
          <SmallStatWidget
            icon={<Flame className="text-orange-500" />}
            label="Current Streak"
            value={`${readingStreak.currentStreak} days`}
          />
          <SmallStatWidget
            icon={<Award className="text-yellow-500" />}
            label="Best Streak"
            value={`${readingStreak.longestStreak} days`}
          />
        </div>
        
        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Books Read by Year */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Books Read by Year</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={booksByYearData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="books" radius={[4, 4, 0, 0]}>
                    {booksByYearData.map((entry) => (
                      <Cell key={`cell-${entry.year}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          {/* Books Read by Month (Line Chart) */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Reading Activity</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={booksByMonthData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: React.ReactNode, name: string) => [
                      value, 
                      name === 'books' ? 'Books Read' : 'Target'
                    ]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="books" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="target" 
                    stroke="#9ca3af" 
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          {/* Format Distribution (Pie Chart) */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Format Distribution</h3>
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={formatPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {formatPieData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 ml-4">
                {formatPieData.map((item, index) => (
                  <div key={`format-legend-${index}`} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {item.name} ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          
          {/* Rating Distribution (Histogram) */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Rating Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingBarData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: React.ReactNode, name: string) => [
                      value, 
                      name === 'count' ? 'Number of Books' : 'Percentage'
                    ]}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          {/* Reading Streak Calendar (Heat Map) */}
          <Card className="p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Reading Streak Calendar</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-10" />
                  <XAxis 
                    dataKey="dayOfWeek" 
                    data={readingHeatmapData} 
                    name="Day" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    dataKey="month" 
                    data={readingHeatmapData} 
                    name="Month" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <ZAxis 
                    dataKey="value" 
                    range={[0, 5]} 
                    name="Books Read" 
                  />
                  <Tooltip 
                    content={({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; value: number } }> }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                            <p className="font-medium">{data.date}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Books read: {data.value}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    data={readingHeatmapData} 
                    fill="#3b82f6"
                    shape={(props: { cx?: number; cy?: number; payload?: { value: number } }) => {
                      const { cx = 0, cy = 0, payload } = props;
                      const opacity = (payload?.value || 0) / 5;
                      return (
                        <rect
                          x={cx - 8}
                          y={cy - 8}
                          width={16}
                          height={16}
                          rx={2}
                          fill={`rgba(59, 130, 246, ${opacity})`}
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">Less</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map(intensity => (
                  <div
                    key={intensity}
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: `rgba(59, 130, 246, ${intensity / 5})` }}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">More</span>
            </div>
          </Card>
        </div>
        
        {/* Empty State */}
        {analytics.totalBooksRead === 0 && (
          <div className="text-center py-16">
            <BarChart2 className="mx-auto text-gray-300 dark:text-gray-600" size={48} />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              No reading data yet
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Start tracking your reading to see analytics and insights
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// Dashboard Widget Component
interface DashboardWidgetProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}

function DashboardWidget({ icon, label, value, trend, trendUp, subtitle, color }: DashboardWidgetProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
  };
  
  const trendClasses = trendUp 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-gray-500 dark:text-gray-400';
  
  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          {(trend || subtitle) && (
            <p className={`text-xs mt-1 ${trendClasses}`}>
              {trend || subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Small Stat Widget Component
interface SmallStatWidgetProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function SmallStatWidget({ icon, label, value }: SmallStatWidgetProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          {icon}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Custom RotateCcw Icon Component
function RotateCcwIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}