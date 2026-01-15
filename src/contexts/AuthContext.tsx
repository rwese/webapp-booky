/**
 * Authentication Context
 * 
 * React context for managing authentication state across the application.
 * Provides authentication state and methods to all components.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../lib/backendAuth';
import type { User, AuthState, LoginCredentials, RegisterData } from '../types';

// Create context
interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth Provider Component
 * 
 * Wraps the application and provides authentication context.
 * Handles automatic token refresh and session persistence.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    isLoading: true,
    error: null,
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Load stored auth state
        const isAuthenticated = authService.isAuthenticated();
        const user = authService.getUser();
        const accessToken = authService.getAccessToken();

        if (isAuthenticated && user) {
          // Verify token is still valid
          if (accessToken) {
            setState({
              isAuthenticated: true,
              user,
              accessToken,
              isLoading: false,
              error: null,
            });
          } else {
            // Try to refresh token
            const refreshed = await authService.refreshToken();
            if (refreshed) {
              setState({
                isAuthenticated: true,
                user: authService.getUser(),
                accessToken: authService.getAccessToken(),
                isLoading: false,
                error: null,
              });
            } else {
              // Token refresh failed, clear auth state
              setState({
                isAuthenticated: false,
                user: null,
                accessToken: null,
                isLoading: false,
                error: null,
              });
            }
          }
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          isLoading: false,
          error: null,
        });
      }
    };

    initializeAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!state.isAuthenticated) return;

    // Refresh token every 15 minutes
    const refreshInterval = setInterval(async () => {
      await authService.refreshToken();
    }, 15 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [state.isAuthenticated]);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const result = await authService.login(credentials);

    if (result.success && result.user && result.tokens) {
      setState({
        isAuthenticated: true,
        user: result.user,
        accessToken: result.tokens.accessToken,
        isLoading: false,
        error: null,
      });
      return { success: true };
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: result.error || 'Login failed',
      }));
      return { success: false, error: result.error };
    }
  }, []);

  // Register function
  const register = useCallback(async (data: RegisterData) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const result = await authService.register(data);

    if (result.success && result.user && result.tokens) {
      setState({
        isAuthenticated: true,
        user: result.user,
        accessToken: result.tokens.accessToken,
        isLoading: false,
        error: null,
      });
      return { success: true };
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: result.error || 'Registration failed',
      }));
      return { success: false, error: result.error };
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await authService.logout();
    setState({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const user = await authService.authenticatedFetch<User>('/auth/me');
      setState(prev => ({ ...prev, user }));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [state.isAuthenticated]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Memoize context value
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      refreshUser,
      clearError,
    }),
    [state, login, register, logout, refreshUser, clearError]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use authentication context
 * 
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Custom hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Custom hook to get current user
 */
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Custom hook for protected routes
 * 
 * Returns auth loading state and handles redirects
 */
export function useProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  return {
    isLoading,
    isAuthenticated: isAuthenticated && !isLoading,
    shouldRedirect: !isAuthenticated && !isLoading,
  };
}

export default AuthContext;
