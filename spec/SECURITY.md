# API Rate Limiting & Security

## Overview

This document describes the comprehensive security measures implemented for the Booky API, including rate limiting, request validation, input sanitization, audit logging, and API versioning.

## Security Features

### Rate Limiting

The API implements multiple layers of rate limiting to prevent abuse:

#### Global Rate Limiter

- **Limit**: 100 requests per 15-minute window
- **Scope**: All `/api/` endpoints
- **Purpose**: Prevent overall API abuse

```http
HTTP/1.1 429 Too Many Requests
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later."
}
```

#### Authentication Rate Limiter

- **Limit**: 10 requests per 15-minute window
- **Scope**: Authentication endpoints (`/api/auth/*`)
- **Purpose**: Prevent brute force attacks

```http
HTTP/1.1 429 Too Many Requests
{
  "success": false,
  "error": "AUTH_RATE_LIMIT_EXCEEDED",
  "message": "Too many authentication attempts, please try again later."
}
```

#### Sync Rate Limiter

- **Limit**: 30 requests per minute
- **Scope**: Sync endpoints (`/api/sync/*`)
- **Purpose**: Prevent sync abuse

#### Search Rate Limiter

- **Limit**: 20 requests per minute
- **Scope**: Search endpoint (`/api/search`)
- **Purpose**: Prevent search abuse

#### Per-User Rate Limiter

- **Default Limit**: 1000 requests per hour
- **Scope**: Per authenticated user
- **Purpose**: Individual user rate limits

```typescript
import { createUserRateLimiter } from "./security"

const userRateLimiter = createUserRateLimiter(1000, 3600000) // 1000 requests per hour
app.use("/api/", userRateLimiter)
```

### Request Validation

All incoming requests are validated using Zod schemas:

#### Validation Schemas

**User Registration**:

```typescript
const registerUser = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character"
    ),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .optional(),
})
```

**Book Creation**:

```typescript
const createBook = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  subtitle: z.string().max(500, "Subtitle too long").optional(),
  authors: z.array(z.string()).min(1, "At least one author is required"),
  isbn13: z
    .string()
    .regex(/^(97(8|9))?\d{9}(\d|X)$/, "Invalid ISBN-13")
    .optional(),
  coverUrl: z.string().url("Invalid cover URL").optional(),
  description: z.string().max(5000, "Description too long").optional(),
})
```

#### Validation Error Response

```http
HTTP/1.1 400 Bad Request
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    },
    {
      "field": "password",
      "message": "Password must contain at least one special character"
    }
  ]
}
```

### Input Sanitization

#### XSS Protection

All user input is sanitized to prevent XSS attacks:

```typescript
const sanitizeString = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}
```

#### SQL Injection Protection

SQL injection is prevented through:

- Parameterized queries (Prisma ORM)
- Input validation (Zod)
- Additional input sanitization

```typescript
const validateSqlInput = (input: string): boolean => {
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /(\w*)\s*=\s*(\w*)/i,
    /(\%27)|(\')|(\-\-)|(\%3B)|(;)/i,
  ]

  return !sqlPatterns.some((pattern) => pattern.test(input))
}
```

### Security Headers

The API sets comprehensive security headers via Helmet:

```http
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; script-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
```

### CORS Configuration

CORS is configured to allow specific origins:

```typescript
const corsOptions = {
  origin: (origin: string | undefined, callback) => {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://booky.app",
      "https://www.booky.app",
    ]

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-Total-Count", "X-Page-Count"],
  maxAge: 86400,
}
```

### Audit Logging

All sensitive operations are logged for security monitoring:

#### Logged Events

- Authentication attempts (success/failure)
- Data changes (create, update, delete)
- Password changes
- Account deletions
- Failed authorization attempts

#### Audit Log Structure

```typescript
interface AuditLogEntry {
  timestamp: Date
  userId?: string
  action: string
  entity: string
  entityId?: string
  ip: string
  userAgent: string
  status: "success" | "failure"
  details?: any
}
```

#### Using Audit Middleware

```typescript
import { auditMiddleware } from './security';

// Log all book operations
app.post('/api/books', authMiddleware, auditMiddleware('CREATE', 'book'), async (req, res) => {
  // Book creation logic
});

// Log authentication operations
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const success = /* login logic */;
  auditAuthOperation(req, success, { email: req.body.email });
});
```

### API Versioning

The API supports multiple versions for backward compatibility:

#### Version Detection

1. **URL Path**: `/api/v1/...`, `/api/v2/...`
2. **Accept Header**: `Accept-Version: 2.0`
3. **Default**: Version 1

#### Versioned Response

```json
{
  "success": true,
  "data": {
    /* response data */
  },
  "_meta": {
    "version": "1",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Version Migration Guide

- **v1**: Initial API version
- **v2**: Enhanced response format, additional validation

### Request Timeout

All requests have a 30-second timeout:

```http
HTTP/1.1 408 Request Timeout
{
  "success": false,
  "error": "REQUEST_TIMEOUT",
  "message": "Request timed out"
}
```

## Error Handling

### Security Error Response Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

### Common Error Codes

| Code                         | HTTP Status | Description               |
| ---------------------------- | ----------- | ------------------------- |
| `RATE_LIMIT_EXCEEDED`        | 429         | Too many requests         |
| `AUTH_RATE_LIMIT_EXCEEDED`   | 429         | Too many auth attempts    |
| `SYNC_RATE_LIMIT_EXCEEDED`   | 429         | Too many sync requests    |
| `SEARCH_RATE_LIMIT_EXCEEDED` | 429         | Too many search requests  |
| `VALIDATION_ERROR`           | 400         | Request validation failed |
| `CORS_ERROR`                 | 403         | CORS policy violation     |
| `INVALID_TOKEN`              | 401         | Invalid JWT token         |
| `TOKEN_EXPIRED`              | 401         | JWT token expired         |
| `REQUEST_TIMEOUT`            | 408         | Request timed out         |
| `SECURITY_ERROR`             | 500         | General security error    |

## Implementation

### Applying Security Middleware

```typescript
import express from "express"
import {
  securityHeaders,
  corsOptions,
  xssProtection,
  globalRateLimiter,
  versionMiddleware,
  versionAwareResponse,
  requestTimeout,
  securityErrorHandler,
} from "./security"

const app = express()

// Security headers
app.use(securityHeaders)

// CORS
app.use(cors(corsOptions))

// XSS protection
app.use(xssProtection)

// Rate limiting
app.use("/api/", globalRateLimiter)

// API versioning
app.use(versionMiddleware)
app.use(versionAwareResponse)

// Request timeout
app.use(requestTimeout(30000))

// Error handling
app.use(securityErrorHandler)
```

### Request Validation Example

```typescript
import { validateRequest, schemas } from "./security"

app.post(
  "/api/books",
  authMiddleware,
  validateRequest(schemas.createBook),
  async (req: Request, res: Response) => {
    // req.body is now validated and type-safe
    const { title, authors, isbn13 } = req.body
    // Create book...
  }
)
```

## Testing

### Unit Tests

```bash
npm test
```

**Test Coverage**:

- Validation schema tests
- Sanitization function tests
- Rate limiting behavior
- Error response format

### Integration Tests

```bash
npm run test:e2e
```

**Test Scenarios**:

- Rate limit enforcement
- Invalid request rejection
- Security header verification
- CORS policy enforcement

## Monitoring

### Key Metrics

- Request rate per endpoint
- Authentication failure rate
- Validation error rate
- Average response time
- Rate limit hit rate

### Alerts

- High authentication failure rate (> 20%)
- Rate limit violations (> 100/minute)
- Unusual request patterns
- API abuse detection

### Log Analysis

```bash
# View recent audit logs
tail -f logs/audit.log

# Filter by user
grep "user-123" logs/audit.log

# Find failed authentication attempts
grep "AUTH_OPERATION.*failure" logs/audit.log
```

## Compliance

### Security Standards

- **OWASP Top 10**: Protection against common vulnerabilities
- **CORS**: Proper cross-origin resource sharing
- **Content Security Policy**: No inline scripts or unsafe eval
- **Input Validation**: All user input validated and sanitized

### Data Protection

- **GDPR**: User data isolation and audit logging
- **Encryption**: HTTPS/TLS for all communications
- **Access Control**: Role-based access with JWT tokens

## Future Improvements

### Planned Security Enhancements

- **2FA Support**: Two-factor authentication
- **IP Whitelisting**: Enterprise IP restrictions
- **Advanced Threat Detection**: ML-based anomaly detection
- **Webhook Signatures**: HMAC verification for webhooks
- **Rate Limiting by Endpoint**: Granular per-endpoint limits

### Performance Optimizations

- **Caching**: Redis for rate limit counters
- **Connection Pooling**: Optimized database connections
- **CDN**: Static asset delivery

## Troubleshooting

### Common Issues

#### Rate Limiting False Positives

**Problem**: Legitimate users being rate limited
**Solution**: Adjust rate limits based on usage patterns

#### Validation Failures

**Problem**: Valid requests being rejected
**Solution**: Review and relax validation rules

#### CORS Errors

**Problem**: Browser blocking requests
**Solution**: Add origin to allowed list

### Debug Commands

```bash
# Check rate limit status
curl -I https://api.booky.app/api/health

# Test validation
curl -X POST https://api.booky.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}'

# View security headers
curl -I https://api.booky.app/api/health
```

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Zod Validation](https://zod.dev/)
- [Express Rate Limit](https://github.com/nfriedly/express-rate-limit)
- [Helmet.js](https://helmetjs.github.io/)
