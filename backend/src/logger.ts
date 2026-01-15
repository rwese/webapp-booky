// Structured JSON Logger for Booky Backend
// File: backend/src/logger.ts

import winston from 'winston';
import crypto from 'crypto';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] }),
  winston.format.json()
);

// Pretty format for development
const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }: any) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Fields to redact from logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'accessToken',
  'refreshToken',
  'apiKey',
  'credential'
];

// Redact sensitive data from objects
function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveData(value);
      }
    }
    return result;
  }

  return obj;
}

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? structuredFormat : prettyFormat,
  defaultMeta: {
    service: 'booky-backend',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console output
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test'
    })
  ]
});

// Request context type
interface RequestContext {
  requestId?: string;
  userId?: string;
  method?: string;
  route?: string;
  ip?: string;
  userAgent?: string;
}

// Create a child logger with request context
export function createRequestLogger(context: RequestContext) {
  return logger.child(redactSensitiveData(context));
}

// Request ID middleware
export function requestIdMiddleware(req: any, res: any, next: any) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

// Request logging middleware
export function requestLoggerMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      requestId: req.requestId,
      userId: req.user?.userId,
      method: req.method,
      route: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: res.get('content-length')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
}

// Error logging helper
export function logError(error: Error, context?: RequestContext) {
  const logContext = redactSensitiveData(context || {});
  logger.error('Error occurred', {
    ...logContext,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  });
}

// Performance logging helper
export function logPerformance(operation: string, duration: number, context?: RequestContext) {
  const logContext = redactSensitiveData(context || {});
  logger.info('Operation completed', {
    ...logContext,
    operation,
    duration,
    performanceThreshold: duration > 1000 ? 'slow' : 'normal'
  });
}

// Export types for use in other modules
export type { RequestContext };
