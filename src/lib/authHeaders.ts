/**
 * Auth Header Injection Service
 * 
 * Adds user identity headers to outgoing API requests.
 * Extracts user info from OAuth session and injects into headers.
 */

import type { Session } from 'next-auth';

// Header names for user identity
export const AUTH_HEADERS = {
  USER_ID: 'x-user-id',
  USER_EMAIL: 'x-user-email',
  USER_NAME: 'x-user-name',
  AUTHORIZATION: 'authorization',
  ACCESS_TOKEN: 'x-access-token',
} as const;

// Sanitize header values to prevent header injection attacks
export function sanitizeHeaderValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  
  // Remove any newline characters
  return value.replace(/[\r\n]/g, '');
}

// Validate header name to prevent response splitting
export function isValidHeaderName(name: string): boolean {
  // Header names should only contain safe characters
  const validHeaderPattern = /^[a-zA-Z0-9\-._~]+$/;
  return validHeaderPattern.test(name);
}

// Create auth headers from session
export function createAuthHeaders(session: Session | null): Record<string, string> {
  if (!session?.user) {
    return {};
  }

  const headers: Record<string, string> = {};

  // User ID header
  if (session.user.id) {
    const sanitizedId = sanitizeHeaderValue(session.user.id);
    if (sanitizedId) {
      headers[AUTH_HEADERS.USER_ID] = sanitizedId;
    }
  }

  // User email header
  if (session.user.email) {
    const sanitizedEmail = sanitizeHeaderValue(session.user.email);
    if (sanitizedEmail) {
      headers[AUTH_HEADERS.USER_EMAIL] = sanitizedEmail;
    }
  }

  // User name header
  if (session.user.name) {
    const sanitizedName = sanitizeHeaderValue(session.user.name);
    if (sanitizedName) {
      headers[AUTH_HEADERS.USER_NAME] = sanitizedName;
    }
  }

  // Access token header
  if (session.accessToken) {
    const sanitizedToken = sanitizeHeaderValue(session.accessToken);
    if (sanitizedToken) {
      headers[AUTH_HEADERS.ACCESS_TOKEN] = sanitizedToken;
    }
  }

  return headers;
}

// Request interceptor function type
export type RequestInterceptor = (config: RequestInit) => RequestInit;

// Create a request interceptor that adds auth headers
export function createAuthInterceptor(session: Session | null): RequestInterceptor {
  return (config: RequestInit): RequestInit => {
    const authHeaders = createAuthHeaders(session);
    
    // Clone headers from config
    const existingHeaders = config.headers || {};
    const headers = new Headers(existingHeaders);
    
    // Add auth headers
    for (const [key, value] of Object.entries(authHeaders)) {
      if (isValidHeaderName(key)) {
        headers.set(key, value);
      }
    }

    return {
      ...config,
      headers,
    };
  };
}

/**
 * Authenticated Fetch Wrapper
 * 
 * Makes authenticated API requests with user headers injected.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
  session: Session | null
): Promise<Response> {
  const interceptor = createAuthInterceptor(session);
  const interceptedOptions = interceptor(options);
  
  return fetch(url, interceptedOptions);
}

/**
 * API Client with Auth Headers
 * 
 * Provides methods for making authenticated API requests.
 */
export class AuthenticatedApiClient {
  private baseUrl: string;
  private session: Session | null;

  constructor(baseUrl: string, session: Session | null) {
    this.baseUrl = baseUrl;
    this.session = session;
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    const response = await authFetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
    }, this.session);
    
    if (!response.ok) {
      throw new Error(`GET ${endpoint} failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  // POST request
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await authFetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    }, this.session);
    
    if (!response.ok) {
      throw new Error(`POST ${endpoint} failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  // PUT request
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await authFetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    }, this.session);
    
    if (!response.ok) {
      throw new Error(`PUT ${endpoint} failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<T> {
    const response = await authFetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
    }, this.session);
    
    if (!response.ok) {
      throw new Error(`DELETE ${endpoint} failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Update session
  setSession(session: Session | null): void {
    this.session = session;
  }
}

/**
 * Create authenticated API client
 */
export function createAuthApiClient(
  baseUrl: string,
  session: Session | null
): AuthenticatedApiClient {
  return new AuthenticatedApiClient(baseUrl, session);
}

/**
 * Axios interceptor factory (for axios-based requests)
 */
export function createAxiosAuthInterceptor(session: Session | null) {
  return {
    request: (config: { headers: Record<string, string> }) => {
      const authHeaders = createAuthHeaders(session);
      
      return {
        ...config,
        headers: {
          ...config.headers,
          ...authHeaders,
        },
      };
    },
  };
}

export default {
  createAuthHeaders,
  createAuthInterceptor,
  authFetch,
  AuthenticatedApiClient,
  createAuthApiClient,
  AUTH_HEADERS,
};
