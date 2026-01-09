import { useState } from 'react';
import { 
  History, 
  Filter, 
  Download, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  Book,
  Star,
  Trash2,
  RotateCcw,
  Clock,
  X
} from 'lucide-react';
import { Card, Button, Badge } from '../components/common/Button';
import { useReadingHistory } from '../hooks/useAnalytics';
import { useToastStore, useSettingsStore } from '../store/useStore';
import { readingLogOperations } from '../lib/db';
import type { FilterConfig, SortConfig, BookFormat, ReadingStatus } from '../types';
import { format } from 'date-fns';

export function HistoryPage() {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    field: 'finishedAt', 
    direction: 'desc' 
  });
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const readingHistory = useReadingHistory(filterConfig, sortConfig);
  const { addToast } = useToastStore();
  const { settings } = useSettingsStore();
  
  // Pagination
  const totalPages = Math.ceil((readingHistory?.length || 0) / itemsPerPage);
  const paginatedHistory = readingHistory?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Sort handlers
  const handleSort = (field: string) => {
    if (sortConfig.field === field) {
      setSortConfig({ 
        field, 
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' 
      });
    } else {
      setSortConfig({ field, direction: 'desc' });
    }
  };
  
  // Filter handlers
  const handleStatusFilter = (status: ReadingStatus | null) => {
    if (status === null) {
      const { statuses, ...rest } = filterConfig;
      setFilterConfig(rest);
    } else {
      setFilterConfig({ ...filterConfig, statuses: [status] });
    }
    setCurrentPage(1);
  };
  
  const handleFormatFilter = (format: BookFormat | null) => {
    if (format === null) {
      const { formats, ...rest } = filterConfig;
      setFilterConfig(rest);
    } else {
      setFilterConfig({ ...filterConfig, formats: [format] });
    }
    setCurrentPage(1);
  };
  
  const handleYearFilter = (year: number | null) => {
    if (year === null) {
      const { dateRange, ...rest } = filterConfig;
      setFilterConfig(rest);
    } else {
      setFilterConfig({
        ...filterConfig,
        dateRange: {
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31)
        }
      });
    }
    setCurrentPage(1);
  };
  
  const handleRatingFilter = (minRating: number | null) => {
    if (minRating === null) {
      const { minRating: _, maxRating: __, ...rest } = filterConfig;
      setFilterConfig(rest);
    } else {
      setFilterConfig({ ...filterConfig, minRating });
    }
    setCurrentPage(1);
  };
  
  const clearFilters = () => {
    setFilterConfig({});
    setCurrentPage(1);
  };
  
  // Export handlers
  const handleExportJSON = () => {
    const exportData = readingHistory.map(log => ({
      bookTitle: log.book?.title || 'Unknown',
      authors: log.book?.authors?.join(', ') || 'Unknown',
      finishedAt: log.finishedAt,
      status: log.status,
      rating: log.rating?.stars || null,
      review: log.rating?.review || null,
      format: log.book?.format || 'unknown',
      pages: log.book?.pageCount || null,
      dnfReason: log.dnfReason || null
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-history-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast({ type: 'success', message: 'Reading history exported as JSON' });
  };
  
  const handleExportCSV = () => {
    const headers = ['Title', 'Authors', 'Finished Date', 'Status', 'Rating', 'Format', 'Pages', 'DNF Reason'];
    const rows = readingHistory.map(log => [
      log.book?.title || 'Unknown',
      log.book?.authors?.join(', ') || 'Unknown',
      log.finishedAt ? format(new Date(log.finishedAt as unknown as string), 'yyyy-MM-dd') : '',
      log.status,
      log.rating?.stars?.toString() || '',
      log.book?.format || 'unknown',
      log.book?.pageCount?.toString() || '',
      log.dnfReason || ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast({ type: 'success', message: 'Reading history exported as CSV' });
  };
  
  const getStatusBadge = (status: ReadingStatus) => {
    const statusConfig = {
      read: { color: 'green', label: 'Read' },
      dnf: { color: 'red', label: 'DNF' },
      currently_reading: { color: 'yellow', label: 'Reading' },
      want_to_read: { color: 'blue', label: 'Want to Read' }
    };
    
    const config = statusConfig[status] || { color: 'gray', label: status };
    return <Badge variant={config.color as any}>{config.label}</Badge>;
  };
  
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="text-primary-600" />
              Reading History
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your reading journey and progress
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              type="button"
              variant="secondary" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} />
              Filters
              {Object.keys(filterConfig).length > 0 && (
                <Badge variant="primary" className="ml-1">
                  {Object.keys(filterConfig).length}
                </Badge>
              )}
            </Button>
            
            <div className="relative group">
              <Button type="button" variant="secondary">
                <Download size={20} />
                Export
              </Button>
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Export as JSON
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Export as CSV
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  aria-label="Status filter"
                  value={filterConfig.statuses?.[0] || ''}
                  onChange={(e) => handleStatusFilter(e.target.value as ReadingStatus || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="read">Read</option>
                  <option value="dnf">DNF</option>
                  <option value="currently_reading">Currently Reading</option>
                  <option value="want_to_read">Want to Read</option>
                </select>
              </div>
              
              {/* Format Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format
                </label>
                <select
                  aria-label="Format filter"
                  value={filterConfig.formats?.[0] || ''}
                  onChange={(e) => handleFormatFilter(e.target.value as BookFormat || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Formats</option>
                  <option value="physical">Physical</option>
                  <option value="kindle">Kindle</option>
                  <option value="kobo">Kobo</option>
                  <option value="audible">Audible</option>
                  <option value="audiobook">Audiobook</option>
                  <option value="pdf">PDF</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              {/* Year Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year
                </label>
                <select
                  aria-label="Year filter"
                  value={filterConfig.dateRange?.start.getFullYear() || ''}
                  onChange={(e) => handleYearFilter(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Years</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minimum Rating
                </label>
                <select
                  aria-label="Minimum rating filter"
                  value={filterConfig.minRating?.toString() || ''}
                  onChange={(e) => handleRatingFilter(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Any Rating</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="2">2+ Stars</option>
                  <option value="1">1+ Stars</option>
                </select>
              </div>
            </div>
            
            {Object.keys(filterConfig).length > 0 && (
              <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={clearFilters} size="sm">
                <X size={16} />
                Clear Filters
              </Button>
              </div>
            )}
          </div>
        )}
      </header>
      
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Book className="text-blue-500" />}
            label="Total Entries"
            value={readingHistory?.length || 0}
          />
          <StatCard
            icon={<RotateCcw className="text-green-500" />}
            label="Books Read"
            value={readingHistory?.filter(log => log.status === 'read').length || 0}
          />
          <StatCard
            icon={<Clock className="text-yellow-500" />}
            label="DNF"
            value={readingHistory?.filter(log => log.status === 'dnf').length || 0}
          />
          <StatCard
            icon={<Star className="text-purple-500" />}
            label="Average Rating"
            value={readingHistory && readingHistory.length > 0 
              ? (readingHistory.filter(log => log.rating?.stars).reduce((sum, log) => sum + (log.rating?.stars || 0), 0) / readingHistory.filter(log => log.rating?.stars).length).toFixed(1)
              : 'N/A'
            }
          />
        </div>
        
        {/* Sort Controls */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Sort by:</span>
          {[
            { field: 'finishedAt', label: 'Date Finished' },
            { field: 'rating', label: 'Rating' },
            { field: 'title', label: 'Title' }
          ].map(sortOption => (
            <button
              key={sortOption.field}
              onClick={() => handleSort(sortOption.field)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                sortConfig.field === sortOption.field
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {sortOption.label}
              {sortConfig.field === sortOption.field && (
                sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
              )}
            </button>
          ))}
        </div>
        
        {/* History List */}
        <div className="space-y-4">
          {paginatedHistory?.map((log) => (
            <HistoryEntryCard 
              key={log.id} 
              log={log}
              dateFormat={settings.dateFormat}
            />
          ))}
          
          {/* Empty State */}
          {(!readingHistory || readingHistory.length === 0) && (
            <div className="text-center py-16">
              <History className="mx-auto text-gray-300 dark:text-gray-600" size={48} />
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                No reading history yet
              </h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Start tracking your reading to see your history here
              </p>
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              type="button"
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

// History Entry Card Component
interface HistoryEntryCardProps {
  log: any;
  dateFormat: string;
}

function HistoryEntryCard({ log, dateFormat }: HistoryEntryCardProps) {
  const { addToast } = useToastStore();
  
  const handleSoftDelete = async () => {
    try {
      await readingLogOperations.softDelete(log.id);
      addToast({ type: 'success', message: 'Entry removed from history view' });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to remove entry from history' });
    }
  };
  
  return (
    <Card className="p-4">
      <div className="flex gap-4">
        {/* Book Cover */}
        <div className="flex-shrink-0 w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
          {log.book?.coverUrl ? (
            <img 
              src={log.book.coverUrl} 
              alt={log.book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Book className="text-gray-400" size={24} />
            </div>
          )}
        </div>
        
        {/* Book Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {log.book?.title || 'Unknown Title'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {log.book?.authors?.join(', ') || 'Unknown Author'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(log.status)}
              <button
                onClick={handleSoftDelete}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove from history"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          
          <div className="mt-2 flex items-center gap-4 text-sm">
            {/* Date */}
            {log.finishedAt && (
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Calendar size={14} />
                {format(new Date(log.finishedAt as unknown as string), dateFormat)}
              </span>
            )}
            
            {/* Format */}
            <span className="text-gray-500 dark:text-gray-400 capitalize">
              {log.book?.format}
            </span>
            
            {/* Pages */}
            {log.book?.pageCount && (
              <span className="text-gray-500 dark:text-gray-400">
                {log.book.pageCount} pages
              </span>
            )}
          </div>
          
          {/* Rating */}
          {log.rating && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={`star-${i}`}
                    size={14}
                    className={`${
                      i < Math.floor(log.rating.stars) 
                        ? 'text-yellow-400 fill-yellow-400' 
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {log.rating.stars}/5
              </span>
            </div>
          )}
          
          {/* DNF Reason */}
          {log.status === 'dnf' && log.dnfReason && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
              <span className="font-medium">DNF Reason: </span>
              {log.dnfReason}
            </div>
          )}
          
          {/* Review Preview */}
          {log.rating?.review && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {log.rating.review}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Status Badge Helper
function getStatusBadge(status: ReadingStatus) {
  const statusConfig: Record<ReadingStatus, { variant: 'success' | 'danger' | 'warning' | 'primary' | 'neutral'; label: string }> = {
    read: { variant: 'success', label: 'Read' },
    dnf: { variant: 'danger', label: 'DNF' },
    currently_reading: { variant: 'warning', label: 'Reading' },
    want_to_read: { variant: 'primary', label: 'Want to Read' }
  };
  
  const config = statusConfig[status] || { variant: 'neutral', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
