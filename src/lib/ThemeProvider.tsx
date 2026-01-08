import React, { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';
import { useUIStore } from './useStore';
import type { ThemeMode } from '../types';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  systemTheme: 'light' | 'dark' | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, setTheme } = useUIStore();
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark' | null>(null);

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      setSystemTheme(newSystemTheme);
      
      if (theme === 'system') {
        setResolvedTheme(newSystemTheme);
      }
    };

    // Initial detection
    const initialTheme = mediaQuery.matches ? 'dark' : 'light';
    setSystemTheme(initialTheme);
    if (theme === 'system') {
      setResolvedTheme(initialTheme);
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Resolve theme based on preference
  useEffect(() => {
    if (theme === 'system') {
      setResolvedTheme(systemTheme || 'light');
    } else {
      setResolvedTheme(theme);
    }
  }, [theme, systemTheme]);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    // Add resolved theme class
    root.classList.add(resolvedTheme);
    
    // Set theme color for status bar
    const themeColor = resolvedTheme === 'dark' ? '#1f2937' : '#ffffff';
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
  }, [resolvedTheme]);

  const toggleTheme = useCallback(() => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  }, [theme, setTheme]);

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    systemTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to get theme-aware colors
export function useThemeColors() {
  const { resolvedTheme } = useThemeContext();
  
  return {
    background: resolvedTheme === 'dark' ? 'bg-gray-900' : 'bg-gray-50',
    surface: resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-white',
    surfaceHover: resolvedTheme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
    text: resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900',
    textSecondary: resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600',
    border: resolvedTheme === 'dark' ? 'border-gray-700' : 'border-gray-200',
    primary: resolvedTheme === 'dark' ? 'bg-primary-600' : 'bg-primary-600',
  };
}
