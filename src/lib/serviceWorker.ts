// Service Worker Registration
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Use Vite PWA plugin's generated service worker path
      const swPath = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';
      navigator.serviceWorker.register(swPath)
        .then(registration => {
          console.log('ServiceWorker registered:', registration.scope);
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content available
                    console.log('New content available, please refresh.');
                    window.dispatchEvent(new CustomEvent('sw:updateAvailable'));
                  } else {
                    // Content is cached
                    console.log('Content is cached for offline use.');
                    window.dispatchEvent(new CustomEvent('sw:offlineReady'));
                  }
                }
              });
            }
          });
        })
        .catch(error => {
          console.error('ServiceWorker registration failed:', error);
        });

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETE') {
          window.dispatchEvent(new CustomEvent('sync:end'));
        } else if (event.data.type === 'SYNC_FAILED') {
          window.dispatchEvent(new CustomEvent('sync:error', { detail: event.data.error }));
        }
      });
    });
  }
}

// Background Sync Request
export function requestBackgroundSync(tag: string) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      if ('sync' in registration) {
        return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag)
          .then(() => {
            console.log('Background sync registered for:', tag);
          })
          .catch((error: Error) => {
            console.error('Background sync registration failed:', error);
          });
      }
    });
  }
}

// Skip Waiting
export function skipWaiting() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  }
}

// Service Worker Update Handler
export function useServiceWorkerUpdate() {
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setNeedsUpdate(true);
    };

    window.addEventListener('sw:updateAvailable', handleUpdateAvailable);
    return () => window.removeEventListener('sw:updateAvailable', handleUpdateAvailable);
  }, []);

  const update = useCallback(() => {
    skipWaiting();
    window.location.reload();
  }, []);

  return { needsUpdate, update };
}

import { useState, useEffect, useCallback } from 'react';