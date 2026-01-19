import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Monitor, Bell, Download, Trash2, Palette, Upload, RefreshCw, FileText, Calendar, Filter, Cloud, Target, Flame, User, Search, X, Edit2, Plus } from 'lucide-react';
import { Card, Button, Badge } from '../components/common/Button';
import { Input } from '../components/common/Button';
import { useSettingsStore } from '../store/useStore';
import { useOnlineStatus } from '../hooks/useOffline';
import { useToastStore } from '../store/useStore';
import { db } from '../lib/db';
import { syncManager } from '../lib/syncManager';
import { bookExportService, downloadExportedData, getExportFormats, ExportFormat, ExportOptions } from '../lib/exportService';
import { clsx } from 'clsx';
import { AccessibleField } from '../components/common/Accessibility';
import { ImportModal } from '../components/import/ImportModal';
import type { ThemeMode, BookFormat, SyncStatus, Collection, Borrower } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useReadingGoals, useGoalForm } from '../hooks/useReadingGoals';
import { useReadingStreak } from '../hooks/useReadingStreak';
import { useBorrowers, useBorrowerActions, useBorrowerLoanSummary } from '../hooks/useBorrowerManagement';
import { getYear } from 'date-fns';

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const theme = settings.theme;
  const { addToast } = useToastStore();
  const isOnline = useOnlineStatus();
  const { isAuthenticated } = useAuth();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Export-related state
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [includeRatings, setIncludeRatings] = useState(true);
  const [includeReadingLogs, setIncludeReadingLogs] = useState(true);
  const [includeCollections, setIncludeCollections] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  
  // Set up sync listener
  useEffect(() => {
    const unsubscribe = syncManager.addSyncListener((status: SyncStatus) => {
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pendingOperations || 0);
    });
    
    // Initial status check
    syncManager.getStatus().then((status: SyncStatus) => {
      setPendingCount(status.pendingOperations || 0);
    });
    
    return unsubscribe;
  }, []);
  
  // Load collections for export options
  useEffect(() => {
    const loadCollections = async () => {
      try {
        const allCollections = await db.collections.toArray();
        setCollections(allCollections);
      } catch (error) {
        console.error('Failed to load collections:', error);
      }
    };
    loadCollections();
  }, []);
  
  const handleSync = async () => {
    if (!isOnline) {
      addToast({ type: 'warning', message: 'You are offline. Connect to the internet to sync.' });
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await syncManager.sync();
      if (result.success) {
        addToast({ type: 'success', message: 'Sync completed successfully!' });
      } else {
        addToast({ type: 'error', message: result.error || 'Sync failed. Please try again.' });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'Sync failed. Please try again.' });
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      try {
        await db.delete();
        addToast({ type: 'success', message: 'All data cleared. Refreshing...' });
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        addToast({ type: 'error', message: 'Failed to clear data' });
      }
    }
  };
  
  const handleExportData = async () => {
    setIsExporting(true);
    setShowExportOptions(false);
    
    try {
      const options: ExportOptions = {
        format: selectedFormat,
        collectionId: selectedCollection || undefined,
        includeRatings,
        includeReadingLogs,
        includeCollections,
        includeTags
      };

      // Add date range if specified
      if (dateRange.start && dateRange.end) {
        options.dateRange = {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end)
        };
      }

      const { data, filename } = await bookExportService.exportBooks(options);
      downloadExportedData(data, filename);
      
      addToast({ 
        type: 'success', 
        message: `Library exported successfully as ${selectedFormat.toUpperCase()}` 
      });
    } catch (error) {
      console.error('Export failed:', error);
      addToast({ type: 'error', message: 'Failed to export data. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Customize your app experience
        </p>
      </header>
      
      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Appearance */}
        <section aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Palette size={20} />
            Appearance
          </h2>
          <Card className="p-4">
            <div className="space-y-6">
              <div>
                <AccessibleField
                  label="Theme"
                  required={false}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'light', label: 'Light', icon: Sun, description: 'Always use light mode' },
                      { value: 'dark', label: 'Dark', icon: Moon, description: 'Always use dark mode' },
                      { value: 'system', label: 'System', icon: Monitor, description: 'Follow your device settings' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateSettings({ theme: option.value as ThemeMode })}
                        className={clsx(
                          'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                          theme === option.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        )}
                        aria-pressed={theme === option.value}
                        aria-label={option.description}
                      >
                        <option.icon size={24} />
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </AccessibleField>
              </div>
            </div>
          </Card>
        </section>
        
        {/* Notifications */}
        <section aria-labelledby="notifications-heading">
          <h2 id="notifications-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell size={20} />
            Notifications
          </h2>
          <Card className="p-4">
            <div className="space-y-4">
              <ToggleSetting
                label="Reading Reminders"
                description="Get reminded to read your current book"
                checked={settings.notificationPreferences.readingReminders}
                onChange={() => updateSettings({
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    readingReminders: !settings.notificationPreferences.readingReminders
                  }
                })}
              />
              <ToggleSetting
                label="New Book Suggestions"
                description="Receive personalized book recommendations"
                checked={settings.notificationPreferences.newRecommendations}
                onChange={() => updateSettings({
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    newRecommendations: !settings.notificationPreferences.newRecommendations
                  }
                })}
              />
              <ToggleSetting
                label="Weekly Digest"
                description="Weekly summary of your reading activity"
                checked={settings.notificationPreferences.weeklyDigest}
                onChange={() => updateSettings({
                  notificationPreferences: {
                    ...settings.notificationPreferences,
                    weeklyDigest: !settings.notificationPreferences.weeklyDigest
                  }
                })}
              />
            </div>
          </Card>
        </section>
        
        {/* Storage */}
        <section aria-labelledby="storage-heading">
          <h2 id="storage-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Download size={20} />
            Data Management
          </h2>
          <Card className="p-4">
            <div className="space-y-4">
              {/* Cloud Sync Toggle */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Cloud size={20} className="text-primary-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Cloud Sync</p>
                    <p className="text-sm text-gray-500">
                      {isAuthenticated ? 'Sync books with your account' : 'Sign in to enable cloud sync'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      addToast({ type: 'warning', message: 'Please sign in to enable cloud sync' });
                      return;
                    }
                    updateSettings({ cloudSyncEnabled: !settings.cloudSyncEnabled });
                    addToast({ 
                      type: 'success', 
                      message: !settings.cloudSyncEnabled ? 'Cloud sync enabled' : 'Cloud sync disabled' 
                    });
                  }}
                  disabled={!isAuthenticated}
                  className={clsx(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.cloudSyncEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
                    !isAuthenticated && 'opacity-50 cursor-not-allowed',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
                  )}
                  role="switch"
                  aria-checked={settings.cloudSyncEnabled}
                >
                  <span
                    className={clsx(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.cloudSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
              
              {/* Sync Section */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Sync Data</p>
                  <p className="text-sm text-gray-500">
                    {pendingCount > 0 
                      ? `${pendingCount} pending changes to sync`
                      : settings.cloudSyncEnabled && isAuthenticated 
                        ? 'Your data is synced with the cloud'
                        : 'Local-only mode'}
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleSync}
                  disabled={!isOnline || isSyncing || !settings.cloudSyncEnabled || !isAuthenticated}
                >
                  <RefreshCw size={16} className={clsx('mr-1', isSyncing && 'animate-spin')} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Import Books</p>
                  <p className="text-sm text-gray-500">Import from booknotes-export</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setIsImportModalOpen(true)}>
                  <Upload size={16} />
                  Import
                </Button>
              </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Export Data</p>
                    <p className="text-sm text-gray-500">Download your library in various formats</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                      className="input py-1 px-2 text-sm"
                    >
                      {getExportFormats().map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setShowExportOptions(!showExportOptions)}
                      disabled={isExporting}
                    >
                      <Filter size={16} className="mr-1" />
                      Options
                    </Button>
                    <Button 
                      type="button" 
                      variant="primary" 
                      onClick={handleExportData}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw size={16} className="mr-1 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download size={16} className="mr-1" />
                          Export
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Export Options Panel */}
                {showExportOptions && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Collection Filter */}
                      <div>
                        <label htmlFor="collection-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Filter size={14} className="inline mr-1" />
                          Filter by Collection
                        </label>
                        <select
                          id="collection-filter"
                          value={selectedCollection}
                          onChange={(e) => setSelectedCollection(e.target.value)}
                          className="input"
                        >
                          <option value="">All Collections</option>
                          {collections.map((collection) => (
                            <option key={collection.id} value={collection.id}>
                              {collection.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Date Range */}
                      <div className="space-y-2">
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Calendar size={14} className="inline mr-1" />
                          Date Range (Added)
                        </span>
                        <div className="flex gap-2">
                          <div>
                            <label htmlFor="date-start" className="sr-only">Start date</label>
                            <input
                              id="date-start"
                              type="date"
                              value={dateRange.start}
                              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                              className="input py-1 px-2 text-sm"
                              placeholder="Start date"
                            />
                          </div>
                          <div>
                            <label htmlFor="date-end" className="sr-only">End date</label>
                            <input
                              id="date-end"
                              type="date"
                              value={dateRange.end}
                              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                              className="input py-1 px-2 text-sm"
                              placeholder="End date"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Include Options */}
                    <div>
                      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <FileText size={14} className="inline mr-1" />
                        Include in Export
                      </span>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={includeRatings}
                            onChange={(e) => setIncludeRatings(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Ratings
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={includeReadingLogs}
                            onChange={(e) => setIncludeReadingLogs(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Reading History
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={includeCollections}
                            onChange={(e) => setIncludeCollections(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Collections
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={includeTags}
                            onChange={(e) => setIncludeTags(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Tags
                        </label>
                      </div>
                    </div>
                    
                    {/* Format Description */}
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded p-2">
                      <strong>{getExportFormats().find(f => f.value === selectedFormat)?.label}:</strong>{' '}
                      {getExportFormats().find(f => f.value === selectedFormat)?.description}
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Clear All Data</p>
                  <p className="text-sm text-gray-500">Delete all local data (cannot be undone)</p>
                </div>
                <Button type="button" variant="danger" onClick={handleClearData}>
                  <Trash2 size={16} />
                  Clear Data
                </Button>
              </div>
              </div>
            </div>
          </Card>
        </section>
        
        {/* Borrower Management */}
        <section aria-labelledby="borrowers-heading">
          <h2 id="borrowers-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User size={20} />
            Borrowers
          </h2>
          <Card className="p-4">
            <BorrowerManagementSection />
          </Card>
        </section>
        
        {/* Default Settings */}
        <section aria-labelledby="defaults-heading">
          <h2 id="defaults-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings size={20} />
            Defaults
          </h2>
          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="default-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Book Format
                </label>
                <select
                  id="default-format"
                  value={settings.defaultFormat}
                  onChange={(e) => updateSettings({ defaultFormat: e.target.value as BookFormat })}
                  className="input"
                >
                  <option value="physical">Physical Book</option>
                  <option value="kindle">Kindle</option>
                  <option value="kobo">Kobo</option>
                  <option value="audible">Audible</option>
                  <option value="audiobook">Audiobook</option>
                  <option value="pdf">PDF</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="rating-display" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rating Display
                </label>
                <select
                  id="rating-display"
                  value={settings.ratingDisplay}
                  onChange={(e) => updateSettings({ ratingDisplay: e.target.value as 'stars' | 'numbers' })}
                  className="input"
                >
                  <option value="stars">Stars (★★★★★)</option>
                  <option value="numbers">Numbers (4.5/5)</option>
                </select>
              </div>
              <div>
                <label htmlFor="date-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Format
                </label>
                <select
                  id="date-format"
                  value={settings.dateFormat}
                  onChange={(e) => updateSettings({ dateFormat: e.target.value })}
                  className="input"
                >
                  <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                  <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                  <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </Card>
        </section>
        
        {/* Reading Goals */}
        <section aria-labelledby="goals-heading">
          <h2 id="goals-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Target size={20} />
            Reading Goals
          </h2>
          <Card className="p-4">
            <ReadingGoalsSection />
          </Card>
        </section>
        
        {/* App Info */}
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            About
          </h2>
          <Card className="p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="text-gray-900 dark:text-white">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge variant="success">{isOnline ? 'Online' : 'Offline'}</Badge>
              </div>
            </div>
          </Card>
        </section>
      </main>
      
      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={clsx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

// Reading Goals Section Component
function ReadingGoalsSection() {
  const { addToast } = useToastStore();
  const streak = useReadingStreak();
  const { 
    yearlyBooksGoal, 
    yearlyPagesGoal,
    getGoalProgress 
  } = useReadingGoals();
  
  const {
    goalType,
    setGoalType,
    period,
    setPeriod,
    targetValue,
    setTargetValue,
    isSubmitting,
    handleSubmit
  } = useGoalForm();
  
  const booksProgress = getGoalProgress(yearlyBooksGoal);
  const pagesProgress = getGoalProgress(yearlyPagesGoal);
  const currentYear = getYear(new Date());
  
  const handleCreateGoal = async (e: React.FormEvent) => {
    await handleSubmit(e);
    addToast({ type: 'success', message: 'Reading goal created!' });
  };

  return (
    <div className="space-y-6">
      {/* Streak Display */}
      <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
        <div className="flex items-center gap-3">
          <Flame size={24} className="text-orange-500" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{streak.currentStreak} day streak</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Longest: {streak.longestStreak} days
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total reading days</p>
          <p className="font-semibold text-gray-900 dark:text-white">{streak.totalReadingDays}</p>
        </div>
      </div>
      
      {/* Current Year Goals */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">{currentYear} Goals</h3>
        
        {/* Books Goal */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Books read</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {booksProgress.current} / {booksProgress.target}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, booksProgress.percentage)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {booksProgress.remaining > 0 
              ? `${booksProgress.remaining} books remaining`
              : 'Goal reached!'}
          </p>
        </div>
        
        {/* Pages Goal */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Pages read</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {pagesProgress.current.toLocaleString()} / {pagesProgress.target.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, pagesProgress.percentage)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {pagesProgress.remaining > 0 
              ? `${pagesProgress.remaining.toLocaleString()} pages remaining`
              : 'Goal reached!'}
          </p>
        </div>
      </div>
      
      {/* Add New Goal */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Set a New Goal</h4>
        <form onSubmit={handleCreateGoal} className="space-y-3">
          <div className="flex gap-3">
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value as 'books' | 'pages')}
              className="input py-2 flex-1"
            >
              <option value="books">Books</option>
              <option value="pages">Pages</option>
            </select>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'yearly' | 'monthly')}
              className="input py-2 flex-1"
            >
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label htmlFor="target-value" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target
            </label>
            <input
              id="target-value"
              type="number"
              min={1}
              value={targetValue}
              onChange={(e) => setTargetValue(parseInt(e.target.value) || 1)}
              className="input"
              placeholder={goalType === 'books' ? '12' : '3000'}
            />
          </div>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Saving...' : 'Set Goal'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// Borrower Management Section Component
function BorrowerManagementSection() {
  const { addToast } = useToastStore();
  const borrowers = useBorrowers();
  const { createBorrower, updateBorrower, deleteBorrower, isLoading, error } = useBorrowerActions();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Filter borrowers based on search
  const filteredBorrowers = borrowers.filter(borrower =>
    borrower.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.phone?.includes(searchQuery)
  );

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormNotes('');
    setShowAddForm(false);
    setEditingBorrower(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim()) {
      addToast({ type: 'error', message: 'Name is required' });
      return;
    }

    try {
      if (editingBorrower) {
        await updateBorrower(editingBorrower.id, {
          name: formName.trim(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
        addToast({ type: 'success', message: 'Borrower updated!' });
      } else {
        await createBorrower({
          name: formName.trim(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
        addToast({ type: 'success', message: 'Borrower added!' });
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save borrower:', err);
      addToast({ type: 'error', message: error || 'Failed to save borrower' });
    }
  };

  const handleEdit = (borrower: Borrower) => {
    setEditingBorrower(borrower);
    setFormName(borrower.name);
    setFormEmail(borrower.email || '');
    setFormPhone(borrower.phone || '');
    setFormNotes(borrower.notes || '');
    setShowAddForm(true);
  };

  const handleDelete = async (borrower: Borrower) => {
    if (window.confirm(`Are you sure you want to delete ${borrower.name}?`)) {
      try {
        await deleteBorrower(borrower.id);
        addToast({ type: 'success', message: 'Borrower deleted!' });
      } catch (err) {
        console.error('Failed to delete borrower:', err);
        addToast({ type: 'error', message: error || 'Failed to delete borrower' });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search borrowers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-gray-900 dark:text-white">
            {editingBorrower ? 'Edit Borrower' : 'Add New Borrower'}
          </h3>
          <Input
            label="Name *"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Enter name"
          />
          <Input
            label="Email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="Enter email"
          />
          <Input
            label="Phone"
            type="tel"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            placeholder="Enter phone number"
          />
          <div>
            <label htmlFor="borrower-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              id="borrower-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any notes..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : editingBorrower ? 'Update' : 'Add'}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Add Button */}
      {!showAddForm && (
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => setShowAddForm(true)}
          className="w-full"
          type="button"
        >
          <Plus size={16} />
          Add Borrower
        </Button>
      )}

      {filteredBorrowers.length > 0 ? (
        <div className="space-y-2">
          {filteredBorrowers.map(borrower => (
            <BorrowerCard 
              key={borrower.id} 
              borrower={borrower}
              onEdit={() => handleEdit(borrower)}
              onDelete={() => handleDelete(borrower)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          {searchQuery ? 'No borrowers found' : 'No borrowers yet. Add one to get started!'}
        </div>
      )}
    </div>
  );
}

// Individual Borrower Card Component
function BorrowerCard({ 
  borrower, 
  onEdit, 
  onDelete 
}: { 
  borrower: Borrower; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  const loanSummary = useBorrowerLoanSummary(borrower.id);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 dark:text-white truncate">{borrower.name}</p>
          {loanSummary?.activeLoansCount ? (
            <Badge variant="warning">{loanSummary.activeLoansCount} on loan</Badge>
          ) : null}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {borrower.email && <span>{borrower.email}</span>}
          {borrower.email && borrower.phone && <span> • </span>}
          {borrower.phone && <span>{borrower.phone}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Edit"
        >
          <Edit2 size={16} className="text-gray-400" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Delete"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}

