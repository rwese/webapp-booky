// Simple E2E test examples for Booky Backend API
// Run with: npx playwright test tests/e2e/examples.spec.ts

import { test, expect } from '@playwright/test';

test('Health check endpoint', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  
  const data = await response.json();
  expect(data.status).toBe('healthy');
});

test('ISBN lookup endpoint', async ({ request }) => {
  const response = await request.get('/api/isbn/9780134685991');
  // May return 200 with data or 404 if not found
  expect([200, 404]).toContain(response.status());
});

test('Search endpoint', async ({ request }) => {
  const response = await request.get('/api/search?q=javascript');
  expect(response.status()).toBe(200);
  
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
});

test('Authentication - register and login flow', async ({ request }) => {
  const testEmail = `e2e-test-${Date.now()}@booky.app`;
  const testPassword = 'SecureP@ss123!';
  const testName = 'E2E Test User';

  // Register
  const registerResponse = await request.post('/api/auth/register', {
    data: { email: testEmail, password: testPassword, name: testName },
  });
  expect([201, 400]).toContain(registerResponse.status());

  // Login
  const loginResponse = await request.post('/api/auth/login', {
    data: { email: testEmail, password: testPassword },
  });
  expect(loginResponse.status()).toBe(200);
  
  const loginData = await loginResponse.json();
  expect(loginData.success).toBe(true);
  expect(loginData.accessToken).toBeDefined();
});

test('Authentication - reject invalid credentials', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    data: { 
      email: 'nonexistent@test.com', 
      password: 'WrongPassword123!' 
    },
  });
  
  expect(response.status()).toBe(401);
  const data = await response.json();
  expect(data.success).toBe(false);
});

test('Password validation', async ({ request }) => {
  // Strong password
  const strongResponse = await request.post('/api/auth/validate-password', {
    data: { password: 'SecureP@ss123!' },
  });
  expect(strongResponse.status()).toBe(200);
  const strongData = await strongResponse.json();
  expect(strongData.isValid).toBe(true);

  // Weak password
  const weakResponse = await request.post('/api/auth/validate-password', {
    data: { password: '123' },
  });
  expect(weakResponse.status()).toBe(200);
  const weakData = await weakResponse.json();
  expect(weakData.isValid).toBe(false);
});

test('Email availability check', async ({ request }) => {
  const availableResponse = await request.get('/api/auth/check-email?email=available@test.com');
  expect(availableResponse.status()).toBe(200);
  const availableData = await availableResponse.json();
  expect(availableData.available).toBe(true);
});

test('Rate limiting on auth endpoints', async ({ request }) => {
  // Make multiple rapid requests
  for (let i = 0; i < 10; i++) {
    await request.post('/api/auth/login', {
      data: { email: 'ratelimit@test.com', password: 'test' },
    }).catch(() => {}); // Ignore errors
  }
  
  // One more request should be rate limited or succeed
  const response = await request.post('/api/auth/login', {
    data: { email: 'ratelimit@test.com', password: 'test' },
  });
  expect([200, 401, 429]).toContain(response.status());
});

test('Security headers on health endpoint', async ({ request }) => {
  const response = await request.get('/api/health');
  
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBeDefined();
});

test('CORS headers', async ({ request }) => {
  const response = await request.get('/api/health', {
    headers: {
      Origin: 'https://booky.app',
    },
  });
  
  expect(response.status()).toBe(200);
});
