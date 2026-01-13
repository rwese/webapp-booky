/**
 * Auth Context Provider
 * 
 * Provides authentication state and methods to the React component tree.
 * Works with NextAuth.js for OAuth authentication.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from 'next-auth';

// Auth context type definition
interface AuthContextType {
  // Session state
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // User state
  user: User | null;
  
  // Auth methods
  signIn: (provider?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  
  // Error handling
  error: string | null;
  
  // Session management
  updateSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: React.ReactNode;
  basePath?: string;
}

export function AuthProvider({ children, basePath = '/api/auth' }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Fetch session from NextAuth API
        const response = await fetch(`${basePath}/session`);
        if (response.ok) {
          const sessionData = await response.json();
          setSession(sessionData);
        }
      } catch (err) {
        console.error('Failed to fetch session:', err);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [basePath]);

  // Listen for auth events
  useEffect(() => {
    // Listen for session changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nextauth.message' && e.newValue) {
        try {
          const event = JSON.parse(e.newValue);
          if (event.event === 'session' || event.event === 'signout') {
            setSession(null);
          }
        } catch (err) {
          console.error('Failed to parse auth event:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sign in with OAuth provider
  const signIn = useCallback(async (provider?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${basePath}/signin/${provider || 'google'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sign in failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  // Sign out
  const signOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${basePath}/signout`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sign out failed');
      }
      
      setSession(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  // Sign up with credentials
  const signUp = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${basePath}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sign up failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  // Update session
  const updateSession = useCallback(async () => {
    try {
      const response = await fetch(`${basePath}/session`);
      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
      }
    } catch (err) {
      console.error('Failed to update session:', err);
    }
  }, [basePath]);

  // Computed values
  const isAuthenticated = !!session?.user;
  const user = session?.user || null;

  const value: AuthContextType = {
    session,
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
    signUp,
    error,
    updateSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use auth context
 * 
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Custom hook to require authentication
 * Redirects to sign in if not authenticated
 */
export function useRequiredAuth(): AuthContextType {
  const auth = useAuth();
  const [needsRedirect, setNeedsRedirect] = React.useState(false);

  React.useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      setNeedsRedirect(true);
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  React.useEffect(() => {
    if (needsRedirect && typeof window !== 'undefined') {
      // Simple redirect - can be enhanced with proper router
      window.location.href = '/auth/signin';
    }
  }, [needsRedirect]);

  return auth;
}

/**
 * Custom hook to get current user
 */
export function useUser(): User | null {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return null;
  }
  
  return isAuthenticated ? user : null;
}

export default AuthProvider;
