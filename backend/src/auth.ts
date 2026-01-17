import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { sendEmail, getPasswordResetEmailHtml, getPasswordResetEmailText } from './emailService';

dotenv.config();

// Configuration
const JWT_SECRET = process.env.AUTH_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.AUTH_JWT_EXPIRES_IN || '30d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN || '60d';
const BCRYPT_ROUNDS = parseInt(process.env.AUTH_BCRYPT_ROUNDS || '12');
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Rate limiting configuration for password reset
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '3');

// In-memory rate limit store (use Redis in production)
const resetRequestStore = new Map<string, { count: number; resetTime: number }>();

// Types
export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

interface AuthResult {
  success: boolean;
  message?: string;
  user?: Partial<User>;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Get Prisma client
const getPrismaClient = () => {
  return new PrismaClient();
};

// ==================== RATE LIMITING ====================

/**
 * Check if rate limit is exceeded for password reset
 * Returns { allowed: true } if within limits, or { allowed: false, retryAfter: seconds } if exceeded
 */
function checkPasswordResetRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = resetRequestStore.get(email);

  if (!record) {
    // First request in window
    resetRequestStore.set(email, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (now > record.resetTime) {
    // Window has expired, reset count
    resetRequestStore.set(email, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  record.count++;
  return { allowed: true };
}

/**
 * Clean up expired rate limit records (call periodically in production)
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [email, record] of resetRequestStore.entries()) {
    if (now > record.resetTime) {
      resetRequestStore.delete(email);
    }
  }
}

// ==================== PASSWORD UTILITIES ====================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check password strength
 */
export function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  
  return { valid: true, message: 'Password meets strength requirements' };
}

// ==================== TOKEN UTILITIES ====================

/**
 * Generate a JWT token
 */
export function generateToken(payload: TokenPayload, expiresIn: string = JWT_EXPIRES_IN): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Generate access and refresh token pair
 */
export function generateTokenPair(user: User): TokenPair {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    type: 'access'
  };
  
  const accessToken = generateToken(payload, JWT_EXPIRES_IN);
  const refreshToken = generateToken({ ...payload, type: 'refresh' }, REFRESH_TOKEN_EXPIRES_IN);
  
  // Calculate expiresIn in seconds
  const expiresIn = jwt.decode(accessToken) as { exp: number };
  const expiresInSeconds = expiresIn.exp - Math.floor(Date.now() / 1000);
  
  return {
    accessToken,
    refreshToken,
    expiresIn: expiresInSeconds
  };
}

/**
 * Generate password reset token
 */
export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== USER OPERATIONS ====================

/**
 * Check if email is already registered
 */
export async function isEmailRegistered(email: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
  return !!user;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const prisma = getPrismaClient();
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const prisma = getPrismaClient();
  return prisma.user.findUnique({
    where: { id }
  });
}

/**
 * Create a new user
 */
export async function createUser(input: RegisterInput): Promise<AuthResult> {
  const prisma = getPrismaClient();
  
  // Check if email is already registered
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });
  
  if (existingUser) {
    return {
      success: false,
      message: 'Email is already registered',
      error: 'EMAIL_EXISTS'
    };
  }
  
  // Validate password strength
  const passwordValidation = validatePasswordStrength(input.password);
  if (!passwordValidation.valid) {
    return {
      success: false,
      message: passwordValidation.message,
      error: 'WEAK_PASSWORD'
    };
  }
  
  try {
    // Hash password
    const hashedPassword = await hashPassword(input.password);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name || input.email.split('@')[0],
        password: hashedPassword
      }
    });
    
    // Generate tokens
    const tokens = generateTokenPair(user);
    
    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      success: false,
      message: 'Failed to create user',
      error: 'CREATE_FAILED'
    };
  }
}

/**
 * Authenticate user with email and password
 */
export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const prisma = getPrismaClient();
  
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });
  
  if (!user) {
    return {
      success: false,
      message: 'Invalid email or password',
      error: 'INVALID_CREDENTIALS'
    };
  }
  
  // Check if user has a password (might be OAuth-only user)
  if (!user.password) {
    return {
      success: false,
      message: 'This account uses OAuth authentication. Please sign in with the associated provider.',
      error: 'OAUTH_ONLY'
    };
  }
  
  // Verify password
  const isValid = await verifyPassword(input.password, user.password);
  if (!isValid) {
    return {
      success: false,
      message: 'Invalid email or password',
      error: 'INVALID_CREDENTIALS'
    };
  }
  
  try {
    // Update login count and last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 }
      }
    });
    
    // Generate tokens
    const tokens = generateTokenPair(user);
    
    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  } catch (error) {
    console.error('Error during login:', error);
    return {
      success: false,
      message: 'Login failed',
      error: 'LOGIN_FAILED'
    };
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  // Verify the refresh token
  const decoded = verifyToken(refreshToken);
  
  if (!decoded || decoded.type !== 'refresh') {
    return {
      success: false,
      message: 'Invalid refresh token',
      error: 'INVALID_REFRESH_TOKEN'
    };
  }
  
  // Get user
  const user = await getUserById(decoded.userId);
  
  if (!user) {
    return {
      success: false,
      message: 'User not found',
      error: 'USER_NOT_FOUND'
    };
  }
  
  // Generate new tokens
  const tokens = generateTokenPair(user);
  
  return {
    success: true,
    message: 'Token refreshed successfully',
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const prisma = getPrismaClient();
  const normalizedEmail = email.toLowerCase();

  // Check rate limit
  const rateLimit = checkPasswordResetRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return {
      success: false,
      message: 'Too many password reset requests. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
    };
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    // Don't reveal whether user exists - still check rate limit
    return {
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.'
    };
  }

  try {
    // Generate reset token
    const resetToken = generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      }
    });

    // Generate reset link
    const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

    // Send email with reset link
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: getPasswordResetEmailHtml(resetLink),
      text: getPasswordResetEmailText(resetLink)
    });

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Still return success to avoid revealing email existence
    }

    return {
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.'
    };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return {
      success: false,
      message: 'Failed to process password reset request',
      error: 'RESET_FAILED'
    };
  }
}

/**
 * Reset password with reset token
 */
export async function resetPassword(token: string, newPassword: string): Promise<AuthResult> {
  const prisma = getPrismaClient();
  
  // Validate new password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    return {
      success: false,
      message: passwordValidation.message,
      error: 'WEAK_PASSWORD'
    };
  }
  
  // Find user with valid reset token
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        gt: new Date()
      }
    }
  });
  
  if (!user) {
    return {
      success: false,
      message: 'Invalid or expired reset token',
      error: 'INVALID_TOKEN'
    };
  }
  
  try {
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });
    
    return {
      success: true,
      message: 'Password reset successful. Please log in with your new password.'
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      success: false,
      message: 'Failed to reset password',
      error: 'RESET_FAILED'
    };
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, data: { name?: string; image?: string }): Promise<AuthResult> {
  const prisma = getPrismaClient();
  
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data
    });
    
    return {
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      }
    };
  } catch (error) {
    console.error('Error updating profile:', error);
    return {
      success: false,
      message: 'Failed to update profile',
      error: 'UPDATE_FAILED'
    };
  }
}

/**
 * Change password
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
  const prisma = getPrismaClient();
  
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    return {
      success: false,
      message: 'User not found',
      error: 'USER_NOT_FOUND'
    };
  }
  
  // Verify current password
  if (user.password) {
    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      return {
        success: false,
        message: 'Current password is incorrect',
        error: 'INVALID_PASSWORD'
      };
    }
  } else {
    return {
      success: false,
      message: 'This account uses OAuth authentication. Password cannot be changed.',
      error: 'OAUTH_ONLY'
    };
  }
  
  // Validate new password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    return {
      success: false,
      message: passwordValidation.message,
      error: 'WEAK_PASSWORD'
    };
  }
  
  try {
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
    
    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (error) {
    console.error('Error changing password:', error);
    return {
      success: false,
      message: 'Failed to change password',
      error: 'CHANGE_FAILED'
    };
  }
}

/**
 * Delete user account
 */
export async function deleteUserAccount(userId: string, password: string): Promise<AuthResult> {
  const prisma = getPrismaClient();
  
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    return {
      success: false,
      message: 'User not found',
      error: 'USER_NOT_FOUND'
    };
  }
  
  // Verify password if user has one
  if (user.password) {
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return {
        success: false,
        message: 'Password is incorrect',
        error: 'INVALID_PASSWORD'
      };
    }
  }
  
  try {
    // Delete user (cascade will delete all related data)
    await prisma.user.delete({
      where: { id: userId }
    });
    
    return {
      success: true,
      message: 'Account deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting account:', error);
    return {
      success: false,
      message: 'Failed to delete account',
      error: 'DELETE_FAILED'
    };
  }
}

// ==================== OAUTH OPERATIONS ====================

/**
 * Find or create user from OAuth provider
 */
export async function findOrCreateOAuthUser(
  provider: string,
  providerId: string,
  email: string,
  name?: string,
  image?: string
): Promise<AuthResult> {
  const prisma = getPrismaClient();
  
  // Try to find existing user by OAuth provider
  let user = await prisma.user.findFirst({
    where: {
      oauthProvider: provider,
      oauthProviderId: providerId
    }
  });
  
  if (user) {
    // Update user info
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name || user.name,
        image: image || user.image,
        lastLoginAt: new Date(),
        loginCount: { increment: 1 }
      }
    });
  } else {
    // Check if user exists by email
    const existingByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (existingByEmail) {
      // Link OAuth to existing account
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          oauthProvider: provider,
          oauthProviderId: providerId,
          image: image || existingByEmail.image,
          lastLoginAt: new Date(),
          loginCount: { increment: 1 }
        }
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          image,
          oauthProvider: provider,
          oauthProviderId: providerId,
          emailVerified: new Date() // OAuth emails are typically verified
        }
      });
    }
  }
  
  // Generate tokens
  const tokens = generateTokenPair(user);
  
  return {
    success: true,
    message: 'OAuth authentication successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

export default {
  // Password utilities
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  
  // Token utilities
  generateToken,
  verifyToken,
  generateTokenPair,
  generatePasswordResetToken,
  
  // User operations
  isEmailRegistered,
  getUserByEmail,
  getUserById,
  createUser,
  loginUser,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
  updateUserProfile,
  changePassword,
  deleteUserAccount,
  
  // OAuth operations
  findOrCreateOAuthUser
};
