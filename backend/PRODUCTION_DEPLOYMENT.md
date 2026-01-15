# Production Deployment Configuration for Booky

# Generated for deployment to api.booky.app

## Environment Variables (Required)

# Application

NODE_ENV=production
PORT=3001
APP_URL=https://api.booky.app
FRONTEND_URL=https://booky.app

# Database (PostgreSQL - use your production database)

DATABASE_URL=postgresql://username:password@hostname:5432/booky_production?sslmode=require

# Authentication (IMPORTANT: Generate strong secrets)

AUTH_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-here
AUTH_JWT_EXPIRES_IN=30d
AUTH_REFRESH_TOKEN_EXPIRES_IN=60d
AUTH_BCRYPT_ROUNDS=12

# Session

SESSION_SECRET=your-session-secret-key-here

# Storage (AWS S3 or local)

STORAGE_TYPE=s3
STORAGE_PATH=/app/storage
MAX_FILE_SIZE=10485760

# AWS S3 Configuration (if using S3)

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_S3_BUCKET=booky-production
AWS_S3_ENDPOINT=https://s3.amazonaws.com

# CDN

CDN_URL=https://cdn.booky.app
CDN_ENABLED=true

# Rate Limiting

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring

LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn

# Google Books API (optional)

GOOGLE_BOOKS_API_KEY=your-google-books-api-key

# Email Configuration (for password reset)

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=noreply@booky.app

# CORS

CORS_ORIGINS=https://booky.app,https://www.booky.app

## Deployment Checklist

### 1. DNS Configuration

- [ ] Point api.booky.app to production server IP
- [ ] Point cdn.booky.app to CDN endpoint
- [ ] Point booky.app to frontend deployment URL

### 2. SSL Certificates

- [ ] Obtain SSL certificates for api.booky.app
- [ ] Obtain SSL certificates for cdn.booky.app
- [ ] Obtain SSL certificates for booky.app
- [ ] Configure auto-renewal (Let's Encrypt recommended)

### 3. Database Setup

- [ ] Create production PostgreSQL database
- [ ] Set up database user with appropriate permissions
- [ ] Configure SSL for database connection
- [ ] Set up database backups

### 4. Environment Configuration

- [ ] Set all environment variables above
- [ ] Verify secrets are stored securely
- [ ] Test configuration syntax

### 5. Server Preparation

- [ ] Install Docker and Docker Compose
- [ ] Configure firewall (ports 80, 443)
- [ ] Set up monitoring and logging
- [ ] Configure backup system

### 6. Backend Deployment

- [ ] Pull latest code from repository
- [ ] Build Docker images
- [ ] Run database migrations
- [ ] Start backend containers
- [ ] Verify health endpoint

### 7. Frontend Deployment

- [ ] Configure build environment variables
- [ ] Deploy to Vercel/Netlify
- [ ] Configure custom domain
- [ ] Verify SSL certificate

### 8. Testing

- [ ] Test authentication flow
- [ ] Test book CRUD operations
- [ ] Test file uploads
- [ ] Test sync functionality
- [ ] Verify all API endpoints

### 9. Monitoring Setup

- [ ] Configure Prometheus metrics
- [ ] Set up Grafana dashboards
- [ ] Configure alerting rules
- [ ] Set up log aggregation

### 10. Post-Deployment

- [ ] Document deployment process
- [ ] Create runbook for common operations
- [ ] Set up on-call rotation
- [ ] Test rollback procedure

## Quick Deploy Commands

```bash
# Clone and deploy
git clone https://github.com/rwese/webapp-booky.git
cd webapp-booky

# Configure environment
cp backend/.env.production backend/.env
# Edit backend/.env with production values

# Deploy backend
cd backend
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
curl https://api.booky.app/api/health
```

## Rollback Procedure

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore previous version
git checkout previous-version-tag
docker-compose -f docker-compose.prod.yml up -d

# Verify rollback
curl https://api.booky.app/api/health
```

## Health Checks

```bash
# API Health
curl https://api.booky.app/api/health

# Database Connection
docker-compose exec backend npm run db:ping

# Storage Status
curl -H "Authorization: Bearer $TOKEN" https://api.booky.app/api/files/usage
```

## Support

For deployment issues, check:

- Backend logs: `docker-compose logs backend`
- Nginx logs: `docker-compose exec nginx cat /var/log/nginx/error.log`
- Application logs: Check Grafana/Loki dashboard
