import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Monitor, Bell, Download, Trash2, Palette, Upload, RefreshCw, FileText, Calendar, Filter, Cloud } from 'lucide-react';
import { Card, Button, Badge } from '../components/common/Button';
import { useSettingsStore } from '../store/useStore';
import { useOnlineStatus } from '../hooks/useOffline';
import { useToastStore } from '../store/useStore';
import { db } from '../lib/db';
import { syncManager } from '../lib/syncManager';
import { bookExportService, downloadExportedData, getExportFormats, ExportFormat, ExportOptions } from '../lib/exportService';
import { clsx } from 'clsx';
import { AccessibleField } from '../components/common/Accessibility';
import { ImportModal } from '../components/import/ImportModal';
import type { ThemeMode, BookFormat, SyncStatus, Collection } from '../types';
import { useAuth } from '../contexts/AuthContext';

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

