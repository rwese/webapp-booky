import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Library, 
  Scan, 
  BarChart2, 
  Settings, 
  History,
  Menu,
  X
} from 'lucide-react';
import { useUIStore, useModalStore } from '../../store/useStore';
import { useOnlineStatus, useSyncStatus } from '../../hooks/useOffline';
import { clsx } from 'clsx';

// Sync status indicator component
function SyncStatusIndicator({ isOnline, pendingCount, isSyncing }: { 
  isOnline: boolean; 
  pendingCount: number; 
  isSyncing: boolean;
}) {
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
function MobileMenuOverlay({ 
  onClose, 
  currentPath 
}: { 
  onClose: () => void;
  currentPath: string;
}) {
  const menuItems = [
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

// Enhanced bottom navigation component
export function BottomNavigation() {
  const location = useLocation();
  const { mobileNavOpen, toggleMobileNav } = useUIStore();
  const { openModal } = useModalStore();
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();

  const navItems = [
    { id: 'home', label: 'Home', icon: <Home size={24} />, path: '/' },
    { id: 'library', label: 'Library', icon: <Library size={24} />, path: '/library' },
    { id: 'scan', label: 'Scan', icon: <Scan size={24} />, path: '/add', action: () => openModal('barcodeScanner') },
    { id: 'history', label: 'History', icon: <History size={24} />, path: '/history' },
    { id: 'more', label: 'More', icon: mobileNavOpen ? <X size={24} /> : <Menu size={24} />, path: '#', action: toggleMobileNav },
  ];

  return (
    <>
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 h-16"
        aria-label="Bottom navigation"
      >
        <div className="flex items-center justify-around h-full max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = item.path !== '#' && location.pathname === item.path;
            
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={(e) => {
                  if (item.action) {
                    e.preventDefault();
                    item.action();
                  }
                }}
                className={clsx(
                  'flex flex-col items-center justify-center flex-1 h-full',
                  'transition-all duration-200 min-h-[44px] min-w-[44px]',
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <SyncStatusIndicator 
        isOnline={isOnline} 
        pendingCount={syncStatus.pendingOperations}
        isSyncing={syncStatus.isSyncing}
      />

      {mobileNavOpen && (
        <MobileMenuOverlay 
          onClose={toggleMobileNav}
          currentPath={location.pathname}
        />
      )}
    </>
  );
}

// Export hook for device detection
export { useState, useCallback };