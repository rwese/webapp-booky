import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import dotenv from 'dotenv';
import { register, recordRequest, activeConnections } from './metrics';
import { 
  initializeDatabase, 
  bookService, 
  syncService,
  collectionService,
  tagService,
  readingLogService 
} from './database';
import { 
  createUser, 
  loginUser, 
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
  changePassword,
  updateUserProfile,
  deleteUserAccount,
  isEmailRegistered,
  getUserById,
  findOrCreateOAuthUser,
  validatePasswordStrength
} from './auth';
import { authMiddleware } from './authMiddleware';
import {
  globalRateLimiter,
  authRateLimiter,
  syncRateLimiter,
  searchRateLimiter,
  securityHeaders,
  corsOptions,
  xssProtection,
  validateRequest,
  schemas,
  versionMiddleware,
  versionAwareResponse,
  requestTimeout,
  securityErrorHandler
} from './security';
import fileRoutes from './routes/files';
import { cacheService, CacheKeys, CACHE_CONFIG } from './cache';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database connection
initializeDatabase().catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Initialize cache connection (non-blocking)
cacheService.connect().catch((error) => {
  console.warn('Cache service initialization failed, caching will be disabled:', error.message);
});

// Middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(xssProtection);
app.use(express.json({ limit: '10mb' }));
app.use(requestTimeout(30000));

// API versioning
app.use(versionMiddleware);
app.use(versionAwareResponse);

// Rate limiting
app.use('/api/', globalRateLimiter);

// Metrics middleware for tracking request duration
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const method = req.method || 'UNKNOWN';
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode || 500;
    
    recordRequest(method, route, statusCode, duration);
    activeConnections.dec();
  });
  
  next();
});

// Metrics endpoint (no authentication required for Prometheus scraping)
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end('Error collecting metrics');
  }
});

// File storage routes
app.use('/api/files', fileRoutes);

// Social features routes
app.get('/api/social/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { getPublicProfile } = await import('./social');
    const profile = await getPublicProfile(req.params.userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.put('/api/social/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { updateProfile } = await import('./social');
    const { name, bio, avatarUrl } = req.body;
    const userId = (req as any).user?.id || req.body.userId;
    const profile = await updateProfile(userId, { name, bio, avatarUrl });
    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/social/follow/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { followUser } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    await followUser(userId, req.params.userId);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Cannot follow yourself') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

app.delete('/api/social/follow/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { unfollowUser } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    await unfollowUser(userId, req.params.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

app.get('/api/social/followers/:userId', async (req: Request, res: Response) => {
  try {
    const { getFollowers } = await import('./social');
    const page = parseInt(req.query.page as string) || 1;
    const followers = await getFollowers(req.params.userId, page);
    res.json(followers);
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

app.get('/api/social/following/:userId', async (req: Request, res: Response) => {
  try {
    const { getFollowing } = await import('./social');
    const page = parseInt(req.query.page as string) || 1;
    const following = await getFollowing(req.params.userId, page);
    res.json(following);
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

// Collection sharing
app.post('/api/social/collections/:collectionId/share', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { shareCollectionWithUser } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    const { targetUserId, permission } = req.body;
    const share = await shareCollectionWithUser(req.params.collectionId, userId, targetUserId, permission);
    res.json(share);
  } catch (error: any) {
    if (error.message.includes('not found or access denied')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Share collection error:', error);
    res.status(500).json({ error: 'Failed to share collection' });
  }
});

app.delete('/api/social/collections/:collectionId/share/:targetUserId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { revokeCollectionShare } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    await revokeCollectionShare(req.params.collectionId, userId, req.params.targetUserId);
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

app.post('/api/social/collections/:collectionId/link', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { createShareLink } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    const { expiresAt, maxViews, allowEdit } = req.body;
    const link = await createShareLink(req.params.collectionId, userId, { expiresAt, maxViews, allowEdit });
    res.json(link);
  } catch (error: any) {
    if (error.message.includes('not found or access denied')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Create share link error:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

app.get('/api/social/share/:token', async (req: Request, res: Response) => {
  try {
    const { accessViaShareLink } = await import('./social');
    const result = await accessViaShareLink(req.params.token);
    res.json({
      collection: result.collection,
      permission: result.permission,
    });
  } catch (error: any) {
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('limit')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Access share link error:', error);
    res.status(500).json({ error: 'Failed to access share link' });
  }
});

app.put('/api/social/collections/:collectionId/public', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { makeCollectionPublic, makeCollectionPrivate } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    const isPublic = req.body.isPublic === true;
    
    if (isPublic) {
      await makeCollectionPublic(req.params.collectionId, userId);
    } else {
      await makeCollectionPrivate(req.params.collectionId, userId);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Toggle public error:', error);
    res.status(500).json({ error: 'Failed to update collection visibility' });
  }
});

app.get('/api/social/collections/public', async (req: Request, res: Response) => {
  try {
    const { getPublicCollections } = await import('./social');
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const collections = await getPublicCollections(page, limit);
    res.json(collections);
  } catch (error) {
    console.error('Get public collections error:', error);
    res.status(500).json({ error: 'Failed to get public collections' });
  }
});

// Book recommendations
app.get('/api/social/recommendations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { getRecommendations } = await import('./social');
    const userId = (req as any).user?.id || req.query.userId;
    const limit = parseInt(req.query.limit as string) || 10;
    const recommendations = await getRecommendations(userId, limit);
    res.json(recommendations);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

app.get('/api/social/books/:bookId/similar', async (req: Request, res: Response) => {
  try {
    const { getSimilarBooks } = await import('./social');
    const limit = parseInt(req.query.limit as string) || 5;
    const similar = await getSimilarBooks(req.params.bookId, limit);
    res.json(similar);
  } catch (error) {
    console.error('Get similar books error:', error);
    res.status(500).json({ error: 'Failed to get similar books' });
  }
});

// Reading challenges
app.post('/api/social/challenges', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { createChallenge } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    const { name, description, targetBooks, startDate, endDate, isPublic } = req.body;
    const challenge = await createChallenge(userId, { name, description, targetBooks, startDate, endDate });
    // Update isPublic separately if needed
    res.status(201).json(challenge);
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

app.get('/api/social/challenges', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { getUserChallenges } = await import('./social');
    const userId = (req as any).user?.id || req.query.userId;
    const challenges = await getUserChallenges(userId);
    res.json(challenges);
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ error: 'Failed to get challenges' });
  }
});

app.get('/api/social/challenges/public', async (req: Request, res: Response) => {
  try {
    const { getPublicChallenges } = await import('./social');
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const challenges = await getPublicChallenges(page, limit);
    res.json(challenges);
  } catch (error) {
    console.error('Get public challenges error:', error);
    res.status(500).json({ error: 'Failed to get public challenges' });
  }
});

app.post('/api/social/challenges/:challengeId/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { joinCommunityChallenge } = await import('./social');
    const userId = (req as any).user?.id || req.body.userId;
    const participant = await joinCommunityChallenge(req.params.challengeId, userId);
    res.json(participant);
  } catch (error) {
    console.error('Join challenge error:', error);
    res.status(500).json({ error: 'Failed to join challenge' });
  }
});

app.get('/api/social/challenges/:challengeId/leaderboard', async (req: Request, res: Response) => {
  try {
    const { getChallengeLeaderboard } = await import('./social');
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await getChallengeLeaderboard(req.params.challengeId, limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Activity feed
app.get('/api/social/feed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { getActivityFeed } = await import('./social');
    const userId = (req as any).user?.id || req.query.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const feed = await getActivityFeed(userId, page, limit);
    res.json(feed);
  } catch (error) {
    console.error('Get activity feed error:', error);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

// User search
app.get('/api/social/users/search', async (req: Request, res: Response) => {
  try {
    const { searchUsers } = await import('./social');
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const limit = parseInt(req.query.limit as string) || 20;
    const users = await searchUsers(q, limit);
    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Google Books API configuration
const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

// Types
interface BookLookupResult {
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
  format: string;
  addedAt: string;
  externalIds: {
    googleBooks?: string;
  };
}

// ISBN validation function
function isValidISBN(isbn: string): boolean {
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  
  // ISBN-10
  if (cleanIsbn.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanIsbn[i]) * (10 - i);
    }
    const lastChar = cleanIsbn[9].toUpperCase();
    const lastValue = lastChar === 'X' ? 10 : parseInt(lastChar);
    sum += lastValue;
    return sum % 11 === 0;
  }
  
  // ISBN-13
  if (cleanIsbn.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanIsbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(cleanIsbn[12]);
  }
  
  return false;
}

// Error handling middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
};

// ISBN lookup endpoint
app.get('/api/isbn/:isbn', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isbn } = req.params;
    
    // Validate ISBN
    if (!isValidISBN(isbn)) {
      return res.status(400).json({ error: 'Invalid ISBN format' });
    }
    
    // Build API URL with optional API key
    let apiUrl = `${GOOGLE_BOOKS_API}/volumes?q=isbn:${isbn}`;
    if (GOOGLE_BOOKS_API_KEY) {
      apiUrl += `&key=${GOOGLE_BOOKS_API_KEY}`;
    }
    
    // Fetch from Google Books API
    const response = await axios.get(apiUrl);
    
    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    const volume = response.data.items[0];
    const info = volume.volumeInfo;
    
    // Extract ISBN-13 if available
    const isbn13 = info.industryIdentifiers?.find(
      (id: any) => id.type === 'ISBN_13'
    )?.identifier;
    
    // Build result
    const result: BookLookupResult = {
      id: crypto.randomUUID(),
      title: info.title,
      authors: info.authors || [],
      isbn,
      isbn13,
      coverUrl: info.imageLinks?.large || info.imageLinks?.thumbnail?.replace('http:', 'https:'),
      description: info.description,
      publishedYear: info.publishedDate ? parseInt(info.publishedDate) : undefined,
      pageCount: info.pageCount,
      publisher: info.publisher,
      format: 'physical',
      addedAt: new Date().toISOString(),
      externalIds: {
        googleBooks: volume.id
      }
    };
    
    res.json(result);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Google Books API error:', error.message);
      res.status(500).json({ error: 'Failed to lookup book' });
    } else {
      next(error);
    }
  }
});

// Search endpoint (with rate limiting)
app.get('/api/search', searchRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Build API URL with optional API key
    let apiUrl = `${GOOGLE_BOOKS_API}/volumes?q=${encodeURIComponent(q)}&maxResults=20`;
    if (GOOGLE_BOOKS_API_KEY) {
      apiUrl += `&key=${GOOGLE_BOOKS_API_KEY}`;
    }
    
    // Fetch from Google Books API
    const response = await axios.get(apiUrl);
    
    if (!response.data.items || response.data.items.length === 0) {
      return res.json([]);
    }
    
    // Transform results
    const results: BookLookupResult[] = response.data.items.map((volume: any) => {
      const info = volume.volumeInfo;
      const isbn = info.industryIdentifiers?.find(
        (id: any) => id.type === 'ISBN_13'
      )?.identifier || 
      info.industryIdentifiers?.find(
        (id: any) => id.type === 'ISBN_10'
      )?.identifier;
      
      return {
        id: crypto.randomUUID(),
        title: info.title,
        authors: info.authors || [],
        isbn,
        coverUrl: info.imageLinks?.large || info.imageLinks?.thumbnail?.replace('http:', 'https:'),
        description: info.description,
        publishedYear: info.publishedDate ? parseInt(info.publishedDate) : undefined,
        pageCount: info.pageCount,
        publisher: info.publisher,
        format: 'physical',
        addedAt: new Date().toISOString(),
        externalIds: {
          googleBooks: volume.id
        }
      };
    });
    
    res.json(results);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Google Books API error:', error.message);
      res.status(500).json({ error: 'Search failed' });
    } else {
      next(error);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get all books for user (with caching)
app.get('/api/books', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Try cache first
    const cacheKey = CacheKeys.userBooks(userId);
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const books = await bookService.getAll(userId);
    
    // Cache for 15 minutes
    await cacheService.set(cacheKey, books, CACHE_CONFIG.TTL.bookList);
    
    res.json(books);
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Failed to get books' });
  }
});

// Get single book by ID (with caching)
app.get('/api/books/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Try cache first
    const cacheKey = CacheKeys.book(id);
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const book = await bookService.getById(id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Cache for 24 hours
    await cacheService.set(cacheKey, book, CACHE_CONFIG.TTL.bookMetadata);
    
    res.json(book);
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ error: 'Failed to get book' });
  }
});

app.post('/api/books', authMiddleware, validateRequest(schemas.createBook), async (req: Request, res: Response) => {
  try {
    const { userId, ...bookData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const book = await bookService.create(userId, bookData);
    res.status(201).json(book);
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

app.put('/api/books/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ...changes } = req.body;
    
    const book = await bookService.update(id, changes);
    res.json(book);
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

app.delete('/api/books/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await bookService.delete(id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Collection endpoints
app.get('/api/collections', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const collections = await collectionService.getAll(userId);
    res.json(collections);
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Failed to get collections' });
  }
});

app.post('/api/collections', authMiddleware, validateRequest(schemas.createCollection), async (req: Request, res: Response) => {
  try {
    const { userId, ...collectionData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const collection = await collectionService.create(userId, collectionData);
    res.status(201).json(collection);
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Tag endpoints
app.get('/api/tags', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const tags = await tagService.getAll(userId);
    res.json(tags);
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

app.post('/api/tags', authMiddleware, validateRequest(schemas.createTag), async (req: Request, res: Response) => {
  try {
    const { userId, ...tagData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const tag = await tagService.create(userId, tagData);
    res.status(201).json(tag);
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// Register new user (with rate limiting and validation)
app.post('/api/auth/register', authRateLimiter, validateRequest(schemas.registerUser), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required' 
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_EMAIL',
        message: 'Please enter a valid email address'
      });
    }
    
    const result = await createUser({ email, password, name });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'REGISTRATION_FAILED',
      message: 'Failed to register user'
    });
  }
});

// Login user (with rate limiting and validation)
app.post('/api/auth/login', authRateLimiter, validateRequest(schemas.loginUser), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required' 
      });
    }
    
    const result = await loginUser({ email, password });
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'LOGIN_FAILED',
      message: 'Failed to login'
    });
  }
});

// Refresh access token
app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Refresh token is required'
      });
    }
    
    const result = await refreshAccessToken(refreshToken);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'REFRESH_FAILED',
      message: 'Failed to refresh token'
    });
  }
});

// Check email availability
app.get('/api/auth/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email is required'
      });
    }
    
    const isRegistered = await isEmailRegistered(email);
    
    res.json({
      success: true,
      available: !isRegistered,
      email
    });
  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      error: 'CHECK_FAILED',
      message: 'Failed to check email availability'
    });
  }
});

// Request password reset
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email is required'
      });
    }
    
    const result = await requestPasswordReset(email);
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'REQUEST_FAILED',
      message: 'Failed to process password reset request'
    });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Token and new password are required'
      });
    }
    
    const result = await resetPassword(token, password);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'RESET_FAILED',
      message: 'Failed to reset password'
    });
  }
});

// Get current user profile (authenticated)
app.get('/api/auth/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
    }
    
    const user = await getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'PROFILE_FAILED',
      message: 'Failed to get user profile'
    });
  }
});

// Update user profile (authenticated)
app.put('/api/auth/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
    }
    
    const { name, image } = req.body;
    const result = await updateUserProfile(req.user.userId, { name, image });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: 'Failed to update profile'
    });
  }
});

// Change password (authenticated)
app.post('/api/auth/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Current password and new password are required'
      });
    }
    
    const result = await changePassword(req.user.userId, currentPassword, newPassword);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'CHANGE_FAILED',
      message: 'Failed to change password'
    });
  }
});

// Delete account (authenticated)
app.delete('/api/auth/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
    }
    
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Password is required to delete account'
      });
    }
    
    const result = await deleteUserAccount(req.user.userId, password);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: 'Failed to delete account'
    });
  }
});

// OAuth callback (Google, GitHub, Discord, Apple)
app.post('/api/auth/oauth', async (req: Request, res: Response) => {
  try {
    const { provider, providerId, email, name, image } = req.body;
    
    if (!provider || !providerId || !email) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Provider, providerId, and email are required'
      });
    }
    
    const result = await findOrCreateOAuthUser(provider, providerId, email, name, image);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'OAUTH_FAILED',
      message: 'Failed to authenticate with provider'
    });
  }
});

// Validate password strength
app.post('/api/auth/validate-password', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Password is required'
      });
    }
    
    const validation = validatePasswordStrength(password);
    
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('Password validation error:', error);
    res.status(500).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'Failed to validate password'
    });
  }
});

// Sync endpoints

// Process sync operations (with rate limiting and validation)
app.post('/api/sync/operations', authMiddleware, syncRateLimiter, validateRequest(schemas.syncBatch), async (req: Request, res: Response) => {
  try {
    const { operations } = req.body;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Operations must be an array'
      });
    }
    
    // Process the batch of operations
    const results = await processSyncBatch(req.user.userId, operations);
    
    // Mark successful operations as synced
    const successfulIds = results
      .filter(r => r.status === 'success')
      .map(r => r.id);
    
    if (successfulIds.length > 0) {
      await markOperationsSynced(req.user.userId, successfulIds);
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Sync operations error:', error);
    res.status(500).json({
      success: false,
      error: 'SYNC_FAILED',
      message: 'Failed to process sync operations'
    });
  }
});

// Get sync status
app.get('/api/sync/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const status = await getSyncStatus(req.user.userId);
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_FAILED',
      message: 'Failed to get sync status'
    });
  }
});

// Get pending operations (for client sync queue)
app.get('/api/sync/pending', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const operations = await getPendingOperations(req.user.userId);
    
    res.json({
      success: true,
      operations
    });
  } catch (error) {
    console.error('Get pending operations error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: 'Failed to get pending operations'
    });
  }
});

// Get changes since timestamp (incremental sync)
app.get('/api/sync/changes', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const { since } = req.query;
    
    if (!since || typeof since !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Since timestamp is required'
      });
    }
    
    const sinceDate = new Date(since);
    const changes = await getChangesSince(req.user.userId, sinceDate);
    
    res.json({
      success: true,
      changes,
      since: sinceDate.toISOString()
    });
  } catch (error) {
    console.error('Get changes error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: 'Failed to get changes'
    });
  }
});

// Full sync (replace all data)
app.post('/api/sync/full', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const { books, collections, tags, readings, settings } = req.body;
    
    console.log('Processing full sync for user:', req.user.userId, {
      booksCount: books?.length || 0,
      collectionsCount: collections?.length || 0,
      tagsCount: tags?.length || 0,
      readingsCount: readings?.length || 0,
      hasSettings: !!settings
    });
    
    const result = await fullSync(req.user.userId, {
      books,
      collections,
      tags,
      readings,
      settings
    });
    
    // Clear synced operations after full sync
    await clearSyncedOperations(req.user.userId);
    
    res.json({
      success: true,
      syncedAt: result.syncedAt.toISOString()
    });
  } catch (error) {
    console.error('Full sync error:', error);
    res.status(500).json({
      success: false,
      error: 'FULL_SYNC_FAILED',
      message: 'Full sync failed'
    });
  }
});

// Queue sync operation
app.post('/api/sync/queue', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const { type, entity, entityId, data } = req.body;
    
    if (!type || !entity || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Type, entity, and entityId are required'
      });
    }
    
    const operation = await queueSyncOperation(req.user.userId, {
      type,
      entity,
      entityId,
      data
    });
    
    res.status(201).json({
      success: true,
      operation: {
        id: operation.id,
        type: operation.type,
        entity: operation.entity,
        entityId: operation.entityId,
        timestamp: operation.timestamp,
        synced: operation.synced
      }
    });
  } catch (error) {
    console.error('Queue sync operation error:', error);
    res.status(500).json({
      success: false,
      error: 'QUEUE_FAILED',
      message: 'Failed to queue sync operation'
    });
  }
});

// Mark operations as synced
app.post('/api/sync/mark-synced', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const { operationIds } = req.body;
    
    if (!Array.isArray(operationIds)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Operation IDs must be an array'
      });
    }
    
    await markOperationsSynced(req.user.userId, operationIds);
    
    res.json({
      success: true,
      message: `Marked ${operationIds.length} operations as synced`
    });
  } catch (error) {
    console.error('Mark synced error:', error);
    res.status(500).json({
      success: false,
      error: 'MARK_FAILED',
      message: 'Failed to mark operations as synced'
    });
  }
});

// Clear synced operations
app.delete('/api/sync/clear', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    await clearSyncedOperations(req.user.userId);
    
    res.json({
      success: true,
      message: 'Cleared synced operations'
    });
  } catch (error) {
    console.error('Clear synced operations error:', error);
    res.status(500).json({
      success: false,
      error: 'CLEAR_FAILED',
      message: 'Failed to clear synced operations'
    });
  }
});

// Apply error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Booky backend server running on port ${PORT}`);
});

export default app;