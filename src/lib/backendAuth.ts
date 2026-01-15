/**
 * Backend Authentication Service
 * 
 * Integrates React frontend with Booky backend JWT authentication.
 * Handles login, registration, token management, and session persistence.
 */

import type { User, AuthTokens, LoginCredentials, RegisterData, AuthState } from '../types';

// Backend API configuration
const BACKEND_API = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

// Token storage keys
const TOKEN_KEY = 'booky_auth_tokens';
const USER_KEY = 'booky_user';

// Token refresh threshold (refresh if token expires within 5 minutes)
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

/**
 * Backend Authentication API
 */
export class BackendAuthService {
  private tokens: AuthTokens | null = null;
  private user: User | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor() {
    // Load tokens and user from storage on initialization
    this.loadFromStorage();
  }

  /**
   * Load tokens and user from localStorage
   */
  private loadFromStorage(): void {
    try {
      const storedTokens = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedTokens) {
        this.tokens = JSON.parse(storedTokens);
      }
      if (storedUser) {
        this.user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('Failed to load auth state from storage:', error);
      this.clearStorage();
    }
  }

  /**
   * Save tokens and user to localStorage
   */
  private saveToStorage(): void {
    try {
      if (this.tokens) {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(this.tokens));
      }
      if (this.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(this.user));
      }
    } catch (error) {
      console.error('Failed to save auth state to storage:', error);
    }
  }

  /**
   * Clear storage
   */
  private clearStorage(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Check if tokens are expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= exp;
    } catch {
      return true; // If we can't parse, consider it expired
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.tokens || !this.user) return false;
    if (this.isTokenExpired(this.tokens.accessToken)) return false;
    return true;
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<{ success: boolean; user?: User; tokens?: AuthTokens; error?: string }> {
    try {
      const response = await fetch(`${BACKEND_API}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.message || result.error || 'Registration failed',
        };
      }

      // Store tokens and user
      this.tokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      };
      this.user = result.user;
      this.saveToStorage();

      return {
        success: true,
        user: result.user,
        tokens: this.tokens,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during registration',
      };
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User; tokens?: AuthTokens; error?: string }> {
    try {
      const response = await fetch(`${BACKEND_API}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.message || result.error || 'Login failed',
        };
      }

      // Store tokens and user
      this.tokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      };
      this.user = result.user;
      this.saveToStorage();

      return {
        success: true,
        user: result.user,
        tokens: this.tokens,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during login',
      };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Try to logout on backend (fire and forget)
      if (this.tokens?.accessToken) {
        fetch(`${BACKEND_API}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.tokens.accessToken}`,
          },
        }).catch(() => {
          // Ignore errors during logout
        });
      }
    } finally {
      // Clear local state regardless of backend response
      this.tokens = null;
      this.user = null;
      this.clearStorage();
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise.then(() => true).catch(() => false);
    }

    if (!this.tokens?.refreshToken) {
      return false;
    }

    // Check if we should refresh
    if (this.tokens.accessToken && !this.isTokenExpired(this.tokens.accessToken)) {
      const payload = JSON.parse(atob(this.tokens.accessToken.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      if (expiresAt - Date.now() > TOKEN_REFRESH_THRESHOLD) {
        return true; // Token is still valid for a while
      }
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${BACKEND_API}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: this.tokens?.refreshToken }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Token refresh failed');
        }

        // Update tokens
        this.tokens = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken || this.tokens?.refreshToken || '',
          expiresIn: result.expiresIn,
        };
        this.saveToStorage();

        return this.tokens;
      } catch (error) {
        console.error('Token refresh error:', error);
        // Force logout on refresh failure
        await this.logout();
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise.then(() => true).catch(() => false);
  }

  /**
   * Make authenticated API request with automatic token refresh
   */
  async authenticatedFetch<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure we have a valid token
    if (!this.isAuthenticated()) {
      // Try to refresh if we have a refresh token
      if (this.tokens?.refreshToken) {
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          throw new Error('Authentication required');
        }
      } else {
        throw new Error('Authentication required');
      }
    }

    // Prepare headers
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.tokens!.accessToken}`);
    headers.set('Content-Type', 'application/json');

    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 - Unauthorized
    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry with new token
        headers.set('Authorization', `Bearer ${this.tokens!.accessToken}`);
        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });

        if (!retryResponse.ok) {
          throw new Error(`Request failed: ${retryResponse.statusText}`);
        }

        return retryResponse.json();
      } else {
        throw new Error('Authentication required');
      }
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Request failed: ${error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: this.isAuthenticated(),
      user: this.user,
      accessToken: this.tokens?.accessToken || null,
      isLoading: false,
      error: null,
    };
  }
}

// Export singleton instance
export const authService = new BackendAuthService();

/**
 * Helper function to create authenticated request headers
 */
export function createAuthHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) return {};
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Helper function for API requests
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_API}${endpoint}`;
  return authService.authenticatedFetch<T>(url, options);
}
