import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import type { ComponentType } from 'react';
import { SidebarNavigation, FloatingActionButtons } from './components/common/Navigation';
import { ToastContainer } from './components/common/Toast';
// Lazy load all pages for optimal code splitting and faster initial load
// Core pages - lazy loaded to reduce initial bundle size
const HomePage = lazy(() => import('./pages/Home').then(module => ({ default: module.HomePage as ComponentType<unknown> })) as Promise<{ default: ComponentType<unknown> }>);
const LibraryPage = lazy(() => import('./pages/Library').then(module => ({ default: module.LibraryPage as ComponentType<unknown> })) as Promise<{ default: ComponentType<unknown> }>);
const AddBookPage = lazy(() => import('./pages/AddBook').then(module => ({ default: module.AddBookPage as ComponentType<unknown> })) as Promise<{ default: ComponentType<unknown> }>);

// Heavy pages - lazy loaded to defer ~400KB+ of charting/UI libraries
const AnalyticsPage = lazy(() => import('./pages/Analytics').then(module => ({ default: module.AnalyticsPage as ComponentType<unknown> })) as Promise<{ default: ComponentType<unknown> }>);
const BookDetailPage = lazy(() => import('./pages/BookDetail').then(module => ({ default: module.BookDetailPage as ComponentType<unknown> })) as Promise<{ default: ComponentType<unknown> }>);
const EditBookPage = lazy(() => import('./pages/EditBook').then(module => ({ default: module.EditBookPage as ComponentType<unknown> })) as Promise<{ default: ComponentType<unknown> }>);
const SettingsPage = lazy(() => import('./pages/Settings').then(module => ({ default: module.SettingsPage as ComponentType<unknown> })) as Promise<{ default: ComponentType<unknown> }>);
import { BarcodeScannerModal } from './components/scanner/BarcodeScannerModal';
import { useTheme } from './store/useStore';
import { useConnectivityHandler, useSyncStatus, useBackgroundSync, useOnlineStatus } from './hooks/useOffline';
import { registerServiceWorker } from './lib/serviceWorker';
import { useModalStore } from './store/useStore';
import { clsx } from 'clsx';
import { SkipLink, announce } from './components/common/Accessibility';

// Loading skeleton component
function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4 border-primary-600 border-t-transparent"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  useTheme(); // Initialize theme
  
  const { activeModal } = useModalStore();
  const syncStatus = useSyncStatus();
  
  // Initialize service worker
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Handle connectivity changes
  useConnectivityHandler();
  
  // Setup background sync
  const { syncInBackground } = useBackgroundSync();
  
  // Auto-sync when coming online
  useEffect(() => {
    if (syncStatus.isOnline && syncStatus.pendingOperations > 0) {
      syncInBackground();
    }
  }, [syncStatus.isOnline, syncStatus.pendingOperations, syncInBackground]);

  // Performance monitoring (metrics tracked internally)

  // Announce page changes for screen readers
  useEffect(() => {
    const path = window.location.pathname;
    announce(`Navigated to ${path}`);
  }, []);

  return (
    <div className={clsx(
      'min-h-screen bg-gray-50 dark:bg-gray-900',
      'transition-colors duration-200'
    )}>
      {/* Skip links for accessibility */}
      <SkipLink targetId="main-content">Skip to main content</SkipLink>
      <SkipLink targetId="main-navigation">Skip to navigation</SkipLink>
      
      {/* Navigation - Unified sidebar with floating action buttons */}
      <nav id="main-navigation" aria-label="Main navigation">
        <SidebarNavigation />
      </nav>
      
      {/* Floating Action Buttons */}
      <FloatingActionButtons />
      
      {/* Main Content Area */}
      <main 
        id="main-content" 
        tabIndex={-1} 
        className={clsx(
          'pt-16'
        )}
      >
        <div className="px-4 lg:px-8 max-w-7xl mx-auto">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/add" element={<AddBookPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/book/:id" element={<BookDetailPage />} />
              <Route path="/edit/:id" element={<EditBookPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      
      {/* Toast Notifications */}
      <ToastContainer />
      
      {/* Full-screen Modals */}
      {activeModal === 'barcodeScanner' && <BarcodeScannerModal />}
      
      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}

// Offline Indicator Component
function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const syncStatus = useSyncStatus();
  
  if (isOnline && syncStatus.pendingOperations === 0) return null;
  
  return (
    <div 
      className={clsx(
        'fixed top-4 right-4 z-50 px-4 py-2 rounded-full shadow-lg',
        'flex items-center gap-2',
        isOnline 
          ? 'bg-green-500 text-white' 
          : 'bg-amber-500 text-white'
      )}
      role="status"
      aria-live="polite"
    >
      <div className={clsx(
        'w-2 h-2 rounded-full',
        isOnline ? 'bg-white' : 'bg-white animate-pulse'
      )} />
      <span className="text-sm font-medium">
        {isOnline 
          ? `${syncStatus.pendingOperations} changes pending sync`
          : 'Offline mode'
        }
      </span>
    </div>
  );
}

export default App;
