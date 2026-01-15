// API Service Layer - Centralized backend communication
import type { Book, User, UserSettings, Collection, Tag, ReadingLog, Rating, SyncOperation } from '../types';

// Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_VERSION = 'v1';

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; statusCode?: number }> {
  const url = `${API_BASE}/api/${API_VERSION}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers
      }
    });

    const contentType = response.headers.get('content-type');
    
    if (!response.ok) {
      // Handle specific error responses
      if (contentType?.includes('application/json')) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return { 
          success: false, 
          error: errorData.error || `HTTP ${response.status}`, 
          statusCode: response.status 
        };
      }
      
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status 
      };
    }

    // Handle empty responses
    if (response.status === 204) {
      return { success: true, data: undefined as T };
    }

    // Parse JSON response
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return { success: true, data };
    }

    return { success: true, data: undefined as T };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    console.error(`API Error [${endpoint}]:`, error);
    return { success: false, error: errorMessage };
  }
}

// ==================== Authentication API ====================

export const authApi = {
  // Register new user
  async register(email: string, password: string, name: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    const result = await apiFetch<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });

    if (result.success && result.data && result.data.token) {
      localStorage.setItem('auth_token', result.data.token);
      return { success: true, token: result.data.token, user: result.data.user };
    }
    
    return { success: false, error: result.error || 'Registration failed' };
  },

  // Login user
  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    const result = await apiFetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (result.success && result.data && result.data.token) {
      localStorage.setItem('auth_token', result.data.token);
      return { success: true, token: result.data.token, user: result.data.user };
    }
    
    return { success: false, error: result.error || 'Login failed' };
  },

  // Logout user
  async logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' });
    localStorage.removeItem('auth_token');
  },

  // Get current user
  async getCurrentUser(): Promise<{ success: boolean; user?: User; error?: string }> {
    const result = await apiFetch<User>('/auth/me');
    return { success: result.success, user: result.data, error: result.error };
  },

  // Refresh token
  async refreshToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    const result = await apiFetch<{ token: string }>('/auth/refresh', {
      method: 'POST'
    });

    if (result.success && result.data?.token) {
      localStorage.setItem('auth_token', result.data.token);
      return { success: true, token: result.data.token };
    }

    return { success: false, error: result.error || 'Token refresh failed' };
  },

  // Request password reset
  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  // Reset password with token
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  }
};

// ==================== Books API ====================

export const booksApi = {
  // Get all books (with pagination and filters)
  async getAll(params?: { 
    limit?: number; 
    offset?: number; 
    search?: string;
    tags?: string[];
    collections?: string[];
    format?: string;
  }): Promise<{ success: boolean; books?: Book[]; total?: number; error?: string }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tags?.length) searchParams.set('tags', params.tags.join(','));
    if (params?.collections?.length) searchParams.set('collections', params.collections.join(','));
    if (params?.format) searchParams.set('format', params.format);

    const query = searchParams.toString();
    return apiFetch<Book[]>(`/books${query ? `?${query}` : ''}`);
  },

  // Get single book
  async getById(id: string): Promise<{ success: boolean; book?: Book; error?: string }> {
    return apiFetch<Book>(`/books/${id}`);
  },

  // Create book
  async create(book: Omit<Book, 'id' | 'addedAt' | 'needsSync' | 'localOnly'>): Promise<{ success: boolean; book?: Book; error?: string }> {
    return apiFetch<Book>('/books', {
      method: 'POST',
      body: JSON.stringify(book)
    });
  },

  // Update book
  async update(id: string, changes: Partial<Book>): Promise<{ success: boolean; book?: Book; error?: string }> {
    return apiFetch<Book>(`/books/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    });
  },

  // Delete book
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/books/${id}`, { method: 'DELETE' });
  },

  // Get book by ISBN
  async getByIsbn(isbn: string): Promise<{ success: boolean; book?: Book; error?: string }> {
    return apiFetch<Book>(`/books/isbn/${isbn}`);
  },

  // Batch import books
  async importBooks(books: Array<Omit<Book, 'id' | 'addedAt' | 'needsSync' | 'localOnly'>>): Promise<{
    success: boolean; imported?: number; errors?: Array<{ index: number; error: string }>; error?: string
  }> {
    return apiFetch('/books/import', {
      method: 'POST',
      body: JSON.stringify({ books })
    });
  },

  // Export all books
  async export(): Promise<{ success: boolean; books?: Book[]; error?: string }> {
    return apiFetch<Book[]>('/books/export');
  }
};

// ==================== Collections API ====================

export const collectionsApi = {
  async getAll(): Promise<{ success: boolean; collections?: Collection[]; error?: string }> {
    return apiFetch<Collection[]>('/collections');
  },

  async getById(id: string): Promise<{ success: boolean; collection?: Collection; error?: string }> {
    return apiFetch<Collection>(`/collections/${id}`);
  },

  async create(collection: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; collection?: Collection; error?: string }> {
    return apiFetch<Collection>('/collections', {
      method: 'POST',
      body: JSON.stringify(collection)
    });
  },

  async update(id: string, changes: Partial<Collection>): Promise<{ success: boolean; collection?: Collection; error?: string }> {
    return apiFetch<Collection>(`/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    });
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/collections/${id}`, { method: 'DELETE' });
  },

  async addBook(collectionId: string, bookId: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/collections/${collectionId}/books/${bookId}`, { method: 'POST' });
  },

  async removeBook(collectionId: string, bookId: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/collections/${collectionId}/books/${bookId}`, { method: 'DELETE' });
  },

  async reorderBooks(collectionId: string, bookIds: string[]): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/collections/${collectionId}/books/reorder`, {
      method: 'POST',
      body: JSON.stringify({ bookIds })
    });
  }
};

// ==================== Tags API ====================

export const tagsApi = {
  async getAll(): Promise<{ success: boolean; tags?: Tag[]; error?: string }> {
    return apiFetch<Tag[]>('/tags');
  },

  async create(tag: Omit<Tag, 'id' | 'createdAt'>): Promise<{ success: boolean; tag?: Tag; error?: string }> {
    return apiFetch<Tag>('/tags', {
      method: 'POST',
      body: JSON.stringify(tag)
    });
  },

  async update(id: string, changes: Partial<Tag>): Promise<{ success: boolean; tag?: Tag; error?: string }> {
    return apiFetch<Tag>(`/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    });
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/tags/${id}`, { method: 'DELETE' });
  },

  async addToBook(bookId: string, tagId: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/tags/${tagId}/books/${bookId}`, { method: 'POST' });
  },

  async removeFromBook(bookId: string, tagId: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/tags/${tagId}/books/${bookId}`, { method: 'DELETE' });
  }
};

// ==================== Reading Logs API ====================

export const readingLogsApi = {
  async getByBookId(bookId: string): Promise<{ success: boolean; log?: ReadingLog; error?: string }> {
    return apiFetch<ReadingLog>(`/reading-logs/${bookId}`);
  },

  async getAll(): Promise<{ success: boolean; logs?: ReadingLog[]; error?: string }> {
    return apiFetch<ReadingLog[]>('/reading-logs');
  },

  async upsert(log: Omit<ReadingLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; log?: ReadingLog; error?: string }> {
    return apiFetch<ReadingLog>('/reading-logs', {
      method: 'POST',
      body: JSON.stringify(log)
    });
  },

  async updateStatus(bookId: string, status: ReadingLog['status']): Promise<{ success: boolean; log?: ReadingLog; error?: string }> {
    return apiFetch<ReadingLog>(`/reading-logs/${bookId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async delete(bookId: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/reading-logs/${bookId}`, { method: 'DELETE' });
  }
};

// ==================== Ratings API ====================

export const ratingsApi = {
  async getByBookId(bookId: string): Promise<{ success: boolean; rating?: Rating; error?: string }> {
    return apiFetch<Rating>(`/ratings/${bookId}`);
  },

  async upsert(rating: Omit<Rating, 'id' | 'updatedAt'>): Promise<{ success: boolean; rating?: Rating; error?: string }> {
    return apiFetch<Rating>('/ratings', {
      method: 'POST',
      body: JSON.stringify(rating)
    });
  },

  async delete(bookId: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch(`/ratings/${bookId}`, { method: 'DELETE' });
  }
};

// ==================== Settings API ====================

export const settingsApi = {
  async get(): Promise<{ success: boolean; settings?: UserSettings; error?: string }> {
    return apiFetch<UserSettings>('/settings');
  },

  async update(settings: Partial<UserSettings>): Promise<{ success: boolean; settings?: UserSettings; error?: string }> {
    return apiFetch<UserSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  }
};

// ==================== Sync API ====================

export const syncApi = {
  // Get sync status
  async getStatus(): Promise<{
    success: boolean; status?: {
      isOnline: boolean;
      lastSyncTime: string | null;
      pendingOperations: number;
      isSyncing: boolean;
      syncError: string | null;
    }; error?: string
  }> {
    const result = await apiFetch<{
      isOnline: boolean;
      lastSyncTime: string | null;
      pendingOperations: number;
      isSyncing: boolean;
      syncError: string | null;
    }>('/sync/status');
    
    // Map 'data' to 'status' for this specific endpoint
    return {
      success: result.success,
      status: result.data,
      error: result.error
    };
  },

  // Sync operations
  async syncOperations(operations: Omit<SyncOperation, 'id' | 'timestamp' | 'synced'>[]): Promise<{
    success: boolean; results?: Array<{ id: string; status: string; error?: string }>; error?: string
  }> {
    return apiFetch('/sync/operations', {
      method: 'POST',
      body: JSON.stringify({ operations })
    });
  },

  // Full sync (replace all data)
  async fullSync(data: {
    books: Book[];
    collections: Collection[];
    tags: Tag[];
    readings: ReadingLog[];
  }): Promise<{ success: boolean; syncedAt?: string; error?: string }> {
    const result = await apiFetch<{ syncedAt: string }>('/sync/full', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    // Map 'data' to 'syncedAt' for this specific endpoint
    return {
      success: result.success,
      syncedAt: result.data?.syncedAt,
      error: result.error
    };
  },

  // Get server timestamp for conflict resolution
  async getTimestamp(): Promise<{ success: boolean; timestamp?: string; error?: string }> {
    return apiFetch('/sync/timestamp');
  },

  // Pull changes since last sync
  async pullChanges(since: string): Promise<{
    success: boolean; changes?: {
      books?: Book[];
      collections?: Collection[];
      tags?: Tag[];
      readings?: ReadingLog[];
      deletedBookIds?: string[];
      deletedCollectionIds?: string[];
      deletedTagIds?: string[];
      deletedReadingLogIds?: string[];
    }; error?: string
  }> {
    const result = await apiFetch<{
      books?: Book[];
      collections?: Collection[];
      tags?: Tag[];
      readings?: ReadingLog[];
      deletedBookIds?: string[];
      deletedCollectionIds?: string[];
      deletedTagIds?: string[];
      deletedReadingLogIds?: string[];
    }>(`/sync/pull?since=${encodeURIComponent(since)}`);
    
    // Map 'data' to 'changes' for this specific endpoint
    return {
      success: result.success,
      changes: result.data,
      error: result.error
    };
  }
};

// ==================== File Storage API ====================

export const fileApi = {
  // Upload cover image
  async uploadCover(bookId: string, file: Blob): Promise<{
    success: boolean; url?: string; error?: string
  }> {
    const formData = new FormData();
    formData.append('cover', file);
    formData.append('bookId', bookId);

    const response = await fetch(`${API_BASE}/api/${API_VERSION}/files/cover`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
        // Don't set Content-Type for FormData - let browser set it with boundary
      },
      body: formData
    });

    if (!response.ok) {
      return { success: false, error: `Upload failed: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, url: data.url };
  },

  // Delete cover image
  async deleteCover(url: string): Promise<{ success: boolean; error?: string }> {
    return apiFetch('/files/cover', {
      method: 'DELETE',
      body: JSON.stringify({ url })
    });
  },

  // Get storage usage
  async getStorageUsage(): Promise<{
    success: boolean; usage?: {
      total: number;
      used: number;
      available: number;
    }; error?: string
  }> {
    return apiFetch('/files/usage');
  }
};

// Export API configuration
export const apiConfig = {
  baseUrl: API_BASE,
  version: API_VERSION,
  
  // Health check
  async checkHealth(): Promise<boolean> {
    const result = await apiFetch('/health');
    return result.success;
  },

  // Get API version
  async getVersion(): Promise<{ version: string; features: string[] } | null> {
    const result = await apiFetch<{ version: string; features: string[] }>('/version');
    return result.data || null;
  }
};
