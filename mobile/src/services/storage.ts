/**
 * Storage Service
 * Handles local storage using AsyncStorage for offline-first architecture
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthTokens, User, Book, SyncOperation, OfflineAction } from '../types';

// Storage keys
const KEYS = {
  AUTH_TOKENS: 'booky_auth_tokens',
  USER: 'booky_user',
  BOOKS: 'booky_books',
  TAGS: 'booky_tags',
  COLLECTIONS: 'booky_collections',
  SETTINGS: 'booky_settings',
  SYNC_OPERATIONS: 'booky_sync_operations',
  OFFLINE_ACTIONS: 'booky_offline_actions',
  LAST_SYNC_TIME: 'booky_last_sync',
  PENDING_UPLOADS: 'booky_pending_uploads',
};

class StorageService {
  // =========================================================================
  // Authentication
  // =========================================================================

  static async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.AUTH_TOKENS, JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to save auth tokens:', error);
      throw error;
    }
  }

  static async getTokens(): Promise<AuthTokens | null> {
    try {
      const tokens = await AsyncStorage.getItem(KEYS.AUTH_TOKENS);
      return tokens ? JSON.parse(tokens) : null;
    } catch (error) {
      console.error('Failed to get auth tokens:', error);
      return null;
    }
  }

  static async saveUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to save user:', error);
      throw error;
    }
  }

  static async getUser(): Promise<User | null> {
    try {
      const user = await AsyncStorage.getItem(KEYS.USER);
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  static async clearAuth(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([KEYS.AUTH_TOKENS, KEYS.USER]);
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  }

  // =========================================================================
  // Books
  // =========================================================================

  static async saveBooks(books: Book[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.BOOKS, JSON.stringify(books));
    } catch (error) {
      console.error('Failed to save books:', error);
      throw error;
    }
  }

  static async getBooks(): Promise<Book[]> {
    try {
      const books = await AsyncStorage.getItem(KEYS.BOOKS);
      return books ? JSON.parse(books) : [];
    } catch (error) {
      console.error('Failed to get books:', error);
      return [];
    }
  }

  static async getBookById(bookId: string): Promise<Book | null> {
    try {
      const books = await this.getBooks();
      return books.find(b => b.id === bookId) || null;
    } catch (error) {
      console.error('Failed to get book by ID:', error);
      return null;
    }
  }

  static async addBook(book: Book): Promise<void> {
    try {
      const books = await this.getBooks();
      books.push(book);
      await this.saveBooks(books);
    } catch (error) {
      console.error('Failed to add book:', error);
      throw error;
    }
  }

  static async updateBook(bookId: string, updates: Partial<Book>): Promise<void> {
    try {
      const books = await this.getBooks();
      const index = books.findIndex(b => b.id === bookId);
      if (index !== -1) {
        books[index] = { ...books[index], ...updates, needsSync: true };
        await this.saveBooks(books);
      }
    } catch (error) {
      console.error('Failed to update book:', error);
      throw error;
    }
  }

  static async deleteBook(bookId: string): Promise<void> {
    try {
      const books = await this.getBooks();
      const filtered = books.filter(b => b.id !== bookId);
      await this.saveBooks(filtered);
    } catch (error) {
      console.error('Failed to delete book:', error);
      throw error;
    }
  }

  static async getBooksNeedingSync(): Promise<Book[]> {
    try {
      const books = await this.getBooks();
      return books.filter(b => b.needsSync || b.localOnly);
    } catch (error) {
      console.error('Failed to get books needing sync:', error);
      return [];
    }
  }

  // =========================================================================
  // Tags & Collections
  // =========================================================================

  static async saveTags(tags: import('../types').Tag[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.TAGS, JSON.stringify(tags));
    } catch (error) {
      console.error('Failed to save tags:', error);
    }
  }

  static async getTags(): Promise<import('../types').Tag[]> {
    try {
      const tags = await AsyncStorage.getItem(KEYS.TAGS);
      return tags ? JSON.parse(tags) : [];
    } catch (error) {
      console.error('Failed to get tags:', error);
      return [];
    }
  }

  static async saveCollections(collections: import('../types').Collection[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.COLLECTIONS, JSON.stringify(collections));
    } catch (error) {
      console.error('Failed to save collections:', error);
    }
  }

  static async getCollections(): Promise<import('../types').Collection[]> {
    try {
      const collections = await AsyncStorage.getItem(KEYS.COLLECTIONS);
      return collections ? JSON.parse(collections) : [];
    } catch (error) {
      console.error('Failed to get collections:', error);
      return [];
    }
  }

  // =========================================================================
  // Sync Operations
  // =========================================================================

  static async saveSyncOperations(operations: SyncOperation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SYNC_OPERATIONS, JSON.stringify(operations));
    } catch (error) {
      console.error('Failed to save sync operations:', error);
    }
  }

  static async getSyncOperations(): Promise<SyncOperation[]> {
    try {
      const operations = await AsyncStorage.getItem(KEYS.SYNC_OPERATIONS);
      return operations ? JSON.parse(operations) : [];
    } catch (error) {
      console.error('Failed to get sync operations:', error);
      return [];
    }
  }

  static async addSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      const operations = await this.getSyncOperations();
      operations.push(operation);
      await this.saveSyncOperations(operations);
    } catch (error) {
      console.error('Failed to add sync operation:', error);
    }
  }

  static async clearSyncedOperations(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SYNC_OPERATIONS, JSON.stringify([]));
    } catch (error) {
      console.error('Failed to clear sync operations:', error);
    }
  }

  // =========================================================================
  // Offline Actions
  // =========================================================================

  static async saveOfflineActions(actions: OfflineAction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.OFFLINE_ACTIONS, JSON.stringify(actions));
    } catch (error) {
      console.error('Failed to save offline actions:', error);
    }
  }

  static async getOfflineActions(): Promise<OfflineAction[]> {
    try {
      const actions = await AsyncStorage.getItem(KEYS.OFFLINE_ACTIONS);
      return actions ? JSON.parse(actions) : [];
    } catch (error) {
      console.error('Failed to get offline actions:', error);
      return [];
    }
  }

  static async addOfflineAction(action: OfflineAction): Promise<void> {
    try {
      const actions = await this.getOfflineActions();
      actions.push(action);
      await this.saveOfflineActions(actions);
    } catch (error) {
      console.error('Failed to add offline action:', error);
    }
  }

  static async removeOfflineAction(actionId: string): Promise<void> {
    try {
      const actions = await this.getOfflineActions();
      const filtered = actions.filter(a => a.id !== actionId);
      await this.saveOfflineActions(filtered);
    } catch (error) {
      console.error('Failed to remove offline action:', error);
    }
  }

  // =========================================================================
  // Sync Metadata
  // =========================================================================

  static async setLastSyncTime(timestamp: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.LAST_SYNC_TIME, timestamp);
    } catch (error) {
      console.error('Failed to set last sync time:', error);
    }
  }

  static async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.LAST_SYNC_TIME);
    } catch (error) {
      console.error('Failed to get last sync time:', error);
      return null;
    }
  }

  // =========================================================================
  // Settings
  // =========================================================================

  static async saveSettings(settings: Record<string, unknown>): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  static async getSettings(): Promise<Record<string, unknown>> {
    try {
      const settings = await AsyncStorage.getItem(KEYS.SETTINGS);
      return settings ? JSON.parse(settings) : {};
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  static async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const settings = await this.getSettings();
    return (settings[key] as T) ?? defaultValue;
  }

  static async setSetting(key: string, value: unknown): Promise<void> {
    const settings = await this.getSettings();
    settings[key] = value;
    await this.saveSettings(settings);
  }

  // =========================================================================
  // Utility
  // =========================================================================

  static async clearAll(): Promise<void> {
    try {
      const allKeys = Object.values(KEYS);
      await AsyncStorage.multiRemove(allKeys);
      console.log('All storage cleared');
    } catch (error) {
      console.error('Failed to clear all storage:', error);
    }
  }

  static async getStorageInfo(): Promise<{ keys: number; usage: string }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return {
        keys: keys.length,
        usage: 'Unknown (AsyncStorage)',
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { keys: 0, usage: 'Error' };
    }
  }
}

export { StorageService, KEYS };
