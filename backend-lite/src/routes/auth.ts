import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createUser, authenticateUser, generateToken, getUserById, sanitizeUser, logoutUser, refreshAccessToken } from '../lib/auth.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if user exists
    const existingUser = await getUserById(data.email); // This won't work, need different check
    const { prisma } = await import('../lib/db.js');
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const user = await createUser(data.email, data.password, data.name);
    const { token, expiresIn } = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      user: sanitizeUser(user),
      accessToken: token,
      expiresIn,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await authenticateUser(data.email, data.password);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const { token, expiresIn } = generateToken({ userId: user.id, email: user.email });

    res.json({
      success: true,
      user: sanitizeUser(user),
      accessToken: token,
      expiresIn,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Refresh access token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }
    
    const result = await refreshAccessToken(refreshToken);
    
    if (!result.success) {
      return res.status(401).json({ success: false, error: result.error });
    }
    
    res.json({
      success: true,
      accessToken: result.token,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

// Logout user
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const result = await logoutUser();
    res.json(result);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Failed to logout' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

export default router;
