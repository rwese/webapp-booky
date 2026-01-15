import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { z, ZodError } from 'zod';
import crypto from 'crypto';

// ==================== RATE LIMITING ====================

// Global rate limiter (already in server.ts)
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window for auth endpoints
  message: {
    success: false,
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Per-user rate limiter factory
export const createUserRateLimiter = (maxRequests: number = 1000, windowMs: number = 3600000) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req: Request): string => req.user?.userId || req.ip || 'anonymous',
    message: {
      success: false,
      error: 'USER_RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded for this user.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health';
    }
  });
};

// Endpoint-specific rate limiters
export const syncRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 sync requests per minute
  message: {
    success: false,
    error: 'SYNC_RATE_LIMIT_EXCEEDED',
    message: 'Too many sync requests, please try again later.'
  }
});

export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 search requests per minute
  message: {
    success: false,
    error: 'SEARCH_RATE_LIMIT_EXCEEDED',
    message: 'Too many search requests, please try again later.'
  }
});

// ==================== REQUEST VALIDATION ====================

// Common validation schemas
export const schemas = {
  // User schemas
  registerUser: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional()
  }),

  loginUser: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
  }),

  // Book schemas
  createBook: z.object({
    title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
    subtitle: z.string().max(500, 'Subtitle too long').optional(),
    authors: z.array(z.string()).min(1, 'At least one author is required'),
    isbn13: z.string().regex(/^(97(8|9))?\d{9}(\d|X)$/, 'Invalid ISBN-13').optional(),
    coverUrl: z.string().url('Invalid cover URL').optional(),
    description: z.string().max(5000, 'Description too long').optional(),
    publisher: z.string().max(200, 'Publisher name too long').optional(),
    publishedYear: z.number().min(1000, 'Invalid year').max(new Date().getFullYear() + 10, 'Invalid year').optional(),
    pageCount: z.number().positive('Page count must be positive').optional(),
    format: z.enum(['physical', 'kindle', 'kobo', 'audible', 'audiobook', 'pdf', 'other']).optional()
  }),

  updateBook: z.object({
    title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
    subtitle: z.string().max(500, 'Subtitle too long').optional(),
    authors: z.array(z.string()).min(1, 'At least one author is required').optional(),
    coverUrl: z.string().url('Invalid cover URL').optional(),
    description: z.string().max(5000, 'Description too long').optional(),
    pageCount: z.number().positive('Page count must be positive').optional()
  }),

  // Collection schemas
  createCollection: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    isSmart: z.boolean().optional(),
    smartRules: z.array(z.object({
      field: z.enum(['rating', 'format', 'tags', 'status', 'year']),
      operator: z.enum(['equals', 'notEquals', 'greaterThan', 'lessThan', 'contains']),
      value: z.union([z.string(), z.number()])
    })).optional()
  }),

  updateCollection: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
    description: z.string().max(1000, 'Description too long').optional()
  }),

  // Tag schemas
  createTag: z.object({
    name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
  }),

  updateTag: z.object({
    name: z.string().min(1, 'Name is required').max(50, 'Name too long').optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional()
  }),

  // Sync schemas
  syncOperation: z.object({
    id: z.string().optional(),
    type: z.enum(['create', 'update', 'delete']),
    entity: z.enum(['book', 'rating', 'tag', 'collection', 'readingLog', 'userSettings']),
    entityId: z.string().min(1, 'Entity ID is required'),
    data: z.any().optional(),
    timestamp: z.date().optional()
  }),

  syncBatch: z.object({
    operations: z.array(z.object({
      id: z.string().optional(),
      type: z.enum(['create', 'update', 'delete']),
      entity: z.enum(['book', 'rating', 'tag', 'collection', 'readingLog', 'userSettings']),
      entityId: z.string().min(1, 'Entity ID is required'),
      data: z.any().optional(),
      timestamp: z.date().optional()
    })).min(1, 'At least one operation is required')
  }),

  // Generic pagination
  pagination: z.object({
    page: z.number().positive().optional().default(1),
    limit: z.number().positive().max(100).optional().default(20)
  })
};

// Validation middleware factory
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: (error as any).errors.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      return res.status(500).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Internal validation error'
      });
    }
  };
};

// Query validation middleware
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedQuery = schema.parse(req.query);
      req.query = validatedQuery as Record<string, string>;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: (error as any).errors.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      return res.status(500).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Internal validation error'
      });
    }
  };
};

// ==================== SECURITY HEADERS ====================

// Configure helmet with custom security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

// ==================== CORS CONFIGURATION ====================

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://booky.app',
      'https://www.booky.app'
    ];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

// ==================== INPUT SANITIZATION ====================

// Sanitize string inputs to prevent XSS
export const sanitizeString = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Sanitize object recursively
export const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }
  
  return obj;
};

// XSS protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as Record<string, string>;
  }
  
  next();
};

// SQL injection protection is handled by Prisma (parameterized queries)
// Additional protection for raw SQL if needed
export const validateSqlInput = (input: string): boolean => {
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /(\w*)\s*=\s*(\w*)/i,
    /(\%27)|(\')|(\-\-)|(\%3B)|(;)/i,
    /\w*(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\')|(\-\-)|(\%23)|(#))/i
  ];
  
  return !sqlPatterns.some(pattern => pattern.test(input));
};

// ==================== AUDIT LOGGING ====================

interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  ip: string;
  userAgent: string;
  status: 'success' | 'failure';
  details?: any;
}

// In-memory audit log (use database in production)
const auditLogs: AuditLogEntry[] = [];

// Audit log storage configuration
const MAX_AUDIT_LOGS = 10000;

// Create audit log entry
export const createAuditLog = (entry: Omit<AuditLogEntry, 'timestamp'>): void => {
  const logEntry: AuditLogEntry = {
    timestamp: new Date(),
    ...entry
  };
  
  auditLogs.push(logEntry);
  
  // Trim old logs if exceeding max
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.splice(0, auditLogs.length - MAX_AUDIT_LOGS);
  }
  
  // In production, also write to database or logging service
  console.log(`[AUDIT] ${logEntry.action} ${logEntry.entity} ${logEntry.entityId || ''} - ${logEntry.status}`);
};

// Audit middleware factory
export const auditMiddleware = (action: string, entity: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      const status = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';
      
      createAuditLog({
        userId: (req as any).user?.userId,
        action,
        entity,
        entityId: req.params.id,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        status,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode
        }
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Sensitive operation audit helpers
export const auditAuthOperation = (req: Request, success: boolean, details?: any) => {
  createAuditLog({
    userId: (req as any).user?.userId,
    action: 'AUTH_OPERATION',
    entity: 'authentication',
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    status: success ? 'success' : 'failure',
    details
  });
};

export const auditDataChange = (req: Request, entity: string, entityId: string, success: boolean) => {
  createAuditLog({
    userId: (req as any).user?.userId,
    action: 'DATA_CHANGE',
    entity,
    entityId,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    status: success ? 'success' : 'failure'
  });
};

// ==================== API VERSIONING ====================

// API version configuration
export const API_VERSIONS = {
  v1: '1.0',
  v2: '2.0'
};

// Version detection middleware
export const versionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check URL path for version
  const pathMatch = req.path.match(/^\/api\/v(\d+)/);
  
  if (pathMatch) {
    (req as any).apiVersion = pathMatch[1];
    return next();
  }
  
  // Check Accept header for version
  const acceptVersion = req.get('Accept-Version');
  
  if (acceptVersion) {
    (req as any).apiVersion = acceptVersion;
    return next();
  }
  
  // Default to v1
  (req as any).apiVersion = '1';
  next();
};

// Version-aware response wrapper
export const versionAwareResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    const version = (req as any).apiVersion || '1';
    
    // Add version info to response
    const response = {
      ...data,
      _meta: {
        version,
        timestamp: new Date().toISOString()
      }
    };
    
    return originalJson.call(this, response);
  };
  
  next();
};

// ==================== REQUEST TIMEOUT ====================

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout header
    res.set('X-Request-Timeout', timeoutMs.toString());
    
    // Handle timeout
    req.setTimeout(timeoutMs, () => {
      res.status(408).json({
        success: false,
        error: 'REQUEST_TIMEOUT',
        message: 'Request timed out'
      });
    });
    
    next();
  };
};

// ==================== ERROR HANDLING ====================

// Security error handler
export const securityErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log security-related errors
  console.error('[SECURITY ERROR]', err.message);
  
  // Handle specific security errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS_ERROR',
      message: 'Access denied by CORS policy'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired'
    });
  }
  
  // Generic security error
  res.status(500).json({
    success: false,
    error: 'SECURITY_ERROR',
    message: 'A security error occurred'
  });
};

export default {
  // Rate limiting
  globalRateLimiter,
  authRateLimiter,
  createUserRateLimiter,
  syncRateLimiter,
  searchRateLimiter,
  
  // Validation
  schemas,
  validateRequest,
  validateQuery,
  
  // Security headers
  securityHeaders,
  
  // CORS
  corsOptions,
  
  // Input sanitization
  sanitizeString,
  sanitizeObject,
  xssProtection,
  validateSqlInput,
  
  // Audit logging
  createAuditLog,
  auditMiddleware,
  auditAuthOperation,
  auditDataChange,
  
  // API versioning
  versionMiddleware,
  versionAwareResponse,
  
  // Request timeout
  requestTimeout,
  
  // Error handling
  securityErrorHandler
};
