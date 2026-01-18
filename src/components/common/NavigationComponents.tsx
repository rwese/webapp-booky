import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, Settings, Home, Library } from 'lucide-react';
import { clsx } from 'clsx';

// Sync status indicator component
interface SyncStatusIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

export function SyncStatusIndicator({ isOnline, pendingCount, isSyncing }: SyncStatusIndicatorProps) {
  if (isSyncing) {
    return (
      <div
        className="fixed bottom-20 right-4 z-40 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        <span className="text-sm font-medium">Syncing...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        className="fixed bottom-20 right-4 z-40 bg-amber-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <div className="w-2 h-2 bg-white rounded-full" />
        <span className="text-sm font-medium">Offline</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div
        className="fixed bottom-20 right-4 z-40 bg-green-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <span className="text-sm font-medium">{pendingCount} pending</span>
      </div>
    );
  }

  return null;
}

// Mobile menu overlay component
interface MobileMenuOverlayProps {
  onClose: () => void;
  currentPath: string;
}

export function MobileMenuOverlay({ onClose, currentPath }: MobileMenuOverlayProps) {
  const menuItems = [
    { icon: <Home size={20} />, label: 'Home', path: '/' },
    { icon: <Library size={20} />, label: 'Library', path: '/library' },
    { icon: <BarChart2 size={20} />, label: 'Analytics', path: '/analytics' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
  ];

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50"
      onClick={onClose}
    >
      <div
        className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = currentPath === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg',
                    'transition-colors duration-200',
                    'min-h-[44px]', // Touch target
                    isActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}