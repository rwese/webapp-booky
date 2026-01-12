import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Library, 
  Scan, 
  Menu,
  X
} from 'lucide-react';
import { useUIStore, useModalStore } from '../../store/useStore';
import { useOnlineStatus, useSyncStatus } from '../../hooks/useOffline';
import { SyncStatusIndicator, MobileMenuOverlay } from './NavigationComponents';
import { clsx } from 'clsx';

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
