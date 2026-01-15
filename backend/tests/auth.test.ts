import request from 'supertest';
import express, { Express } from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config({ path: '.env.test' });

import authRoutes from '../src/routes/auth';
import { authMiddleware } from '../src/authMiddleware';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
};

describe('Authentication API', () => {
  let app: Express;
  let prisma: PrismaClient;
  
  beforeAll(() => {
    app = createTestApp();
    prisma = new PrismaClient();
  });
  
  afterAll(async () => {
    // Clean up test data
    await prisma.syncOperation.deleteMany({});
    await prisma.readingLog.deleteMany({});
    await prisma.collectionBook.deleteMany({});
    await prisma.collection.deleteMany({});
    await prisma.bookTag.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.rating.deleteMany({});
    await prisma.book.deleteMany({});
    await prisma.userSettings.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });
  
  beforeEach(async () => {
    // Clean up before each test
    await prisma.syncOperation.deleteMany({});
    await prisma.readingLog.deleteMany({});
    await prisma.collectionBook.deleteMany({});
    await prisma.collection.deleteMany({});
    await prisma.bookTag.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.rating.deleteMany({});
    await prisma.book.deleteMany({});
    await prisma.userSettings.deleteMany({});
    await prisma.user.deleteMany({});
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecureP@ss123',
          name: 'New User'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.name).toBe('New User');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });
    
    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecureP@ss123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
    
    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('WEAK_PASSWORD');
    });
    
    it('should reject registration with duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecureP@ss123'
        });
      
      // Try to create duplicate
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecureP@ss123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('EMAIL_EXISTS');
    });
    
    it('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const hashedPassword = await bcrypt.hash('SecureP@ss123', 12);
      await prisma.user.create({
        data: {
          email: 'logintest@example.com',
          name: 'Login Test',
          password: hashedPassword
        }
      });
    });
    
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'SecureP@ss123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });
    
    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'WrongPassword123!'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });
    
    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecureP@ss123'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // First register to get tokens
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'refreshtest@example.com',
          password: 'SecureP@ss123'
        });
      
      const { refreshToken } = registerResponse.body;
      
      // Refresh the token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });
    
    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_REFRESH_TOKEN');
    });
  });
  
  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      // Register and get token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'profiletest@example.com',
          password: 'SecureP@ss123'
        });
      
      const { accessToken } = registerResponse.body;
      
      // Get profile
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('profiletest@example.com');
    });
    
    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/auth/check-email', () => {
    beforeEach(async () => {
      // Create a test user
      await prisma.user.create({
        data: {
          email: 'taken@example.com',
          name: 'Taken User',
          password: await bcrypt.hash('SecureP@ss123', 12)
        }
      });
    });
    
    it('should return available for unregistered email', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'available@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.available).toBe(true);
    });
    
    it('should return not available for registered email', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'taken@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.available).toBe(false);
    });
  });
  
  describe('POST /api/auth/validate-password', () => {
    it('should validate strong password', async () => {
      const response = await request(app)
        .post('/api/auth/validate-password')
        .send({ password: 'SecureP@ss123!' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
    });
    
    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/validate-password')
        .send({ password: 'weak' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(false);
    });
  });
});
