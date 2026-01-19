// Basic Types
export type BookFormat = 
  | 'physical'
  | 'kindle'
  | 'kobo'
  | 'audible'
  | 'audiobook'
  | 'pdf'
  | 'other';

// Cover image size variants
export type CoverSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'xl';

// Cover image candidate for multi-cover selection
export interface CoverImageCandidate {
  url: string;
  source: 'openLibrary' | 'googleBooks' | 'upload';
  size: CoverSize;
  width?: number;
  height?: number;
  isPreferred?: boolean; // Mark as recommended (e.g., best for printing)
}

// Cover selection result
export interface CoverSelectionResult {
  selectedCoverUrl: string;
  source: CoverImageCandidate['source'];
  size: CoverSize;
  metadata?: {
    width?: number;
    height?: number;
  };
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  isbn13?: string; // Canonical ISBN field (ISBN-13)
  coverUrl?: string;
  localCoverPath?: string;
  description?: string;
  publisher?: string;
  publishedYear?: number;
  publishedDate?: string; // Full date from API (e.g., "2003-02-25")
  pageCount?: number;
  format: BookFormat;
  addedAt: Date;
  externalIds: {
    openLibrary?: string;
    googleBooks?: string;
    oclcNumber?: string;
    lccn?: string;
    deweyDecimal?: string;
  };
  lastSyncedAt?: Date;
  needsSync: boolean;
  localOnly: boolean;
  // Optional fields for import data
  genre?: string;
  language?: string;
  // Reading status (computed from reading logs)
  readingStatus?: ReadingStatus;
  
  // ISBN Metadata - Ratings & Reviews
  averageRating?: number;
  
  // ISBN Metadata - Content Categories  
  categories?: string[];
  subjects?: string[];
  tags?: string[];
  
  // ISBN Metadata - Physical Details
  printType?: string; // "BOOK" or "MAGAZINE"
  dimensions?: {
    height?: string;
    width?: string;
    thickness?: string;
  };
  weight?: string; // in grams or ounces
  
  // ISBN Metadata - Language & Region
  country?: string;
  languageCode?: string; // "en", "de", etc.
  
  // ISBN Metadata - Access & Links
  previewLink?: string;
  infoLink?: string;
  canonicalVolumeLink?: string;
  webReaderLink?: string;
  
  // ISBN Metadata - Content Features
  isEbook?: boolean;
  epubAvailable?: boolean;
  pdfAvailable?: boolean;
  textToSpeechPermission?: string;
  
  // ISBN Metadata - Series & Edition
  seriesName?: string;
  seriesVolume?: number;
  edition?: string;
  volume?: string;
  
  // ISBN Metadata - Additional Identifiers
  oclcNumber?: string;
  lccn?: string; // Library of Congress Control Number
  deweyDecimal?: string;
  
  // ISBN Metadata - Author Details
  authorDetails?: {
    name: string;
    bio?: string;
    born?: string;
    died?: string;
    photoUrl?: string;
  }[];
  
  // ISBN Metadata - Pricing & Availability (from Google Books saleInfo)
  saleability?: string;
  listPrice?: {
    amount: number;
    currencyCode: string;
  };
  
  // ISBN Metadata - Content Versioning
  contentVersion?: string;
  maturityRating?: string; // "NOT_MATURE", "MATURE"
  allowAnonLogging?: boolean;
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
  notificationPreferences: NotificationConfig;
}

export interface NotificationConfig {
  readingReminders: boolean;
  newRecommendations: boolean;
  weeklyDigest: boolean;
}

// Sync Operation Types
export type SyncOperationData = Partial<Book> | Partial<Rating> | Partial<Tag> | Partial<Collection> | Partial<ReadingLog>;

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'book' | 'rating' | 'tag' | 'collection' | 'readingLog';
  entityId: string;
  data: SyncOperationData;
  timestamp: Date;
  synced: boolean;
  conflictResolution?: 'local' | 'server' | 'merge';
  retryCount?: number;
  lastError?: string;
  priority?: number; // Higher priority operations sync first
}

// Offline-specific Types
export type OfflineActionData = Partial<Book> | Partial<Rating> | Partial<Tag> | Partial<Collection> | { status: ReadingStatus };

export interface OfflineAction {
  id: string;
  type: 'book_add' | 'book_update' | 'book_delete' | 'rating_update' | 'tag_add' | 'tag_remove' | 'collection_add' | 'collection_remove' | 'status_update';
  entityId: string;
  data: OfflineActionData;
  timestamp: Date;
  synced: boolean;
  retryCount: number;
}

export interface ScanQueueItem {
  id: string;
  isbn: string; // ISBN-13 (canonical field)
  status: 'pending' | 'success' | 'error' | 'duplicate' | 'created';
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
  lastSyncStatus?: 'success' | 'error' | 'syncing' | 'idle';
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
  localData: Record<string, unknown>;
  serverData?: Record<string, unknown>;
  localTimestamp: Date;
  serverTimestamp?: Date;
  entity: string;
  entityId: string;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'keep_local' | 'keep_server' | 'merge';
  mergedData?: Record<string, unknown>;
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
  subtitle?: string;
  author_name?: string[];
  isbn?: string[];
  first_publish_year?: number;
  publish_date?: string;
  cover_i?: number;
  number_of_pages_median?: number;
  publisher?: string[];
  authors?: Array<{
    key: string;
    name: string;
    birth_date?: string;
    death_date?: string;
  }>;
  subjects?: string[];
  subject?: string[];
  oclc_number?: string[];
  lccn?: string[];
  dewey_number?: string[];
  ia?: string[];
}

export interface GoogleBooksVolume {
  id: string;
  etag?: string;
  selfLink?: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    imageLinks?: {
      smallThumbnail: string;
      thumbnail: string;
      large?: string;
      extraLarge?: string;
    };
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    publisher?: string;
    printType?: string;
    contentVersion?: string;
    maturityRating?: string;
    allowAnonLogging?: boolean;
    country?: string;
    language?: string;
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
    dimensions?: {
      height?: string;
      width?: string;
      thickness?: string;
    };
    webReaderLink?: string;
    textToSpeechPermission?: string;
    accessInfo?: {
      epub?: {
        isAvailable: boolean;
      };
      pdf?: {
        isAvailable: boolean;
      };
      viewability?: string;
      embeddable?: boolean;
    };
  };
  saleInfo?: {
    country?: string;
    saleability?: string;
    isEbook?: boolean;
    listPrice?: {
      amount: number;
      currencyCode: string;
    };
  };
  accessInfo?: {
    viewability?: string;
    embeddable?: boolean;
    publicDomain?: boolean;
    textToSpeechPermission?: string;
    epub?: {
      isAvailable: boolean;
    };
    pdf?: {
      isAvailable: boolean;
    };
    webReaderLink?: string;
    accessViewStatus?: string;
    quoteSharingAllowed?: boolean;
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
  cameraStatus?: 'initializing' | 'ready' | 'streaming' | 'active' | 'error';
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

// Reading Status Types
export type ReadingStatus = 'want_to_read' | 'currently_reading' | 'read' | 'dnf';

export interface ReadingLog {
  id: string;
  bookId: string;
  status: ReadingStatus;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Import Data Types (from booknotes-export)
export interface ImportBookData {
  id: string;
  title: string;
  author: string;
  isbn?: string; // ISBN-13 (canonical field)
  pageCount?: number;
  publicationYear?: number;
  publisher?: string;
  genre?: string;
  language?: string;
  rating?: number;
  review?: string; // Book review text
  reviewCreatedAt?: string; // When the review was written
  containsSpoilers?: boolean; // Whether review contains spoilers
  readingStatus: 'Want to Read' | 'Read' | 'Currently Reading';
  tags: string[];
  coverKey?: string;
  coverFilename?: string;
  createdAt: string;
  updatedAt: string;
  categoryIds: string[];
  readingSessionIds: string[];
  noteId?: string;
}

export interface ImportMetadata {
  books: ImportBookData[];
  exportedAt: string;
  source: string;
  version: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
}

export interface ImportError {
  bookId: string;
  title: string;
  error: string;
  field?: string;
}

export interface ImportProgress {
  total: number;
  current: number;
  status: 'idle' | 'reading' | 'processing' | 'importing' | 'completed' | 'error';
  currentBook?: string;
  errors: ImportError[];
}

// Authentication Types
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
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  message?: string;
  error?: string;
}
