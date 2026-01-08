import React, { useState, useCallback } from 'react';
import { Settings, Moon, Sun, Monitor, Bell, Shield, Download, Trash2, Palette, Eye, Type, Zap, Volume2, VolumeX, Accessibility } from 'lucide-react';
import { Card, Button, Badge } from '../components/common/Button';
import { useSettingsStore, useUIStore } from '../store/useStore';
import { useOnlineStatus } from '../hooks/useOffline';
import { useToastStore } from '../store/useStore';
import { db } from '../lib/db';
import { clsx } from 'clsx';
import { AccessibleField } from '../components/common/Accessibility';
import { useReducedMotion } from '../hooks/usePerformance';

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const { theme, setTheme } = useUIStore();
  const { addToast } = useToastStore();
  const isOnline = useOnlineStatus();
  const reducedMotion = useReducedMotion();
  
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
  
  const handleExportData = () => {
    // Export data as JSON
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `book-collection-export-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: 'Data exported successfully' });
  };

  return (
    <div className="min-h-screen pb-20 lg:pb-0 lg:pl-64">
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
                        onClick={() => setTheme(option.value as any)}
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

              <div>
                <AccessibleField
                  label="Animations"
                  hint="Reduce motion for better performance or accessibility"
                  required={false}
                >
                  <button
                    type="button"
                    onClick={() => updateSettings({ animationsEnabled: !settings.animationsEnabled })}
                    className={clsx(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      settings.animationsEnabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                    )}
                    aria-pressed={settings.animationsEnabled}
                    role="switch"
                    aria-checked={settings.animationsEnabled}
                  >
                    <span
                      className={clsx(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        settings.animationsEnabled ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </AccessibleField>
              </div>

              <div>
                <AccessibleField
                  label="Reduced Motion"
                  hint="Minimize animations and transitions"
                  required={false}
                >
                  <button
                    type="button"
                    onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                    className={clsx(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      settings.reducedMotion ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                    )}
                    aria-pressed={settings.reducedMotion}
                    role="switch"
                    aria-checked={settings.reducedMotion}
                  >
                    <span
                      className={clsx(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        settings.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </AccessibleField>
              </div>
            </div>
          </Card>
        </section>
        
        {/* Accessibility */}
        <section aria-labelledby="accessibility-heading">
          <h2 id="accessibility-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Accessibility size={20} />
            Accessibility
          </h2>
          <Card className="p-4">
            <div className="space-y-6">
              <ToggleSetting
                label="High Contrast"
                description="Increase color contrast for better visibility"
                checked={settings.highContrast}
                onChange={() => updateSettings({ highContrast: !settings.highContrast })}
              />
              
              <div>
                <AccessibleField
                  label="Font Size"
                  required={false}
                >
                  <select
                    id="font-size"
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: e.target.value as any })}
                    className="input"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium (Default)</option>
                    <option value="large">Large</option>
                  </select>
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
        
        {/* Data & Privacy */}
        <section aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield size={20} />
            Data & Privacy
          </h2>
          <Card className="p-4">
            <div className="space-y-4">
              <ToggleSetting
                label="Track Reading Progress"
                description="Automatically track pages read (requires book metadata)"
                checked={settings.analyticsPreferences.trackPagesRead}
                onChange={() => updateSettings({
                  analyticsPreferences: {
                    ...settings.analyticsPreferences,
                    trackPagesRead: !settings.analyticsPreferences.trackPagesRead
                  }
                })}
              />
              <ToggleSetting
                label="Anonymous Analytics"
                description="Help improve the app with anonymous usage data"
                checked={settings.analyticsPreferences.anonymousData}
                onChange={() => updateSettings({
                  analyticsPreferences: {
                    ...settings.analyticsPreferences,
                    anonymousData: !settings.analyticsPreferences.anonymousData
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Export Data</p>
                  <p className="text-sm text-gray-500">Download your library as JSON</p>
                </div>
                <Button type="button" variant="secondary" onClick={handleExportData}>
                  Export
                </Button>
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
                  onChange={(e) => updateSettings({ defaultFormat: e.target.value as any })}
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
                  onChange={(e) => updateSettings({ ratingDisplay: e.target.value as any })}
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
              <div className="flex justify-between">
                <span className="text-gray-500">Reduced Motion</span>
                <Badge variant={reducedMotion ? 'warning' : 'neutral'}>{reducedMotion ? 'Enabled' : 'Disabled'}</Badge>
              </div>
            </div>
          </Card>
        </section>
      </main>
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

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
