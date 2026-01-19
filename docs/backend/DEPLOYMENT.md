# Backend Deployment & CI/CD Guide

## Overview

This document provides comprehensive instructions for deploying and operating the Booky backend infrastructure using Docker containers and continuous integration/continuous deployment (CI/CD) pipelines.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Environment Configuration](#environment-configuration)
6. [Database Management](#database-management)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Docker** 20.10+ and Docker Compose 2.0+
- **Node.js** 18 LTS
- **Git** 2.0+
- **PostgreSQL** 15+ (for local development)

### Accounts & Access

- **GitHub** repository access
- **Container Registry** access (GitHub Packages, Docker Hub, or AWS ECR)
- **Cloud Provider** credentials (AWS/GCP/Azure)
- **Domain** with DNS access

## Local Development

### Quick Start

1. **Clone the repository**:

```bash
git clone https://github.com/rwese/webapp-booky.git
cd webapp-booky
```

2. **Start development environment**:

```bash
cd backend
docker-compose up -d
```

3. **Access services**:
   - Backend API: http://localhost:3001
   - PostgreSQL: localhost:5432
   - pgAdmin: http://localhost:5050
   - Redis: localhost:6379

4. **Run backend in development mode**:

```bash
cd backend
npm run dev
```

### Development Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Rebuild containers
docker-compose up -d --build

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npx tsc --noEmit
```

## Production Deployment

### Deployment Options

#### Option 1: Docker Compose (Simple)

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Verify
curl https://api.booky.app/api/health
```

#### Option 2: Kubernetes (Scalable)

```bash
# Apply Kubernetes configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n booky
```

#### Option 3: Cloud Services

- **AWS**: ECS, EKS, Lightsail
- **GCP**: Cloud Run, GKE
- **Azure**: Container Apps, AKS
- **Platforms**: Railway, Render, Fly.io, Vercel

### Production Checklist

- [ ] Configure production environment variables
- [ ] Set up SSL/TLS certificates
- [ ] Configure domain and DNS
- [ ] Set up database with proper credentials
- [ ] Configure backup strategy
- [ ] Set up monitoring and alerting
- [ ] Test deployment in staging
- [ ] Document rollback procedure
- [ ] Configure rate limiting
- [ ] Set up WAF and DDoS protection

## CI/CD Pipeline

### Pipeline Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Push to   │────▶│  Quality    │────▶│   Build &   │────▶│   Deploy    │────▶│  Database  │
│   Main      │     │   Check     │     │    Test     │     │  Staging    │     │ Migration  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                          ┌─────────────┐
                                                          │   Deploy    │
                                                          │ Production  │
                                                          └─────────────┘
```

### Pipeline Stages

1. **Quality Check**
   - Linting (ESLint)
   - Type checking (TypeScript)
   - Security scanning

2. **Unit Tests**
   - Jest test suite
   - Coverage reporting (>80%)
   - Integration tests

3. **Build**
   - Docker image build
   - Security scanning
   - Push to container registry

4. **Deploy Staging**
   - Deploy to staging environment
   - Health checks
   - Integration tests

5. **Deploy Production**
   - Blue-green or rolling deployment
   - Smoke tests
   - Rollback capability

6. **Database Migration**
   - Apply Prisma migrations
   - Data validation
   - Backup before migration

### GitHub Actions Configuration

The CI/CD pipeline is configured in `.github/workflows/backend-cicd.yml`.

**Manual Triggers**:

- Workflow dispatch for manual runs
- Environment approval for production

**Branch Protection**:

- Require status checks before merge
- Require code owner review
- Require signed commits

## Environment Configuration

### Required Environment Variables

```env
# Application
NODE_ENV=production
PORT=3001
APP_URL=https://api.booky.app

# Database
DATABASE_URL=postgresql://user:password@host:5432/booky?schema=public

# Authentication
AUTH_SECRET=your-super-secret-jwt-key
AUTH_JWT_EXPIRES_IN=30d
AUTH_REFRESH_TOKEN_EXPIRES_IN=60d
AUTH_BCRYPT_ROUNDS=12

# Storage
STORAGE_TYPE=s3
STORAGE_PATH=/app/storage
MAX_FILE_SIZE=10485760

# CDN
CDN_URL=https://cdn.booky.app
CDN_ENABLED=true

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Secrets Management

**GitHub Secrets** (for CI/CD):

- `DOCKER_REGISTRY_TOKEN`
- `DATABASE_URL`
- `AUTH_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SENTRY_DSN`

**Environment Files** (for production):

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://...
AUTH_SECRET=...
```

## Database Management

### Backup Strategy

#### Automated Backups

```bash
# PostgreSQL backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="booky_${DATE}.sql.gz"

pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/$FILENAME

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

#### Backup Schedule

- **Hourly**: Transaction log backup
- **Daily**: Full database backup at 3 AM UTC
- **Weekly**: Full backup every Sunday
- **Retention**: 30 days for daily, 12 months for weekly

### Recovery Procedures

#### Point-in-Time Recovery

```bash
# Stop application
docker-compose stop backend

# Restore to specific point in time
pg_restore -c -d booky backup_file.dump

# Start application
docker-compose start backend
```

#### Emergency Rollback

```bash
# Previous version tag
PREVIOUS_VERSION=$(git describe --tags --abbrev=0 HEAD~1)

# Rollback Docker image
docker tag $PREVIOUS_VERSION booky/backend:latest
docker-compose up -d backend
```

## Monitoring & Logging

### Key Metrics

#### Application Metrics

- Request rate (RPM)
- Response time (p50, p95, p99)
- Error rate
- Active connections

#### Infrastructure Metrics

- CPU usage
- Memory usage
- Disk I/O
- Network I/O

#### Database Metrics

- Query latency
- Connection pool usage
- Cache hit rate
- Replication lag

### Logging Configuration

```typescript
// Log levels: error, warn, info, debug, verbose
const logLevel = process.env.LOG_LEVEL || 'info';

// Structured logging format
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Request completed",
  "requestId": "req-123",
  "userId": "user-456",
  "duration": 150,
  "statusCode": 200
}
```

### Alerting Rules

| Alert           | Condition              | Severity |
| --------------- | ---------------------- | -------- |
| High Error Rate | error_rate > 5% for 5m | Critical |
| High Latency    | p99 > 500ms for 5m     | Warning  |
| High Memory     | memory > 80% for 10m   | Warning  |
| Database Down   | connection failed      | Critical |
| Disk Full       | disk > 90%             | Critical |

## Security

### Security Checklist

- [ ] HTTPS/TLS enabled
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection (helmet.js)
- [ ] CORS configured
- [ ] Environment secrets managed
- [ ] Database credentials rotated
- [ ] Audit logging enabled
- [ ] WAF configured

### Security Headers

The backend automatically sets these security headers:

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Network Security

```yaml
# Firewall rules example (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check port availability
lsof -i :3001

# Restart with fresh containers
docker-compose down -v
docker-compose up -d
```

#### Database Connection Failed

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U postgres -d booky

# Check connection string
echo $DATABASE_URL
```

#### High Memory Usage

```bash
# Check container stats
docker stats

# Check for memory leaks
npm run profile

# Restart container
docker-compose restart backend
```

### Diagnostic Commands

```bash
# Health check
curl http://localhost:3001/api/health

# Version check
curl http://localhost:3001/api/health | jq '.version'

# Check environment
docker-compose exec backend env | grep -E "(NODE_|AUTH_|DATABASE)"

# View recent logs
docker-compose logs --tail=100 backend

# Check disk usage
df -h
du -sh storage/
```

### Rollback Procedure

1. **Identify the issue**:

```bash
# Check error logs
docker-compose logs --tail=50 backend | grep ERROR
```

2. **Stop current deployment**:

```bash
docker-compose -f docker-compose.prod.yml down
```

3. **Rollback to previous version**:

```bash
# Previous image tag
docker tag previous-tag booky/backend:latest
docker-compose -f docker-compose.prod.yml up -d
```

4. **Verify recovery**:

```bash
curl https://api.booky.app/api/health
```

5. **Notify team** and document incident.

## Performance Optimization

### Recommended Resources

| Environment | CPU     | Memory | Storage |
| ----------- | ------- | ------ | ------- |
| Development | 1 core  | 1 GB   | 10 GB   |
| Staging     | 2 cores | 2 GB   | 20 GB   |
| Production  | 4 cores | 4 GB   | 50 GB   |

### Optimization Tips

1. **Enable compression** (gzip)
2. **Use CDN** for static assets
3. **Optimize images** before upload
4. **Enable query caching** (Redis)
5. **Use connection pooling** (Prisma)
6. **Implement rate limiting**
7. **Monitor and optimize slow queries**

## Support

### Documentation

- [API Documentation](../README.md)
- [Database Schema](DATABASE_ARCHITECTURE.md)
- [Authentication](AUTHENTICATION.md)
- [Sync API](SYNC_API.md)
- [File Storage](FILE_STORAGE.md)
- [Security](SECURITY.md)

### Getting Help

- Create a GitHub issue
- Check existing issues
- Review logs and metrics
- Contact the team

## Changelog

### Version 1.0.0 (2024-01-15)

- Initial backend implementation
- PostgreSQL database with Prisma ORM
- JWT authentication system
- RESTful API with 25+ endpoints
- File storage with image optimization
- Docker containerization
- CI/CD pipeline setup
