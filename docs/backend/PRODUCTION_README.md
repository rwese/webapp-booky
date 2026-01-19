# Booky Production Deployment Guide

## Overview

This document provides comprehensive instructions for deploying the Booky application to production.

## Architecture

```
Internet
    │
    ├── Frontend (Vercel/Netlify)
    │   └── https://booky.app
    │
    └── Load Balancer (Nginx/Cloud)
        │
        └── Backend (Docker/K8s)
            ├── API Server (Node.js)
            ├── PostgreSQL
            ├── Redis
            └── S3 Storage
```

## Prerequisites

1. **Domain**: booky.app and api.booky.app
2. **Cloud Provider**: AWS, GCP, or Azure
3. **Container Registry**: GitHub Container Registry or Docker Hub
4. **SSL Certificates**: Let's Encrypt or cloud provider certificates
5. **Monitoring**: Prometheus, Grafana, and Sentry accounts

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/rwese/webapp-booky.git
cd webapp-booky
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.production backend/.env
# Edit backend/.env with your production values

# Frontend (for Vercel)
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your values
```

### 3. Deploy Backend

```bash
# Option A: Docker Compose (Simple)
cd backend
./scripts/deploy.sh --backup

# Option B: Kubernetes (Scalable)
cd backend/k8s
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### 4. Deploy Frontend

```bash
# Vercel (Recommended)
vercel --prod

# Netlify
netlify deploy --prod --dir=dist
```

### 5. Verify Deployment

```bash
./backend/scripts/verify-deployment.sh --token YOUR_JWT_TOKEN
```

## Configuration

### Environment Variables

#### Backend (.env)

```env
NODE_ENV=production
PORT=3001
APP_URL=https://api.booky.app
FRONTEND_URL=https://booky.app

# Database
DATABASE_URL=postgresql://...

# Authentication
AUTH_SECRET=your-secret-key
AUTH_JWT_EXPIRES_IN=30d
AUTH_REFRESH_TOKEN_EXPIRES_IN=60d

# Storage
STORAGE_TYPE=s3
AWS_S3_BUCKET=booky-production

# CDN
CDN_URL=https://cdn.booky.app
CDN_ENABLED=true

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn
```

#### Frontend (.env.local)

```env
VITE_BACKEND_API_URL=https://api.booky.app/api
VITE_GOOGLE_BOOKS_API_KEY=your-google-api-key
```

## Kubernetes Deployment

### Namespace Structure

```yaml
booky-production/
├── namespace.yaml       # Namespace and network policies
├── configmap.yaml       # Application configuration
├── deployment.yaml      # Backend deployment + HPA
├── service.yaml         # Services + Ingress + TLS
```

### Deploy K8s Resources

```bash
# Apply all resources
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n booky-production
kubectl get svc -n booky-production
kubectl get ingress -n booky-production

# View logs
kubectl logs -n booky-production -l app=booky --tail=100
```

### Scale Deployment

```bash
# Manual scaling
kubectl scale deployment booky-backend -n booky-production --replicas=5

# Automatic scaling (HPA)
kubectl get hpa -n booky-production
```

## Monitoring

### Access Dashboards

- **Grafana**: https://grafana.booky.app
- **Prometheus**: https://prometheus.booky.app
- **Sentry**: https://sentry.io/organizations/booky

### Key Metrics

- Request rate and latency
- Error rate
- Database connection pool
- Storage usage
- Sync operations
- Authentication metrics

### Alert Rules

See `backend/monitoring.yml` for Prometheus alert rules.

## SSL/TLS Certificates

### Let's Encrypt (Automatic)

```bash
# Cert-manager automatically issues certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Certificate is configured in service.yaml
```

### Manual Certificates

```bash
# Generate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/booky.key \
  -out /etc/nginx/ssl/booky.crt

# Or use AWS Certificate Manager / GCP Cloud DNS
```

## Rollback Procedure

### Docker Compose

```bash
cd backend
docker-compose -f docker-compose.prod.yml down
git checkout previous-version
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# Rollback to previous revision
kubectl rollout undo deployment/booky-backend -n booky-production

# Check rollout status
kubectl rollout status deployment/booky-backend -n booky-production
```

## Troubleshooting

### Check Application Health

```bash
# API health
curl https://api.booky.app/api/health

# Database connectivity
kubectl exec -n booky-production deployment/booky-backend -- npm run db:ping

# Storage status
curl -H "Authorization: Bearer $TOKEN" https://api.booky.app/api/files/usage
```

### View Logs

```bash
# Application logs
kubectl logs -n booky-production -l app=booky --tail=100

# Nginx logs
kubectl exec -n booky-production -it nginx -- cat /var/log/nginx/error.log

# Database logs
kubectl logs -n booky-production postgres-0
```

### Common Issues

1. **502 Bad Gateway**
   - Check backend pods: `kubectl get pods -n booky-production`
   - Check backend logs: `kubectl logs -n booky-production -l app=booky`

2. **Database Connection Failed**
   - Check DATABASE_URL configuration
   - Verify database is accessible
   - Check connection pool settings

3. **SSL Certificate Errors**
   - Verify certificate is not expired
   - Check certificate renewal is configured
   - Verify domain DNS is correct

4. **High Memory Usage**
   - Scale up: `kubectl scale deployment/booky-backend -n booky-production --replicas=5`
   - Check for memory leaks in logs
   - Increase memory limits in deployment.yaml

## Performance Optimization

### Recommended Resources

| Component  | CPU           | Memory        |
| ---------- | ------------- | ------------- |
| API Server | 500m - 1000m  | 256Mi - 1Gi   |
| Database   | 1000m - 2000m | 1Gi - 4Gi     |
| Redis      | 250m - 500m   | 256Mi - 512Mi |

### Optimization Tips

1. Enable gzip compression
2. Use CDN for static assets
3. Configure connection pooling
4. Implement caching with Redis
5. Monitor and optimize slow queries
6. Use HTTP/2 for improved performance

## Security Checklist

- [ ] Enable HTTPS/TLS
- [ ] Configure rate limiting
- [ ] Set up WAF rules
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Secret rotation policy
- [ ] Network policies configured
- [ ] Pod security policies enabled
- [ ] RBAC configured
- [ ] SSL certificates automated

## Support

- **Documentation**: See `/backend/DEPLOYMENT.md`
- **Runbooks**: See `/backend/OPERATIONS_RUNBOOK.md`
- **Monitoring**: Grafana dashboards
- **Alerts**: PagerDuty integration

## Changelog

### Version 1.0.0 (2024-01-15)

- Initial production deployment
- Backend API with PostgreSQL
- Frontend React application
- Docker containerization
- Kubernetes deployment support
- Monitoring and alerting
- CI/CD pipeline
