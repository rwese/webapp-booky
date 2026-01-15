/**
 * Authentication Service
 * Handles user authentication including biometric authentication
 */

import ReactNativeBiometrics from 'react-native-biometrics';
import { apiService } from './api';
import { StorageService } from './storage';
import { AuthState, AuthTokens, User, LoginCredentials, RegisterData } from '../types';

const BIOMETRIC_KEY = 'booky_biometric_enabled';

class AuthService {
  private rnBiometrics: ReactNativeBiometrics;

  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics();
  }

  // =========================================================================
  // Biometric Authentication
  // =========================================================================

  async checkBiometricAvailability(): Promise<{
    available: boolean;
    biometryType: 'FaceID' | 'TouchID' | 'none';
  }> {
    try {
      const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
      
      return {
        available,
        biometryType: biometryType as 'FaceID' | 'TouchID' | 'none',
      };
    } catch (error) {
      console.error('Biometric check failed:', error);
      return { available: false, biometryType: 'none' };
    }
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      const result = await this.rnBiometrics.simplePrompt({
        promptMessage: 'Authenticate to access Booky',
        cancelButtonText: 'Cancel',
      });

      if (result.success) {
        // Verify tokens are still valid
        const tokens = await StorageService.getTokens();
        if (tokens) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  async enableBiometric(): Promise<boolean> {
    const { available } = await this.checkBiometricAvailability();
    
    if (!available) {
      return false;
    }

    // Generate a challenge and store it
    const challenge = await this.rnBiometrics.createSignature({
      promptMessage: 'Enable biometric authentication',
      cancelButtonText: 'Cancel',
    });

    if (challenge.success) {
      await StorageService.setSetting(BIOMETRIC_KEY, true);
      return true;
    }

    return false;
  }

  async disableBiometric(): Promise<void> {
    await StorageService.setSetting(BIOMETRIC_KEY, false);
  }

  async isBiometricEnabled(): Promise<boolean> {
    return StorageService.getSetting(BIOMETRIC_KEY, false);
  }

  // =========================================================================
  // Email/Password Authentication
  // =========================================================================

  async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await apiService.login(credentials);
      
      if (result.success && result.data) {
        const { user, tokens } = result.data;
        
        // Save tokens and user
        await StorageService.saveTokens(tokens);
        await StorageService.saveUser(user);
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error during login' 
      };
    }
  }

  async register(data: RegisterData): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await apiService.register(data);
      
      if (result.success && result.data) {
        const { user, tokens } = result.data;
        
        // Save tokens and user
        await StorageService.saveTokens(tokens);
        await StorageService.saveUser(user);
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error during registration' 
      };
    }
  }

  // =========================================================================
  // Session Management
  // =========================================================================

  async getAuthState(): Promise<AuthState> {
    try {
      const tokens = await StorageService.getTokens();
      const user = await StorageService.getUser();
      const useBiometric = await this.isBiometricEnabled();

      if (!tokens || !user) {
        return {
          isAuthenticated: false,
          user: null,
          accessToken: null,
          isLoading: false,
          error: null,
          needsBiometricSetup: false,
          useBiometric: false,
        };
      }

      // Check if token is expired
      if (this.isTokenExpired(tokens.accessToken)) {
        // Try to refresh
        try {
          const newTokens = await apiService.refreshToken(tokens.refreshToken);
          await StorageService.saveTokens(newTokens);
          
          return {
            isAuthenticated: true,
            user,
            accessToken: newTokens.accessToken,
            isLoading: false,
            error: null,
            needsBiometricSetup: false,
            useBiometric,
          };
        } catch {
          // Refresh failed, clear auth
          await this.logout();
          return {
            isAuthenticated: false,
            user: null,
            accessToken: null,
            isLoading: false,
            error: null,
            needsBiometricSetup: false,
            useBiometric: false,
          };
        }
      }

      return {
        isAuthenticated: true,
        user,
        accessToken: tokens.accessToken,
        isLoading: false,
        error: null,
        needsBiometricSetup: false,
        useBiometric,
      };
    } catch (error) {
      console.error('Failed to get auth state:', error);
      return {
        isAuthenticated: false,
        user: null,
        accessToken: null,
        isLoading: false,
        error: null,
        needsBiometricSetup: false,
        useBiometric: false,
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API response
      await StorageService.clearAuth();
    }
  }

  // =========================================================================
  // Token Helpers
  // =========================================================================

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() >= exp;
    } catch {
      return true;
    }
  }

  async getAccessToken(): Promise<string | null> {
    const tokens = await StorageService.getTokens();
    return tokens?.accessToken || null;
  }

  async getCurrentUser(): Promise<User | null> {
    return StorageService.getUser();
  }

  // =========================================================================
  // Profile Management
  // =========================================================================

  async updateProfile(data: Partial<User>): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await apiService.updateProfile(data);
      
      if (result.success && result.data) {
        await StorageService.saveUser(result.data);
        return { success: true };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update profile' 
      };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await apiService.changePassword(currentPassword, newPassword);
      
      if (result.success) {
        return { success: true };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to change password' 
      };
    }
  }

  // =========================================================================
  // Quick Actions
  // =========================================================================

  /**
   * Attempt to authenticate with biometrics if enabled,
   * otherwise use stored session
   */
  async quickAuth(): Promise<boolean> {
    const biometricEnabled = await this.isBiometricEnabled();
    
    if (biometricEnabled) {
      return this.authenticateWithBiometrics();
    }
    
    // Just check if we have a valid session
    const state = await this.getAuthState();
    return state.isAuthenticated;
  }
}

export const authService = new AuthService();
