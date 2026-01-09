import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Library, 
  Scan, 
  BarChart2, 
  Settings, 
  History,
  Menu,
  X,
  Plus,
  Book
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
        className="fixed bottom-24 right-4 z-40 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2"
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
        className="fixed bottom-24 right-4 z-40 bg-amber-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2"
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
        className="fixed bottom-24 right-4 z-40 bg-green-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <span className="text-sm font-medium">{pendingCount} pending</span>
      </div>
    );
  }

  return null;
}

// Floating Action Buttons Component
export function FloatingActionButtons() {
  const navigate = useNavigate();
  const { openModal } = useModalStore();
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();

  return (
    <>
      {/* Main FAB - Add Book */}
      <button
        type="button"
        onClick={() => navigate('/add?mode=manual')}
        className="fixed bottom-6 right-6 z-50 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors p-4 group"
        aria-label="Add new book"
      >
        <Plus size={24} />
      </button>

      {/* Secondary FAB - Scan Barcode (appears on hover or can be separate) */}
      <button
        type="button"
        onClick={() => openModal('barcodeScanner')}
        className="fixed bottom-6 right-20 z-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors p-3"
        aria-label="Scan barcode"
      >
        <Scan size={20} />
      </button>

      <SyncStatusIndicator 
        isOnline={isOnline} 
        pendingCount={syncStatus.pendingOperations}
        isSyncing={syncStatus.isSyncing}
      />
    </>
  );
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
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl p-4"
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

// Enhanced bottom navigation component (to be removed later)
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

// Sidebar Navigation Component
export function SidebarNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { openModal } = useModalStore();
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();

  const navItems = [
    { icon: <Home size={20} />, label: 'Home', path: '/' },
    { icon: <Library size={20} />, label: 'Library', path: '/library' },
    { icon: <History size={20} />, label: 'History', path: '/history' },
    { icon: <BarChart2 size={20} />, label: 'Analytics', path: '/analytics' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
  ];

  // If sidebar is closed, show just the menu button
  if (!sidebarOpen) {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-40 p-3 bg-white dark:bg-gray-800 shadow-md rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Open sidebar"
      >
        <Menu size={24} className="text-gray-600 dark:text-gray-300" />
      </button>
    );
  }

  return (
    <>
      {/* Overlay - click to close sidebar */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar */}
      <aside 
        className="fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-xl"
        aria-label="Sidebar navigation"
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Book className="text-primary-600" size={32} />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Book Collection</h1>
                <p className="text-sm text-gray-500">Your personal library</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close sidebar"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Navigation Items */}
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg',
                      'transition-all duration-200',
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
        </nav>
        
        {/* Sidebar Footer - Add Book Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              navigate('/add?mode=manual');
              setSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Plus size={20} />
            Add New Book
          </button>
        </div>
      </aside>
    </>
  );
}

export { useState, useCallback };