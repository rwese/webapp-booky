/**
 * API Service
 * Handles all HTTP communication with the Booky backend API
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse, PaginatedResponse, Book, BookLookupResult } from '../types';
import { AuthTokens, LoginCredentials, RegisterData, User } from '../types';
import { StorageService } from './storage';
import { syncService } from './sync';

const API_BASE_URL = __DEV 
  ? 'http://localhost:3001/api' 
  : 'https://api.booky.app/api';

class ApiService {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<AuthTokens> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const tokens = await StorageService.getTokens();
        if (tokens?.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const tokens = await StorageService.getTokens();
            if (tokens?.refreshToken) {
              const newTokens = await this.refreshToken(tokens.refreshToken);
              
              // Update storage with new tokens
              await StorageService.saveTokens(newTokens);
              
              // Retry original request with new token
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              }
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed - force logout
            await StorageService.clearAuth();
            throw refreshError;
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  // =========================================================================
  // Authentication
  // =========================================================================

  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.client.post('/auth/login', credentials);
    return response.data;
  }

  async register(data: RegisterData): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await this.client.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      const tokens = await StorageService.getTokens();
      if (tokens?.accessToken) {
        await this.client.post('/auth/logout');
      }
    } finally {
      await StorageService.clearAuth();
    }
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.client.put('/auth/profile', data);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    const response = await this.client.put('/auth/password', { currentPassword, newPassword });
    return response.data;
  }

  // =========================================================================
  // Books
  // =========================================================================

  async getBooks(userId: string, page = 1, limit = 50): Promise<PaginatedResponse<Book>> {
    const response = await this.client.get(`/books`, {
      params: { userId, page, limit },
    });
    return response.data;
  }

  async getBook(bookId: string): Promise<ApiResponse<Book>> {
    const response = await this.client.get(`/books/${bookId}`);
    return response.data;
  }

  async createBook(userId: string, bookData: Partial<Book>): Promise<ApiResponse<Book>> {
    const response = await this.client.post('/books', { userId, ...bookData });
    
    // Queue sync operation
    await syncService.queueOperation('create', 'book', response.data.data.id, response.data.data);
    
    return response.data;
  }

  async updateBook(bookId: string, bookData: Partial<Book>): Promise<ApiResponse<Book>> {
    const response = await this.client.put(`/books/${bookId}`, bookData);
    
    // Queue sync operation
    await syncService.queueOperation('update', 'book', bookId, response.data.data);
    
    return response.data;
  }

  async deleteBook(bookId: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/books/${bookId}`);
    
    // Queue sync operation
    await syncService.queueOperation('delete', 'book', bookId, {});
    
    return response.data;
  }

  async searchBooks(query: string): Promise<ApiResponse<BookLookupResult[]>> {
    const response = await this.client.get('/search', { params: { q: query } });
    return response.data;
  }

  async lookupISBN(isbn: string): Promise<ApiResponse<BookLookupResult>> {
    const response = await this.client.get(`/lookup/${isbn}`);
    return response.data;
  }

  // =========================================================================
  // Ratings & Reviews
  // =========================================================================

  async getBookRatings(bookId: string): Promise<ApiResponse<import('../types').Rating[]>> {
    const response = await this.client.get(`/books/${bookId}/ratings`);
    return response.data;
  }

  async addRating(bookId: string, stars: number, review?: string): Promise<ApiResponse<import('../types').Rating>> {
    const response = await this.client.post(`/books/${bookId}/ratings`, { stars, review });
    await syncService.queueOperation('create', 'rating', response.data.data.id, response.data.data);
    return response.data;
  }

  async updateRating(ratingId: string, data: { stars?: number; review?: string }): Promise<ApiResponse<import('../types').Rating>> {
    const response = await this.client.put(`/ratings/${ratingId}`, data);
    await syncService.queueOperation('update', 'rating', ratingId, response.data.data);
    return response.data;
  }

  async deleteRating(ratingId: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/ratings/${ratingId}`);
    await syncService.queueOperation('delete', 'rating', ratingId, {});
    return response.data;
  }

  // =========================================================================
  // Tags & Collections
  // =========================================================================

  async getTags(): Promise<ApiResponse<import('../types').Tag[]>> {
    const response = await this.client.get('/tags');
    return response.data;
  }

  async createTag(name: string, color: string): Promise<ApiResponse<import('../types').Tag>> {
    const response = await this.client.post('/tags', { name, color });
    return response.data;
  }

  async deleteTag(tagId: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/tags/${tagId}`);
    return response.data;
  }

  async getCollections(): Promise<ApiResponse<import('../types').Collection[]>> {
    const response = await this.client.get('/collections');
    return response.data;
  }

  async createCollection(name: string, description?: string): Promise<ApiResponse<import('../types').Collection>> {
    const response = await this.client.post('/collections', { name, description });
    return response.data;
  }

  async addBookToCollection(collectionId: string, bookId: string): Promise<ApiResponse> {
    const response = await this.client.post(`/collections/${collectionId}/books`, { bookId });
    return response.data;
  }

  async removeBookFromCollection(collectionId: string, bookId: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/collections/${collectionId}/books/${bookId}`);
    return response.data;
  }

  // =========================================================================
  // Reading History
  // =========================================================================

  async getReadingLogs(bookId?: string): Promise<ApiResponse<ReadingLog[]>> {
    const params = bookId ? { bookId } : {};
    const response = await this.client.get('/reading-logs', { params });
    return response.data;
  }

  async updateReadingStatus(bookId: string, status: import('../types').ReadingStatus): Promise<ApiResponse<ReadingLog>> {
    const response = await this.client.put(`/books/${bookId}/status`, { status });
    await syncService.queueOperation('update', 'readingLog', response.data.data.id, response.data.data);
    return response.data;
  }

  async logReadingSession(bookId: string, startTime: string, endTime?: string, duration?: number): Promise<ApiResponse<ReadingSession>> {
    const response = await this.client.post(`/books/${bookId}/sessions`, { startTime, endTime, duration });
    return response.data;
  }

  // =========================================================================
  // Analytics
  // =========================================================================

  async getUserAnalytics(): Promise<ApiResponse<import('../types').BookAnalytics[]>> {
    const response = await this.client.get('/analytics');
    return response.data;
  }

  async getBookAnalytics(bookId: string): Promise<ApiResponse<import('../types').BookAnalytics>> {
    const response = await this.client.get(`/analytics/books/${bookId}`);
    return response.data;
  }

  // =========================================================================
  // File Storage
  // =========================================================================

  async uploadBookCover(bookId: string, imagePath: string): Promise<ApiResponse<{ coverUrl: string }>> {
    const formData = new FormData();
    
    // Handle different image types for React Native
    const imageUri = imagePath;
    const filename = imagePath.split('/').pop() || 'cover.jpg';
    const mimeType = 'image/jpeg';
    
    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: mimeType,
    } as any);
    
    const response = await this.client.post(`/files/covers/${bookId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  // =========================================================================
  // Sync
  // =========================================================================

  async getPendingChanges(since?: string): Promise<ApiResponse<SyncOperation[]>> {
    const params = since ? { since } : {};
    const response = await this.client.get('/sync/changes', { params });
    return response.data;
  }

  async pushChanges(operations: SyncOperation[]): Promise<ApiResponse<SyncOperation[]>> {
    const response = await this.client.post('/sync/push', { operations });
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Import ReadingLog and ReadingSession types for completeness
import { ReadingLog, ReadingSession, SyncOperation } from '../types';
