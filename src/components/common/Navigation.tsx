import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Library, 
  Scan, 
  Settings, 
  Menu,
  X,
  Plus,
  Book
} from 'lucide-react';
import { useUIStore, useModalStore } from '../../store/useStore';
import { useOnlineStatus, useSyncStatus } from '../../hooks/useOffline';
import { SyncStatusIndicator } from './NavigationComponents';
import { clsx } from 'clsx';

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
        className="fixed bottom-6 right-6 z-50 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors p-4 group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Add new book"
      >
        <Plus size={24} />
      </button>

      {/* Secondary FAB - Scan Barcode */}
      <button
        type="button"
        onClick={() => openModal('barcodeScanner')}
        className="fixed bottom-6 right-20 z-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors p-3 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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

// Sidebar Navigation Component
export function SidebarNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  const navItems = [
    { icon: <Home size={20} />, label: 'Home', path: '/' },
    { icon: <Library size={20} />, label: 'Library', path: '/library' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
  ];

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const handleOverlayClick = useCallback(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  // If sidebar is closed, show just the menu button
  if (!sidebarOpen) {
    return (
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-40 p-3 bg-white dark:bg-gray-800 shadow-md rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="Open sidebar"
      >
        <Menu size={24} className="text-gray-600 dark:text-gray-300" />
      </button>
    );
  }

  return (
    <>
      {/* Overlay - click to close sidebar */}
      <button
        type="button"
        className="fixed inset-0 bg-black/50 z-40 w-full h-full cursor-pointer"
        onClick={handleOverlayClick}
        aria-label="Close sidebar"
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
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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
