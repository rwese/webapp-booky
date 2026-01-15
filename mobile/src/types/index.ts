/**
 * Booky Mobile App Types
 * Core type definitions for the React Native mobile application
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export type BookFormat = 
  | 'physical'
  | 'kindle'
  | 'kobo'
  | 'audible'
  | 'audiobook'
  | 'pdf'
  | 'other';

export type ReadingStatus = 'want_to_read' | 'currently_reading' | 'read' | 'dnf';

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  isbn13?: string;
  coverUrl?: string;
  localCoverPath?: string;
  description?: string;
  publisher?: string;
  publishedYear?: number;
  publishedDate?: string;
  pageCount?: number;
  format: BookFormat;
  addedAt: string;
  externalIds: {
    openLibrary?: string;
    googleBooks?: string;
    oclcNumber?: string;
    lccn?: string;
    deweyDecimal?: string;
  };
  lastSyncedAt?: string;
  needsSync: boolean;
  localOnly: boolean;
  genre?: string;
  language?: string;
  readingStatus?: ReadingStatus;
  averageRating?: number;
  ratingsCount?: number;
  categories?: string[];
  subjects?: string[];
  tags?: string[];
  seriesName?: string;
  seriesVolume?: number;
  edition?: string;
}

export interface Rating {
  id: string;
  bookId: string;
  stars: number;
  review?: string;
  reviewCreatedAt?: string;
  updatedAt: string;
  containsSpoilers: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  isSmart: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingLog {
  id: string;
  bookId: string;
  status: ReadingStatus;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  settings: UserSettings;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserSettings {
  theme: ThemeMode;
  defaultFormat: BookFormat;
  ratingDisplay: 'stars' | 'numbers';
  dateFormat: string;
  notificationPreferences: NotificationConfig;
}

export interface NotificationConfig {
  readingReminders: boolean;
  newRecommendations: boolean;
  weeklyDigest: boolean;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  needsBiometricSetup: boolean;
  useBiometric: boolean;
}

// ============================================================================
// Sync Types
// ============================================================================

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'book' | 'rating' | 'tag' | 'collection' | 'readingLog';
  entityId: string;
  data: unknown;
  timestamp: string;
  synced: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingOperations: number;
  isSyncing: boolean;
  syncError: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Navigation Types
// ============================================================================

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Library: undefined;
  AddBook: { isbn?: string };
  BookDetail: { bookId: string };
  EditBook: { bookId: string };
  Scanner: undefined;
  Settings: undefined;
  Profile: undefined;
};

export type TabParamList = {
  LibraryTab: undefined;
  SearchTab: undefined;
  ScannerTab: undefined;
  ProfileTab: undefined;
};

// ============================================================================
// Scanner Types
// ============================================================================

export interface ScanResult {
  text: string;
  format: string;
  timestamp: string;
}

export interface BookLookupResult {
  id: string;
  title: string;
  authors: string[];
  isbn?: string;
  isbn13?: string;
  coverUrl?: string;
  description?: string;
  publishedYear?: number;
  pageCount?: number;
  publisher?: string;
  format: BookFormat;
  addedAt: string;
  externalIds: {
    googleBooks?: string;
    openLibrary?: string;
  };
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface BookAnalytics {
  bookId: string;
  totalViews: number;
  totalReadingTime: number;
  totalSessions: number;
  averageSessionDuration: number;
  lastViewedAt?: string;
  lastReadAt?: string;
  completionCount: number;
  averageRating: number;
  totalReviews: number;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  createdAt: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface FilterConfig {
  search?: string;
  tags?: string[];
  collections?: string[];
  formats?: BookFormat[];
  statuses?: ReadingStatus[];
  minRating?: number;
  maxRating?: number;
  sortBy?: 'title' | 'author' | 'addedAt' | 'rating' | 'publishedYear';
  sortDirection?: 'asc' | 'desc';
}

export interface PaginationConfig {
  page: number;
  limit: number;
}

export type ViewMode = 'grid' | 'list' | 'compact';

export interface OfflineAction {
  id: string;
  type: 'book_add' | 'book_update' | 'book_delete' | 'rating_update' | 'tag_add' | 'tag_remove' | 'collection_add' | 'collection_remove' | 'status_update';
  entityId: string;
  data: unknown;
  timestamp: string;
  synced: boolean;
  retryCount: number;
}
