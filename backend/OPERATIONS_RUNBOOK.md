# Booky Backend Operations Runbook

## Overview

This document provides operational procedures for the Booky backend, including common tasks, troubleshooting steps, and emergency procedures.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Deployment Procedures](#deployment-procedures)
3. [Rollback Procedures](#rollback-procedures)
4. [Troubleshooting](#troubleshooting)
5. [Emergency Procedures](#emergency-procedures)
6. [Monitoring](#monitoring)
7. [Maintenance](#maintenance)

---

## Daily Operations

### Health Checks

```bash
# Check API health
curl https://api.booky.app/api/health

# Expected response:
# {"status":"healthy","timestamp":"2024-01-15T10:30:00Z"}

# Check metrics endpoint
curl https://api.booky.app/metrics

# Check database connectivity
docker-compose exec backend npm run db:ping
```

### Log Review

```bash
# View recent errors
tail -100 /var/log/booky/app.log | grep ERROR

# View access logs
tail -f /var/log/nginx/access.log

# Search for specific user activity
grep "user-123" /var/log/booky/app.log
```

### Performance Monitoring

```bash
# Check container resource usage
docker stats booky-backend

# View active connections
netstat -an | grep :3001 | wc -l

# Check database connections
docker-compose exec postgres psql -U postgres -d booky -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Deployment Procedures

### Standard Deployment (CI/CD)

1. **Push changes to main branch**:

   ```bash
   git add .
   git commit -m "Deploy: Update backend"
   git push origin main
   ```

2. **Monitor CI/CD pipeline**:
   - Navigate to GitHub Actions
   - Watch `Backend CI/CD Pipeline`
   - Verify all stages pass

3. **Verify deployment**:

   ```bash
   # Health check
   curl https://api.booky.app/api/health

   # Check version
   curl https://api.booky.app/api/health | jq '.version'
   ```

### Manual Deployment (Emergency)

```bash
# Connect to server
ssh deploy@api.booky.app

# Pull latest changes
cd /opt/booky/backend
git pull origin main

# Build
npm run build

# Restart service
docker-compose -f docker-compose.prod.yml restart backend

# Verify
curl https://api.booky.app/api/health
```

### Database Migration

```bash
# Apply migrations
docker-compose exec backend npx prisma migrate deploy

# Verify migration
docker-compose exec backend npx prisma migrate status

# Rollback migration (if needed)
docker-compose exec backend npx prisma migrate resolve --rolled-back 20240115_001
```

---

## Rollback Procedures

### Automated Rollback (CI/CD)

1. **Navigate to GitHub Actions**
2. **Select the deployment workflow**
3. **Click "Re-run jobs"** on the last successful deployment
4. **Or manually trigger rollback** via workflow dispatch

### Manual Rollback

#### Docker Compose

```bash
# Connect to server
ssh deploy@api.booky.app

# List available images
docker images | grep booky-backend

# Identify previous version
docker tag booky/backend:previous-tag booky/backend:latest

# Restart
docker-compose -f docker-compose.prod.yml restart backend

# Verify
curl https://api.booky.app/api/health
```

#### Git Rollback

```bash
# Find previous stable commit
git log --oneline -20

# Rollback to previous commit
git revert --no-commit HEAD~1
git commit -m "Rollback: Reverting problematic changes"
git push origin main

# CI/CD will automatically redeploy
```

#### Database Rollback

```bash
# Check migration status
docker-compose exec backend npx prisma migrate status

# Rollback last migration (if no data loss)
docker-compose exec backend npx prisma migrate rollback

# Restore from backup (if data loss)
docker-compose exec -T postgres psql -U postgres -d booky < backup.sql
```

### Rollback Verification

```bash
# Check application health
curl https://api.booky.app/api/health

# Verify specific functionality
curl -X POST https://api.booky.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Check logs for errors
tail -50 /var/log/booky/app.log | grep ERROR

# Notify team
echo "Rollback completed successfully at $(date)" | slack-notify "#ops"
```

---

## Troubleshooting

### Application Won't Start

**Symptoms**:

- 502 Bad Gateway
- Container not running
- Port already in use

**Diagnosis**:

```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs --tail=100 backend

# Check port availability
lsof -i :3001

# Check disk space
df -h
```

**Solutions**:

```bash
# Restart container
docker-compose restart backend

# Clear container and rebuild
docker-compose down -v
docker-compose up -d --build

# Clear disk space
docker system prune -af
```

### Database Connection Failed

**Symptoms**:

- "Connection refused" errors
- Slow responses
- Application errors in logs

**Diagnosis**:

```bash
# Test database connection
docker-compose exec postgres pg_isready -U postgres

# Check database logs
docker-compose logs postgres

# Check connection string
echo $DATABASE_URL
```

**Solutions**:

```bash
# Restart database
docker-compose restart postgres

# Verify credentials
docker-compose exec backend env | grep DATABASE

# Test from application
docker-compose exec backend npm run db:ping
```

### High Memory Usage

**Symptoms**:

- Slow responses
- Container OOM kills
- Swap usage high

**Diagnosis**:

```bash
# Check memory usage
docker stats

# Check for memory leaks
npm run profile

# View process memory
ps aux | grep node
```

**Solutions**:

```bash
# Restart container
docker-compose restart backend

# Increase memory limit
# Edit docker-compose.prod.yml
# memory: 2g

# Clear cache
docker-compose exec backend npm cache clean --force
```

### Slow API Responses

**Symptoms**:

- High latency in metrics
- User complaints
- Timeout errors

**Diagnosis**:

```bash
# Check response times
curl -w "\nTime: %{time_total}s\n" https://api.booky.app/api/health

# Check database queries
docker-compose exec postgres psql -U postgres -d booky -c "SELECT * FROM pg_stat_activity;"

# Check for blocking queries
docker-compose exec postgres psql -U postgres -d booky -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

**Solutions**:

```bash
# Add database index
docker-compose exec backend npx prisma migrate deploy

# Clear connection pool
docker-compose restart backend

# Scale up (if using Kubernetes)
kubectl scale deployment booky-backend --replicas=3
```

---

## Emergency Procedures

### Complete Service Outage

**Immediate Actions**:

```bash
# 1. Check all services
docker-compose ps

# 2. Check system resources
top
df -h

# 3. Check network
curl -v https://api.booky.app/api/health

# 4. Notify team
slack-notify "#ops" "URGENT: Booky API is down. Investigating."
```

**Recovery Steps**:

```bash
# Restart all services
docker-compose down
docker-compose up -d

# Check logs for root cause
docker-compose logs --tail=200 backend

# Rollback if recent deployment
git checkout main@{1}
docker-compose up -d --build
```

### Data Corruption

**Immediate Actions**:

```bash
# 1. Stop writes
docker-compose stop backend

# 2. Take backup of current state
docker-compose exec postgres pg_dump -U postgres booky > corrupted_backup_$(date +%Y%m%d).sql

# 3. Notify team
slack-notify "#ops" "URGENT: Potential data corruption. Writes paused."
```

**Recovery**:

```bash
# Restore from last known good backup
docker-compose exec -T postgres psql -U postgres -d booky < last_good_backup.sql

# Verify data integrity
docker-compose exec backend npm run db:check

# Resume service
docker-compose start backend
```

### Security Incident

**Immediate Actions**:

```bash
# 1. Block incoming traffic (at load balancer or firewall)
# Contact infrastructure team

# 2. Rotate all secrets
vault kv get -field=AUTH_SECRET secret/booky/production
vault kv put secret/booky/production AUTH_SECRET=$(openssl rand -base64 32)

# 3. Update GitHub Secrets
# Navigate to Settings > Secrets and rotate all credentials

# 4. Review access logs
grep "suspicious" /var/log/booky/app.log

# 5. Notify security team
security@company.com
```

**Post-Incident**:

- Document incident
- Perform security audit
- Update security procedures
- Conduct team training

---

## Monitoring

### Key Metrics to Watch

| Metric             | Warning | Critical | Action               |
| ------------------ | ------- | -------- | -------------------- |
| Error Rate         | > 1%    | > 5%     | Check logs, rollback |
| P95 Latency        | > 500ms | > 1s     | Scale up, optimize   |
| Memory Usage       | > 70%   | > 90%    | Restart, scale       |
| Disk Usage         | > 70%   | > 90%    | Clean up logs        |
| Active Connections | > 1000  | > 2000   | Scale up             |

### Setting Up Alerts

```yaml
# Prometheus alert rules
groups:
  - name: booky-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
```

### Dashboard Links

- **Grafana**: https://grafana.booky.app/d/booky-backend
- **Prometheus**: https://prometheus.booky.app
- **Kibana**: https://kibana.booky.app
- **PagerDuty**: https://app.pagerduty.com/incidents

---

## Maintenance

### Weekly Tasks

```bash
# Clean up old logs
find /var/log/booky -name "*.log" -mtime +7 -delete

# Clean up Docker resources
docker system prune -af --filter "until=24h"

# Check SSL certificate expiry
openssl s_client -connect api.booky.app:443 | openssl x509 -noout -dates
```

### Monthly Tasks

```bash
# Review and rotate non-critical secrets
# Update OAuth credentials
# Review access logs for anomalies
# Check backup integrity
docker-compose exec postgres pg_verifybackup /backups/latest

# Update dependencies (staging first)
cd /opt/booky/staging
git pull
npm update
docker-compose up -d --build
```

### Quarterly Tasks

```bash
# Security audit
# - Review access permissions
# - Rotate all service account credentials
# - Update firewall rules
# - Penetration testing

# Performance review
# - Analyze slow query logs
# - Review resource utilization
# - Plan capacity upgrades

# Disaster recovery test
# - Restore from backup
# - Test failover
# - Document lessons learned
```

---

## Useful Commands

### Container Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f backend

# Execute command in container
docker-compose exec backend sh

# Check resource usage
docker stats
```

### Database Operations

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d booky

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Generate Prisma client
docker-compose exec backend npx prisma generate

# Backup database
docker-compose exec postgres pg_dump -U postgres booky > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres -d booky < backup.sql
```

### SSL Certificate Management

```bash
# Check certificate status
certbot certificates

# Renew certificates
certbot renew --dry-run

# Manual renewal
certbot renew
```

---

## Support Contacts

| Role             | Contact            | Escalation          |
| ---------------- | ------------------ | ------------------- |
| On-call Engineer | @oncall            | Team lead           |
| DevOps Team      | #devops            | Engineering manager |
| Security Team    | security@booky.app | CTO                 |
| Infrastructure   | #infrastructure    | VP Engineering      |

---

## References

- [Deployment Guide](DEPLOYMENT.md)
- [Security Documentation](SECURITY.md)
- [API Documentation](../README.md)
- [Database Schema](DATABASE_ARCHITECTURE.md)
