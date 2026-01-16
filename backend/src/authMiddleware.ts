import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from './auth';

// Extend Express Request type
declare module 'express' {
  interface Request {
    user?: TokenPayload;
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'No authorization token provided'
    });
  }
  
  // Extract token
  const token = authHeader.substring(7);
  
  // Verify token
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired token'
    });
  }
  
  // Check token type
  if (decoded.type !== 'access') {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN_TYPE',
      message: 'Invalid token type. Expected access token.'
    });
  }
  
  // Attach user to request
  req.user = decoded;
  
  next();
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  // Extract token
  const token = authHeader.substring(7);
  
  // Verify token
  const decoded = verifyToken(token);
  
  if (decoded && decoded.type === 'access') {
    req.user = decoded;
  }
  
  next();
}

/**
 * Error handling middleware for authentication errors
 */
export function authErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'TOKEN_EXPIRED',
      message: 'Token has expired'
    });
  }
  
  next(err);
}

export default {
  authMiddleware,
  optionalAuthMiddleware,
  authErrorHandler
};
