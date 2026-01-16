import React, { lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { registerServiceWorker } from './lib/serviceWorker';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./pages/Home').then(module => ({ default: module.HomePage })));
const LibraryPage = lazy(() => import('./pages/Library').then(module => ({ default: module.LibraryPage })));
const AddBookPage = lazy(() => import('./pages/AddBook').then(module => ({ default: module.AddBookPage })));
const AnalyticsPage = lazy(() => import('./pages/Analytics').then(module => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then(module => ({ default: module.SettingsPage })));
const BookDetailPage = lazy(() => import('./pages/BookDetail').then(module => ({ default: module.BookDetailPage })));

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
