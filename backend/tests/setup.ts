// Test setup file
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Helper function to create a test user
export const createTestUser = async (prisma: PrismaClient, overrides?: any) => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.Z9y7lCLL1vWKi', // "Password123!"
  };
  
  return prisma.user.create({
    data: { ...defaultUser, ...overrides }
  });
};

// Helper function to create test book
export const createTestBook = async (prisma: PrismaClient, userId: string, overrides?: any) => {
  const defaultBook = {
    userId,
    title: 'Test Book',
    authors: ['Test Author'],
    format: 'physical',
    addedAt: new Date(),
    externalIds: {},
    needsSync: true,
    localOnly: false
  };
  
  return prisma.book.create({
    data: { ...defaultBook, ...overrides }
  });
};

// Helper function to create test collection
export const createTestCollection = async (prisma: PrismaClient, userId: string, overrides?: any) => {
  const defaultCollection = {
    userId,
    name: 'Test Collection',
    isSmart: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  return prisma.collection.create({
    data: { ...defaultCollection, ...overrides }
  });
};

// Helper function to create test tag
export const createTestTag = async (prisma: PrismaClient, userId: string, overrides?: any) => {
  const defaultTag = {
    userId,
    name: 'Test Tag',
    color: '#FF5733',
    createdAt: new Date()
  };
  
  return prisma.tag.create({
    data: { ...defaultTag, ...overrides }
  });
};

// Generate random test data
export const generateRandomEmail = () => `test-${Math.random().toString(36).substring(7)}@example.com`;
export const generateRandomString = (length: number) => Math.random().toString(36).substring(2, 2 + length);

// Mock JWT for testing
export const createMockToken = (userId: string, expiresIn: string = '1h') => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId, email: 'test@example.com', type: 'access' },
    process.env.AUTH_SECRET || 'test-secret',
    { expiresIn }
  );
};

// Wait helper
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
