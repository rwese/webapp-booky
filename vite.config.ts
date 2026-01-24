import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'icons/*.svg'],
      manifest: {
        name: 'Book Collection',
        short_name: 'Books',
        description: 'A mobile-first, offline-capable webapp for organizing personal book collections',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['books', 'productivity', 'lifestyle'],
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Add Book',
            short_name: 'Add',
            description: 'Add a new book to your collection',
            url: '/add',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'My Library',
            short_name: 'Library',
            description: 'View your book collection',
            url: '/library',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        // Only precache production assets - not development files
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ignore query parameters for cache matching (e.g., ?hash=xxx)
        ignoreURLParametersMatching: [/^v$/, /^t$/],
        // Suppress console warnings for missing precache matches
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        // Clean outdated caches on activation
        cleanupOutdatedCaches: true,
        // Define runtime caching strategies
        runtimeCaching: [
          {
            // Cache Open Library API responses
            urlPattern: /^https:\/\/.*\.openlibrary\.org\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openlibrary-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              // Handle Vary: Origin header properly
              matchOptions: {
                ignoreVary: true
              }
            }
          },
          {
            // Cache Google Fonts stylesheets and fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              // Handle Vary: Origin header for font loading
              matchOptions: {
                ignoreVary: true
              }
            }
          },
          {
            // Cache Google Books API responses
            urlPattern: /^https:\/\/books\.google\.com\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'googlebooks-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              matchOptions: {
                ignoreVary: true
              }
            }
          },
          {
            // Cache Google Books API endpoint
            urlPattern: /^https:\/\/www\.googleapis\.com\/books\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-books-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10,
              matchOptions: {
                ignoreVary: true
              }
            }
          },
          {
            // Cache Open Library cover images
            urlPattern: /^https:\/\/covers\.openlibrary\.org\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'covers-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days for offline access
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              // Handle Vary: Origin header for cover images
              matchOptions: {
                ignoreVary: true
              }
            }
          },
          {
            // Enhanced Google Books cover caching
            urlPattern: /^https:\/\/books\.google\.com\/books\/.*\/images\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-books-covers-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache Open Library API responses (longer term)
            urlPattern: /^https:\/\/openlibrary\.org\/api\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openlibrary-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 15,
              matchOptions: {
                ignoreVary: true
              }
            }
          }
        ]
      },
      // Precaching for critical assets
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB for larger assets
        // Suppress warning about missing precache matches
        swDest: 'dist/sw.js'
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@lib': resolve(__dirname, './src/lib'),
      '@store': resolve(__dirname, './src/store'),
      '@styles': resolve(__dirname, './src/styles'),
      '@types': resolve(__dirname, './src/types')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps for production
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React framework - rarely changes
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Charting library - heavy, loaded on analytics page
          charts: ['recharts'],
          // UI components - icons and class utilities
          ui: ['lucide-react', 'clsx', 'tailwind-merge'],
          // Form handling - validation and forms
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
          // Database - Dexie for IndexedDB
          db: ['dexie', 'dexie-react-hooks'],
          // Date utilities
          date: ['date-fns']
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.');
          const ext = info?.[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp)$/.test(assetInfo.name ?? '')) {
            return `images/[name]-[hash].${ext}`;
          }
          if (/\.(css)$/.test(assetInfo.name ?? '')) {
            return `css/[name]-[hash].${ext}`;
          }
          return `[name]-[hash].${ext}`;
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 400
  },
  server: {
    port: 3001,
    open: true
  }
});
