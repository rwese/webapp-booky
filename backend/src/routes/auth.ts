import { Router } from 'express';
import { 
  createUser, 
  loginUser, 
  refreshAccessToken,
  requestPasswordReset,
  getUserById,
  validatePasswordStrength
} from '../auth';
import { authMiddleware } from '../authMiddleware';
import { validateRequest, schemas } from '../security';

const router = Router();

// Register new user
router.post('/register', validateRequest(schemas.registerUser), async (req, res) => {
  try {
    const { email, password, name } = req.body;
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

// Login user
router.post('/login', validateRequest(schemas.loginUser), async (req, res) => {
  try {
    const { email, password } = req.body;
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
router.post('/refresh', async (req, res) => {
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
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email is required'
      });
    }
    
    const { isEmailRegistered } = await import('../auth');
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
router.post('/forgot-password', async (req, res) => {
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

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
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

// Validate password strength
router.post('/validate-password', async (req, res) => {
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

export default router;
