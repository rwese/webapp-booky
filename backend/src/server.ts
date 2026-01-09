import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Apply error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Booky backend server running on port ${PORT}`);
});

export default app;