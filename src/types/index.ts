// Basic Types
export type BookFormat = 
  | 'physical'
  | 'kindle'
  | 'kobo'
  | 'audible'
  | 'audiobook'
  | 'pdf'
  | 'other';

export type ReadingStatus = 
  | 'want_to_read'
  | 'currently_reading'
  | 'read'
  | 'dnf';

export interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn?: string;
  isbn13?: string;
  coverUrl?: string;
  localCoverPath?: string;
  description?: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  format: BookFormat;
  addedAt: Date;
  externalIds: {
    openLibrary?: string;
    googleBooks?: string;
  };
  lastSyncedAt?: Date;
  needsSync: boolean;
  localOnly: boolean;
}

export interface Rating {
  id: string;
  bookId: string;
  stars: number; // 0.5 to 5.0, increments of 0.5
  review?: string;
  reviewCreatedAt?: Date;
  updatedAt: Date;
  containsSpoilers: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface BookTag {
  bookId: string;
  tagId: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  isSmart: boolean;
  smartRules?: SmartRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionBook {
  collectionId: string;
  bookId: string;
  order: number;
  addedAt: Date;
}

export interface SmartRule {
  field: 'rating' | 'format' | 'tags' | 'status' | 'year';
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains';
  value: string | number | string[];
}

export interface ReadingLog {
  id: string;
  bookId: string;
  status: ReadingStatus;
  startedAt?: Date;
  finishedAt?: Date;
  dnfReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: Date;
  settings: UserSettings;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserSettings {
  theme: ThemeMode;
  defaultFormat: BookFormat;
  ratingDisplay: 'stars' | 'numbers';
  dateFormat: string;
  animationsEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  analyticsEnabled: boolean;
  analyticsPreferences: AnalyticsConfig;
  notificationPreferences: NotificationConfig;
}

export interface NotificationConfig {
  readingReminders: boolean;
  newRecommendations: boolean;
  weeklyDigest: boolean;
}

export interface AnalyticsConfig {
  showCharts: boolean;
  defaultTimeRange: 'month' | 'year' | 'all';
  trackPagesRead: boolean;
}

// Sync Operation Types
export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'book' | 'rating' | 'tag' | 'collection' | 'readingLog';
  entityId: string;
  data: any;
  timestamp: Date;
  synced: boolean;
  conflictResolution?: 'local' | 'server' | 'merge';
}

// Offline-specific Types
export interface OfflineAction {
  id: string;
  type: 'book_add' | 'book_update' | 'book_delete' | 'rating_update' | 'tag_add' | 'tag_remove' | 'collection_add' | 'collection_remove' | 'status_update';
  entityId: string;
  data: any;
  timestamp: Date;
  synced: boolean;
  retryCount: number;
}

export interface ScanQueueItem {
  id: string;
  isbn: string;
  isbn13?: string;
  status: 'pending' | 'success' | 'error' | 'duplicate';
  bookData?: Book;
  error?: string;
  scannedAt: Date;
}

export interface CachedImage {
  id: string;
  originalUrl: string;
  localPath: string;
  bookId: string;
  cachedAt: Date;
  lastAccessed: Date;
  size: number;
}

// Sync Status Types
export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingOperations: number;
  isSyncing: boolean;
  syncError: string | null;
}

// Barcode Scanning Types
export interface ScanResult {
  text: string;
  format: string;
  timestamp: Date;
}

export interface BarcodeConfig {
  formats: string[];
  cameraId?: string;
  facingMode: 'user' | 'environment';
  flashEnabled: boolean;
  autoCapture: boolean;
  scanDelay: number;
}

// Touch Interaction Types
export interface SwipeAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  backgroundColor: string;
  textColor: string;
}

export interface TouchFeedback {
  hapticFeedback: boolean;
  visualFeedback: boolean;
  animationDuration: number;
}

// Responsive Design Types
export interface BreakpointConfig {
  mobile: number;    // < 640px
  tablet: number;    // 640px - 1024px  
  desktop: number;   // > 1024px
}

export type ViewMode = 'grid' | 'list' | 'compact';

export interface ResponsiveConfig {
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  touchTarget: {
    minimum: number;
    recommended: number;
  };
  bottomNavHeight: number;
  sidebarWidth: number;
}

// Conflict Resolution Types
export interface ConflictData {
  id: string;
  localData: any;
  serverData?: any;
  localTimestamp: Date;
  serverTimestamp?: Date;
  entity: string;
  entityId: string;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'keep_local' | 'keep_server' | 'merge';
  mergedData?: any;
  resolvedAt: Date;
}

// Storage Types
export interface StorageUsage {
  totalSize: number;
  imagesSize: number;
  dataSize: number;
  lastCleanup: Date;
}

// Batch Scanning Types
export interface BatchScanConfig {
  maxQueueSize: number;
  autoProcess: boolean;
  showProgress: boolean;
  confirmBeforeAdd: boolean;
}

// API Response Types
export interface OpenLibraryBook {
  key: string;
  title: string;
  author_name?: string[];
  isbn?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  publisher?: string[];
}

export interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail: string;
      large?: string;
    };
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    publisher?: string;
  };
}

// Utility Types
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface FilterConfig {
  search?: string;
  tags?: string[];
  collections?: string[];
  formats?: BookFormat[];
  statuses?: ReadingStatus[];
  minRating?: number;
  maxRating?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationConfig;
}

// Performance Types
export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  tti: number; // Time to Interactive
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  ttfb: number; // Time to First Byte
}

export interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  chunks: {
    name: string;
    size: number;
    gzippedSize: number;
  }[];
}

// Accessibility Types
export interface AriaLiveRegion {
  'aria-live': 'polite' | 'off' | 'assertive';
  'aria-atomic'?: boolean;
}

export interface FocusTrapConfig {
  initialFocus?: string;
  returnFocus?: boolean;
  escapeDeactivates?: boolean;
  clickOutsideDeactivates?: boolean;
}

export interface SkipLink {
  targetId: string;
  label: string;
}

// Mobile-First Responsive Types
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface TouchTargetConfig {
  minimum: number;
  recommended: number;
  spacing: number;
}

export interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  action?: () => void;
}

export interface SwipeConfig {
  enabled: boolean;
  threshold: number;
  velocity: number;
  actions: SwipeAction[];
}

export interface BottomSheetConfig {
  snapPoints: number[];
  defaultSnap: number;
  backdropOpacity: number;
}

export interface ResponsiveSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ResponsiveTypography {
  h1: string;
  h2: string;
  h3: string;
  body: string;
  caption: string;
}

// Barcode Scanning Types
export interface ScanConfig {
  enabled: boolean;
  cameraFacing: 'environment' | 'user';
  autoScan: boolean;
  scanInterval: number;
  formats: string[];
}

export interface ScanState {
  isScanning: boolean;
  lastScan: ScanResult | null;
  error: string | null;
  cameraDevices: MediaDeviceInfo[];
  selectedDevice: string | null;
  flashEnabled: boolean;
}

export interface ManualEntryConfig {
  autoFormat: boolean;
  validateISBN: boolean;
  autoLookup: boolean;
}

// Batch Scanning Types
export interface BatchScanState {
  queue: ScanQueueItem[];
  isProcessing: boolean;
  currentProgress: number;
  totalItems: number;
  errors: string[];
}

export interface BatchScanActions {
  addToQueue: (isbn: string) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  processQueue: () => Promise<void>;
  retryItem: (id: string) => void;
}

// Analytics Event Types - Book-centric tracking (no page tracking)
export type AnalyticsEventType = 
  | 'book_viewed'
  | 'reading_session_start'
  | 'reading_session_end'
  | 'book_completed'
  | 'rating_added'
  | 'review_added';

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  bookId: string;
  timestamp: Date;
  eventData: AnalyticsEventData;
  synced: boolean;
}

export interface AnalyticsEventData {
  // Common fields
  sessionDuration?: number; // in milliseconds
  pageCount?: number;
  
  // Rating specific
  rating?: number;
  previousRating?: number;
  
  // Review specific
  reviewLength?: number;
  containsSpoilers?: boolean;
  
  // Session specific
  sessionStart?: Date;
  sessionEnd?: Date;
  
  // Completion specific
  completionTime?: number; // days to complete
  reRead?: boolean;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  createdAt: Date;
}

export interface BookAnalytics {
  bookId: string;
  totalViews: number;
  totalReadingTime: number; // milliseconds
  totalSessions: number;
  averageSessionDuration: number;
  lastViewedAt?: Date;
  lastReadAt?: Date;
  completionCount: number;
  averageRating: number;
  totalReviews: number;
}
