/**
 * useAuthHeaders Hook
 * 
 * React hook for accessing authenticated user headers.
 * Provides easy access to user identity headers for API requests.
 */

import { useMemo } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { createAuthHeaders, AUTH_HEADERS, createAuthInterceptor, type RequestInterceptor } from '../lib/authHeaders';

/**
 * Hook result type
 */
interface UseAuthHeadersResult {
  // Header values
  userId: string | undefined;
  userEmail: string | undefined;
  userName: string | undefined;
  accessToken: string | undefined;
  
  // All headers as an object
  headers: Record<string, string>;
  
  // Request interceptor
  createInterceptor: () => RequestInterceptor;
  
  // Helper to add headers to fetch options
  addToFetchOptions: (options: RequestInit) => RequestInit;
}

/**
 * Hook to access authenticated user headers
 * 
 * @returns Object containing user identity headers and helper methods
 */
export function useAuthHeaders(): UseAuthHeadersResult {
  const { session, isAuthenticated, isLoading } = useAuth();

  const result = useMemo(() => {
    // Return empty values if not authenticated
    if (!isAuthenticated || !session?.user || isLoading) {
      return {
        userId: undefined,
        userEmail: undefined,
        userName: undefined,
        accessToken: undefined,
        headers: {},
        createInterceptor: () => (config: RequestInit) => config,
        addToFetchOptions: (options: RequestInit) => options,
      };
    }

    const headers = createAuthHeaders(session);

    return {
      userId: headers[AUTH_HEADERS.USER_ID],
      userEmail: headers[AUTH_HEADERS.USER_EMAIL],
      userName: headers[AUTH_HEADERS.USER_NAME],
      accessToken: headers[AUTH_HEADERS.ACCESS_TOKEN],
      headers,
      createInterceptor: () => createAuthInterceptor(session),
      addToFetchOptions: (options: RequestInit) => {
        const interceptor = createAuthInterceptor(session);
        return interceptor(options);
      },
    };
  }, [session, isAuthenticated, isLoading]);

  return result;
}

/**
 * Hook to get a specific auth header value
 * 
 * @param headerName - The header to retrieve
 * @returns The header value or undefined
 */
export function useAuthHeader(headerName: keyof typeof AUTH_HEADERS): string | undefined {
  const { headers } = useAuthHeaders();
  return headers[headerName];
}

/**
 * Hook for authenticated API calls
 * 
 * Provides methods for making authenticated requests.
 */
export function useAuthApi() {
  const { session, isAuthenticated } = useAuth();
  const { addToFetchOptions } = useAuthHeaders();

  const api = useMemo(() => {
    if (!isAuthenticated || !session) {
      return null;
    }

    return {
      fetch: async (url: string, options?: RequestInit) => {
        const modifiedOptions = options 
          ? addToFetchOptions(options) 
          : addToFetchOptions({});
        
        return fetch(url, modifiedOptions);
      },
      
      getHeaders: () => createAuthHeaders(session),
    };
  }, [session, isAuthenticated, addToFetchOptions]);

  return api;
}

/**
 * Hook to check if user has specific permission
 * 
 * @param permission - Permission to check
 * @returns Whether user has the permission
 */
export function useHasPermission(_permission: string): boolean {
  const { session, isAuthenticated } = useAuth();

  // For now, any authenticated user has all permissions
  // This can be extended with role-based permissions
  if (!isAuthenticated || !session) {
    return false;
  }

  // Admin users have all permissions
  if (session.user.email?.includes('admin')) {
    return true;
  }

  // Add custom permission logic here
  return true;
}

export default useAuthHeaders;
