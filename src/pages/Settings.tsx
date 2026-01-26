import React, { useState } from 'react';
import { Moon, Sun, Monitor, Bell, Download, Trash2, Palette, Upload, Database } from 'lucide-react';
import { Card, Button } from '../components/common/Button';
import { useSettingsStore } from '../store/useStore';
import { useToastStore } from '../store/useStore';
import { db } from '../lib/db';
import { clsx } from 'clsx';
import { AccessibleField } from '../components/common/Accessibility';
import { BackupModal } from '../components/common/BackupModal';
import type { ThemeMode } from '../types';

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const theme = settings.theme;
  const { addToast } = useToastStore();
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

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
            <Database size={20} />
            Data Management
          </h2>
          <Card className="p-4">
            <div className="space-y-4">
              {/* Backup & Restore */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                    <Download size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Backup & Restore</p>
                    <p className="text-sm text-gray-500">
                      Export and import your library data
                    </p>
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={() => setIsBackupModalOpen(true)}>
                  <Upload size={16} className="mr-1" />
                  Manage
                </Button>
              </div>
              
              {/* Clear Data */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <Trash2 size={20} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Clear All Data</p>
                    <p className="text-sm text-gray-500">Delete all local data (cannot be undone)</p>
                  </div>
                </div>
                <Button type="button" variant="danger" onClick={handleClearData}>
                  <Trash2 size={16} />
                  Clear Data
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </main>

      {/* Backup Modal */}
      <BackupModal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} />
    </div>
  );
}

// Toggle Setting Component
function ToggleSetting({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
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
