/**
 * Cloud Books Hook
 * 
 * Provides book data from the backend API when cloud sync is enabled.
 * Falls back to local data when offline or sync is disabled.
 */

import { useState, useEffect, useCallback } from 'react';
import { booksApi } from '../lib/booksApi';
import { useAuth } from '../contexts/AuthContext';
import { useSettingsStore } from '../store/useStore';
import type { Book, Tag, Collection } from '../types';

// Hook for cloud-synced books
export function useCloudBooks() {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettingsStore();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    if (!isAuthenticated || !settings.cloudSyncEnabled || !user) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedBooks = await booksApi.fetchBooks(user.id);
      setBooks(fetchedBooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch books');
      // Fall back to local data on error
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, settings.cloudSyncEnabled, user]);

  useEffect(() => {
    if (isAuthenticated && settings.cloudSyncEnabled) {
      fetchBooks();
    }
  }, [isAuthenticated, settings.cloudSyncEnabled, fetchBooks]);

  return { books, isLoading, error, refresh: fetchBooks };
}

// Hook for a single cloud book
export function useCloudBook(bookId: string) {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettingsStore();
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !settings.cloudSyncEnabled || !user) {
      return;
    }

    setIsLoading(true);
    booksApi.fetchBook(bookId)
      .then(setBook)
      .catch(() => setBook(null))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, settings.cloudSyncEnabled, user, bookId]);

  return { book, isLoading };
}

// Hook for creating a book in the cloud
export function useCreateCloudBook() {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBook = useCallback(async (bookData: Omit<Book, 'id' | 'addedAt' | 'needsSync' | 'localOnly'>) => {
    if (!isAuthenticated || !settings.cloudSyncEnabled || !user) {
      throw new Error('Cloud sync is not enabled');
    }

    setIsLoading(true);
    setError(null);

    try {
      const book = await booksApi.createBook(bookData);
      return book;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create book';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, settings.cloudSyncEnabled, user]);

  return { createBook, isLoading, error };
}

// Hook for updating a book in the cloud
export function useUpdateCloudBook() {
  const { isAuthenticated } = useAuth();
  const { settings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBook = useCallback(async (bookId: string, changes: Partial<Book>) => {
    if (!isAuthenticated || !settings.cloudSyncEnabled) {
      throw new Error('Cloud sync is not enabled');
    }

    setIsLoading(true);
    setError(null);

    try {
      const book = await booksApi.updateBook(bookId, changes);
      return book;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update book';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, settings.cloudSyncEnabled]);

  return { updateBook, isLoading, error };
}

// Hook for deleting a book in the cloud
export function useDeleteCloudBook() {
  const { isAuthenticated } = useAuth();
  const { settings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteBook = useCallback(async (bookId: string) => {
    if (!isAuthenticated || !settings.cloudSyncEnabled) {
      throw new Error('Cloud sync is not enabled');
    }

    setIsLoading(true);
    setError(null);

    try {
      await booksApi.deleteBook(bookId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete book';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, settings.cloudSyncEnabled]);

  return { deleteBook, isLoading, error };
}

// Hook for cloud tags
export function useCloudTags() {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettingsStore();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !settings.cloudSyncEnabled || !user) {
      return;
    }

    setIsLoading(true);
    booksApi.fetchTags(user.id)
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, settings.cloudSyncEnabled, user]);

  return { tags, isLoading };
}

// Hook for cloud collections
export function useCloudCollections() {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettingsStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !settings.cloudSyncEnabled || !user) {
      return;
    }

    setIsLoading(true);
    booksApi.fetchCollections(user.id)
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, settings.cloudSyncEnabled, user]);

  return { collections, isLoading };
}
