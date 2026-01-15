// Authentication hooks for frontend
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';

// Auth state interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth hook result
interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

// Context type for auth provider
interface AuthContextValue extends UseAuthReturn {
  checkAuth: () => Promise<boolean>;
}

// Create auth context
const AuthContext = createContext<AuthContextValue | null>(null);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Login
  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await authApi.login(email, password);
    
    if (result.success && result.user) {
      setState({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return { success: true };
    }
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: result.error || 'Login failed'
    }));
    
    return { success: false, error: result.error };
  }, []);

  // Register
  const register = useCallback(async (email: string, password: string, name: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await authApi.register(email, password, name);
    
    if (result.success && result.user) {
      setState({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return { success: true };
    }
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: result.error || 'Registration failed'
    }));
    
    return { success: false, error: result.error };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    await authApi.logout();
    
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    const result = await authApi.getCurrentUser();
    
    if (result.success && result.user) {
      setState(prev => ({
        ...prev,
        user: result.user || prev.user,
        isLoading: false
      }));
    } else {
      // Token might be invalid, logout
      if (result.error) {
        await authApi.logout();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      }
    }
  }, [state.isAuthenticated]);

  // Check authentication on mount
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    const result = await authApi.getCurrentUser();
    
    if (result.success && result.user) {
      setState({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return true;
    }
    
    // Token invalid or expired
    localStorage.removeItem('auth_token');
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
    
    return false;
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    clearError,
    refreshUser,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): UseAuthReturn {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Hook for auth state only (without methods)
export function useAuthState(): AuthState {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  
  return {
    user: context.user,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading,
    error: context.error
  };
}

// Hook for requiring auth (returns user or null if not authenticated)
export function useRequireAuth(): User | null {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return null;
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  return user;
}

// Hook for auth callback (login/register)
export function useAuthCallback() {
  const { login, register, logout, isLoading, error, clearError } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLogin = useCallback(async (email: string, password: string) => {
    setIsProcessing(true);
    try {
      return await login(email, password);
    } finally {
      setIsProcessing(false);
    }
  }, [login]);

  const handleRegister = useCallback(async (email: string, password: string, name: string) => {
    setIsProcessing(true);
    try {
      return await register(email, password, name);
    } finally {
      setIsProcessing(false);
    }
  }, [register]);

  const handleLogout = useCallback(async () => {
    setIsProcessing(true);
    try {
      await logout();
    } finally {
      setIsProcessing(false);
    }
  }, [logout]);

  return {
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    clearError,
    isLoading: isLoading || isProcessing,
    error
  };
}
