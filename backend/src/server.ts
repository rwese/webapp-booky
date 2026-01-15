import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import dotenv from 'dotenv';
import { 
  initializeDatabase, 
  bookService, 
  syncService,
  collectionService,
  tagService,
  readingLogService 
} from './database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database connection
initializeDatabase().catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

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

// Search endpoint
app.get('/api/search', async (req: Request, res: Response, next: NextFunction) => {
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

// Book CRUD endpoints
app.get('/api/books', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const books = await bookService.getAll(userId);
    res.json(books);
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Failed to get books' });
  }
});

app.get('/api/books/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const book = await bookService.getById(id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json(book);
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ error: 'Failed to get book' });
  }
});

app.post('/api/books', async (req: Request, res: Response) => {
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

app.post('/api/collections', async (req: Request, res: Response) => {
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

app.post('/api/tags', async (req: Request, res: Response) => {
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

// Sync endpoints
app.post('/api/sync/operations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, operations } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations must be an array' });
    }
    
    // Process each operation
    const results = [];
    for (const operation of operations) {
      try {
        // Queue the sync operation in the database
        const syncedOp = await syncService.queueOperation(userId, {
          type: operation.type,
          entity: operation.entity,
          entityId: operation.entityId,
          data: operation.data
        });
        
        results.push({ 
          id: syncedOp.id, 
          status: 'success',
          entity: operation.entity,
          entityId: operation.entityId
        });
      } catch (error) {
        results.push({ 
          id: operation.id || 'unknown', 
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Sync operations error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get sync status
app.get('/api/sync/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get pending operations count from database
    const pendingOperations = await syncService.getPendingOperations(userId);
    
    res.json({ 
      status: 'ready',
      lastSync: null,
      pendingOperations: pendingOperations.length
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Sync full data dump (for initial sync or complete resync)
app.post('/api/sync/full', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, books, collections, tags, readings } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    console.log('Processing full sync with', {
      booksCount: books?.length || 0,
      collectionsCount: collections?.length || 0,
      tagsCount: tags?.length || 0,
      readingsCount: readings?.length || 0
    });
    
    // TODO: Implement full sync logic with proper transaction handling
    // For now, just return success
    res.json({ 
      status: 'success',
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Full sync error:', error);
    res.status(500).json({ error: 'Full sync failed' });
  }
});

// Apply error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Booky backend server running on port ${PORT}`);
});

export default app;