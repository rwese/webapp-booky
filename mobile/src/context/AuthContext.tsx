/**
 * Auth Context
 * React context for managing authentication state in the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../services/auth';
import { AuthState, User, LoginCredentials, RegisterData } from '../types';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  isBiometricEnabled: () => Promise<boolean>;
  checkBiometricAvailability: () => Promise<{ available: boolean; biometryType: 'FaceID' | 'TouchID' | 'none' }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    isLoading: true,
    error: null,
    needsBiometricSetup: false,
    useBiometric: false,
  });

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const authState = await authService.getAuthState();
        setState(authState);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, []);

  // Login
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const result = await authService.login(credentials);

    if (result.success) {
      const updatedState = await authService.getAuthState();
      setState(updatedState);
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

  // Register
  const register = useCallback(async (data: RegisterData) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const result = await authService.register(data);

    if (result.success) {
      const updatedState = await authService.getAuthState();
      setState(updatedState);
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

  // Logout
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await authService.logout();
    setState({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
      needsBiometricSetup: false,
      useBiometric: false,
    });
  }, []);

  // Refresh user
  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setState(prev => ({ ...prev, user }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [state.isAuthenticated]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Biometric helpers
  const enableBiometric = useCallback(async () => {
    return authService.enableBiometric();
  }, []);

  const disableBiometric = useCallback(async () => {
    await authService.disableBiometric();
    setState(prev => ({ ...prev, useBiometric: false }));
  }, []);

  const isBiometricEnabled = useCallback(async () => {
    return authService.isBiometricEnabled();
  }, []);

  const checkBiometricAvailability = useCallback(async () => {
    return authService.checkBiometricAvailability();
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
      enableBiometric,
      disableBiometric,
      isBiometricEnabled,
      checkBiometricAvailability,
    }),
    [state, login, register, logout, refreshUser, clearError]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export default AuthContext;
