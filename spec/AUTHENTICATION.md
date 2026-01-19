# User Authentication System

## Overview

This document describes the comprehensive authentication system implemented for the Booky web application backend. The system provides secure user authentication with JWT tokens, password hashing, OAuth support, and session management.

## Features

### Core Authentication

- **User Registration** - Secure account creation with email/password
- **User Login** - Email/password authentication
- **Password Reset** - Token-based password recovery
- **Profile Management** - Update user information
- **Account Deletion** - Secure account removal

### Security Features

- **Password Hashing** - bcrypt with 12 rounds (configurable)
- **JWT Tokens** - Access and refresh token system
- **Password Strength Validation** - Enforces strong passwords
- **Rate Limiting** - 100 requests per 15 minutes
- **Email Validation** - Format and availability checking

### OAuth Integration

- **Google** - OAuth 2.0 authentication
- **GitHub** - OAuth authentication
- **Discord** - OAuth authentication
- **Apple** - Sign in with Apple

## Technology Stack

- **Language**: TypeScript 5.3
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL with Prisma 7.2
- **Password Hashing**: bcrypt (12 rounds)
- **Token Management**: jsonwebtoken
- **Security**: helmet, cors, rate-limit

## API Endpoints

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "name": "John Doe"
}
```

**Response (201 Created)**:

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

#### Login User

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://..."
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

#### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbG..."
}
```

#### Check Email Availability

```http
GET /api/auth/check-email?email=user@example.com
```

**Response (200 OK)**:

```json
{
  "success": true,
  "available": true,
  "email": "user@example.com"
}
```

#### Request Password Reset

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link will be sent."
}
```

#### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-here",
  "password": "NewSecureP@ss123"
}
```

#### Get Current User (Authenticated)

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://...",
    "emailVerified": "2024-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Update Profile (Authenticated)

```http
PUT /api/auth/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "image": "https://new-image-url.com/photo.jpg"
}
```

#### Change Password (Authenticated)

```http
POST /api/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "OldSecureP@ss123",
  "newPassword": "NewSecureP@ss123"
}
```

#### Delete Account (Authenticated)

```http
DELETE /api/auth/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "password": "CurrentPassword123"
}
```

#### OAuth Authentication

```http
POST /api/auth/oauth
Content-Type: application/json

{
  "provider": "google",
  "providerId": "google-user-id",
  "email": "user@gmail.com",
  "name": "Google User",
  "image": "https://google-user-image.com/photo.jpg"
}
```

#### Validate Password Strength

```http
POST /api/auth/validate-password
Content-Type: application/json

{
  "password": "SecureP@ss123"
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "valid": true,
  "message": "Password meets strength requirements"
}
```

## Token System

### Access Token

- **Purpose**: Authenticate API requests
- **Expires**: 30 days (configurable)
- **Payload**: userId, email, token type

### Refresh Token

- **Purpose**: Obtain new access tokens
- **Expires**: 60 days (configurable)
- **Payload**: userId, email, token type

### Token Structure

```json
{
  "userId": "abc123",
  "email": "user@example.com",
  "type": "access",
  "iat": 1704067200,
  "exp": 1706745600
}
```

## Password Requirements

Passwords must meet the following criteria:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Security Measures

### Password Hashing

- Algorithm: bcrypt
- Rounds: 12 (configurable via `AUTH_BCRYPT_ROUNDS`)
- Salt: Automatic

### JWT Security

- Algorithm: HS256
- Secret: From `AUTH_SECRET` environment variable
- Token expiration: Configurable

### Rate Limiting

- 100 requests per 15-minute window
- Applies to all `/api/` endpoints

### Input Validation

- Email format validation
- Password strength enforcement
- SQL injection prevention via Prisma
- XSS prevention via helmet

## Environment Variables

```env
# Required
AUTH_SECRET="your-super-secret-jwt-key-change-in-production"

# Token Configuration
AUTH_JWT_EXPIRES_IN="30d"
AUTH_REFRESH_TOKEN_EXPIRES_IN="60d"
AUTH_PASSWORD_RESET_EXPIRES_IN="1h"
AUTH_BCRYPT_ROUNDS="12"

# OAuth Providers (set to 'true' to enable)
AUTH_ENABLE_GOOGLE="false"
AUTH_ENABLE_GITHUB="false"
AUTH_ENABLE_DISCORD="false"
AUTH_ENABLE_APPLE="false"

# OAuth Credentials (fill when enabling providers)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_DISCORD_ID=""
AUTH_DISCORD_SECRET=""
AUTH_APPLE_ID=""
AUTH_APPLE_SECRET=""
```

## Database Schema

### User Model

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String?
  password            String?   // Hashed password
  image               String?
  emailVerified       DateTime? @default(now())
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Authentication fields
  passwordResetToken  String?
  passwordResetExpires DateTime?
  oauthProvider       String?
  oauthProviderId     String?
  lastLoginAt         DateTime?
  loginCount          Int       @default(0)

  // Relations
  settings            UserSettings?
  books               Book[]
  // ... other relations

  @@index([email])
  @@index([oauthProvider, oauthProviderId])
}
```

## Error Codes

| Code                    | Description                        |
| ----------------------- | ---------------------------------- |
| `VALIDATION_ERROR`      | Missing or invalid input data      |
| `EMAIL_EXISTS`          | Email already registered           |
| `INVALID_EMAIL`         | Invalid email format               |
| `INVALID_CREDENTIALS`   | Wrong email or password            |
| `OAUTH_ONLY`            | Account uses OAuth only            |
| `INVALID_REFRESH_TOKEN` | Invalid or expired refresh token   |
| `INVALID_TOKEN`         | Invalid or expired reset token     |
| `WEAK_PASSWORD`         | Password doesn't meet requirements |
| `UNAUTHORIZED`          | Not authenticated                  |
| `USER_NOT_FOUND`        | User doesn't exist                 |

## Integration with Frontend

The backend authentication system is designed to work seamlessly with the existing NextAuth.js frontend:

### Token Usage

1. Frontend stores access and refresh tokens
2. Include token in API requests: `Authorization: Bearer <access_token>`
3. Use refresh token to get new access token when expired

### Frontend Integration Example

```typescript
// Login
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
})

const { accessToken, refreshToken, user } = await response.json()
localStorage.setItem("accessToken", accessToken)
localStorage.setItem("refreshToken", refreshToken)

// Authenticated request
const authResponse = await fetch("/api/books", {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  },
})
```

### Token Refresh Strategy

```typescript
async function fetchWithAuth(url, options = {}) {
  let accessToken = localStorage.getItem("accessToken")

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 401) {
    // Token expired, try refresh
    const refreshToken = localStorage.getItem("refreshToken")
    const refreshResponse = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })

    if (refreshResponse.ok) {
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await refreshResponse.json()

      localStorage.setItem("accessToken", newAccessToken)
      localStorage.setItem("refreshToken", newRefreshToken)

      // Retry original request
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newAccessToken}`,
        },
      })
    } else {
      // Refresh failed, redirect to login
      window.location.href = "/login"
    }
  }

  return response
}
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:e2e
```

### Test Coverage

- Password hashing and verification
- JWT token generation and validation
- User registration and login
- Password reset flow
- Profile updates
- OAuth authentication

## Deployment

### Production Setup

1. Set strong `AUTH_SECRET` environment variable
2. Configure token expiration times
3. Enable HTTPS
4. Set up email service for password reset
5. Configure OAuth provider credentials

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Future Improvements

- **Email Verification** - Send verification emails on registration
- **Two-Factor Authentication** - TOTP-based 2FA
- **Session Management** - View and revoke active sessions
- **Login History** - Track login locations and devices
- **Security Alerts** - Notify users of suspicious activity
- **Passwordless Authentication** - Magic links via email
- **Biometric Authentication** - Mobile app biometric support
