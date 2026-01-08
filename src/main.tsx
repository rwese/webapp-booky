import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { registerServiceWorker } from './lib/serviceWorker';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SkeletonBookDetail } from './components/common/Skeleton';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./pages/Home'));
const LibraryPage = lazy(() => import('./pages/Library'));
const AddBookPage = lazy(() => import('./pages/AddBook'));
const AnalyticsPage = lazy(() => import('./pages/Analytics'));
const HistoryPage = lazy(() => import('./pages/History'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const BookDetailPage = lazy(() => import('./pages/BookDetail'));

// Loading fallback component
function PageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4 border-primary-600 border-t-transparent"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
