import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings, FilterConfig, SortConfig } from '../types';

// UI State Store
interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  mobileNavOpen: boolean;
  
  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleMobileNav: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

// Persisted settings store
interface SettingsState {
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

// Library view state
interface LibraryState {
  viewMode: 'grid' | 'list';
  sortConfig: SortConfig;
  filterConfig: FilterConfig;
  
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortConfig: (config: SortConfig) => void;
  setFilterConfig: (config: FilterConfig) => void;
  clearFilters: () => void;
}

// Modal state
interface ModalState {
  activeModal: string | null;
  modalData: any;
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;
}

// Toast notifications
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

// UI State Store
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  theme: 'system',
  mobileNavOpen: false,
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));

// Settings Store
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        theme: 'system',
        defaultFormat: 'physical',
        ratingDisplay: 'stars',
        dateFormat: 'MM/dd/yyyy',
        analyticsPreferences: {
          showCharts: true,
          defaultTimeRange: 'year',
          trackPagesRead: true
        }
      },
      
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),
      
      resetSettings: () =>
        set({
          settings: {
            theme: 'system',
            defaultFormat: 'physical',
            ratingDisplay: 'stars',
            dateFormat: 'MM/dd/yyyy',
            analyticsPreferences: {
              showCharts: true,
              defaultTimeRange: 'year',
              trackPagesRead: true
            }
          }
        })
    }),
    {
      name: 'settings-storage'
    }
  )
);

// Library State Store
export const useLibraryStore = create<LibraryState>((set) => ({
  viewMode: 'grid',
  sortConfig: { field: 'addedAt', direction: 'desc' },
  filterConfig: {},
  
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortConfig: (config) => set({ sortConfig: config }),
  setFilterConfig: (config) => set((state) => ({
    filterConfig: { ...state.filterConfig, ...config }
  })),
  clearFilters: () => set({ filterConfig: {} })
}));

// Modal Store
export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,
  modalData: null,
  
  openModal: (modalId, data = null) => set({ activeModal: modalId, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null })
}));

// Toast Store
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: crypto.randomUUID() }
      ]
    })),
  
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    })),
  
  clearToasts: () => set({ toasts: [] })
}));

// Hook for theme management with system preference support
export function useTheme() {
  const { theme, setTheme } = useUIStore();
  
  // Apply theme to document
  const applyTheme = React.useCallback((theme: 'light' | 'dark' | 'system') => {
    const root = window.document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
  }, []);
  
  // Listen for system theme changes
  const handleSystemThemeChange = React.useCallback(() => {
    if (theme === 'system') {
      applyTheme('system');
    }
  }, [theme, applyTheme]);
  
  // Apply theme on change
  React.useEffect(() => {
    applyTheme(theme);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [theme, applyTheme, handleSystemThemeChange]);
  
  return { theme, setTheme };
}

import React from 'react';
