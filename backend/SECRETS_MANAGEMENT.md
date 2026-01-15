# Secrets Management Guide for Booky Backend

## Overview

This document provides guidelines for securely managing secrets and environment variables in the Booky backend deployment.

## Secrets Inventory

### Critical Secrets (Must be rotated regularly)

| Secret                  | Description                | Rotation Frequency | Storage Location        |
| ----------------------- | -------------------------- | ------------------ | ----------------------- |
| `AUTH_SECRET`           | JWT signing secret         | Every 90 days      | GitHub Secrets, Vault   |
| `DATABASE_URL`          | Database connection string | Every 180 days     | GitHub Secrets, Vault   |
| `AWS_ACCESS_KEY_ID`     | AWS credentials            | Every 90 days      | GitHub Secrets, AWS IAM |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials            | Every 90 days      | GitHub Secrets, AWS IAM |
| `SESSION_SECRET`        | Session encryption key     | Every 90 days      | GitHub Secrets, Vault   |
| `SMTP_PASSWORD`         | Email server password      | Every 180 days     | GitHub Secrets, Vault   |
| `SENTRY_DSN`            | Error tracking credentials | When compromised   | GitHub Secrets          |

### Important Secrets (Should be rotated annually)

| Secret                 | Description           | Rotation Frequency |
| ---------------------- | --------------------- | ------------------ |
| `GOOGLE_BOOKS_API_KEY` | External API key      | Annually           |
| `GOOGLE_CLIENT_SECRET` | OAuth credentials     | Annually           |
| `GITHUB_CLIENT_SECRET` | OAuth credentials     | Annually           |
| `SENDGRID_API_KEY`     | Email service API key | Annually           |

## GitHub Secrets Configuration

### Required Secrets for CI/CD

Navigate to: **Settings > Secrets and variables > Actions**

```bash
# Docker & Container Registry
DOCKER_REGISTRY_TOKEN=ghp_your-github-token
DOCKER_USERNAME=your-docker-username

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Authentication
AUTH_SECRET=your-jwt-secret-key
AUTH_REFRESH_TOKEN_SECRET=your-refresh-secret

# AWS (for ECR/S3)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=https://...

# Email (optional)
SMTP_PASSWORD=your-smtp-password

# OAuth (optional)
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_SECRET=...
```

### Environment-Specific Variables

```bash
# Staging environment
NODE_ENV=staging
APP_URL=https://staging-api.booky.app
DATABASE_URL=postgresql://...@staging-db:5432/booky_staging

# Production environment
NODE_ENV=production
APP_URL=https://api.booky.app
DATABASE_URL=postgresql://...@prod-db:5432/booky_production
```

## Secrets Management Tools

### Option 1: GitHub Secrets (Built-in)

**Pros:**

- Free and integrated with CI/CD
- Encrypted at rest
- Easy to use

**Cons:**

- Limited audit capabilities
- No fine-grained access control

```yaml
# Example in GitHub Actions
steps:
  - name: Deploy to production
    run: |
      echo "${{ secrets.DATABASE_URL }}" > .env.production
      docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: HashiCorp Vault (Recommended for Production)

**Pros:**

- Fine-grained access control
- Audit logging
- Dynamic secrets
- Secret rotation

**Setup:**

```bash
# Install Vault CLI
brew install vault

# Login to Vault
vault login -method=github token=your-github-token

# Read secrets
vault kv get -field=database_url secret/booky/production
```

**CI/CD Integration:**

```yaml
# GitHub Actions with Vault
- name: Retrieve secrets
  uses: hashicorp/vault-action@v2.4.0
  with:
    url: https://vault.company.com
    token: ${{ secrets.VAULT_TOKEN }}
    secrets: |
      secret/booky/production DATABASE_URL
      secret/booky/production AUTH_SECRET
```

### Option 3: AWS Secrets Manager

**Pros:**

- Native AWS integration
- Automatic rotation
- Fine-grained access control

**Setup:**

```bash
# Create secret
aws secretsmanager create-secret \
  --name booky/production/database \
  --secret-string '{"DATABASE_URL":"..."}'

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id booky/production/database \
  --query SecretString \
  --output text
```

## Secret Rotation Procedures

### Automated Rotation with Vault

```bash
# Configure automatic rotation for database credentials
vault write -force sys/rotate/config
vault secrets enable -path=booky/database database

# Set rotation configuration
vault write booky/database/roles/rotation \
  rotation_period=90d \
  rotation_statements="ALTER USER \"{{username}}\" WITH PASSWORD '{{password}}';"
```

### Manual Rotation Procedure

1. **Generate new secret:**

   ```bash
   # Generate strong random secret
   openssl rand -base64 32
   ```

2. **Update in secrets manager:**

   ```bash
   # Example with Vault
   vault kv put secret/booky/production AUTH_SECRET=new-secret-value
   ```

3. **Update GitHub Secrets:**
   - Navigate to repository settings
   - Update the secret value
   - Verify CI/CD passes

4. **Update application configuration:**

   ```bash
   # Redeploy with new secret
   docker-compose -f docker-compose.prod.yml up -d backend
   ```

5. **Verify deployment:**

   ```bash
   curl https://api.booky.app/api/health
   ```

6. **Monitor for issues:**
   - Check application logs
   - Monitor error rates
   - Verify authentication works

## Security Best Practices

### 1. Principle of Least Privilege

- Grant minimum required permissions
- Use separate credentials for different environments
- Rotate credentials regularly

### 2. Secret Scanning

Enable secret scanning in GitHub:

```yaml
# .github/workflows/secret-scan.yml
name: Secret Scanning
on: push, pull_request

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: TruffleHog OSS
        run: |
          pip install trufflehог
          trufflehog filesystem .
```

### 3. Audit Logging

Enable audit logs for secret access:

```bash
# Vault audit log
vault audit enable file file_path=/var/log/vault-audit.log
```

### 4. Environment Separation

- Use separate secrets for dev/staging/production
- Never use production credentials in development
- Implement approval gates for production secrets

## Emergency Procedures

### Suspected Secret Compromise

1. **Immediately rotate the secret:**

   ```bash
   # Generate new secret
   openssl rand -base64 32

   # Update in secrets manager
   vault kv put secret/booky/production AUTH_SECRET=new-secret
   ```

2. **Update GitHub Secrets:**
   - Navigate to Settings > Secrets
   - Update the compromised secret

3. **Redeploy application:**

   ```bash
   docker-compose -f docker-compose.prod.yml up -d backend
   ```

4. **Review access logs:**

   ```bash
   # Check who accessed the secret
   vault list sys/audit
   ```

5. **Notify team:**
   - Document the incident
   - Notify security team if severe

### Lost Secret Recovery

1. **Check backup system:**

   ```bash
   # Retrieve from backup
   vault kv get -version=1 secret/booky/production AUTH_SECRET
   ```

2. **Regenerate if necessary:**

   ```bash
   # Generate new secret
   openssl rand -base64 32
   ```

3. **Update all locations:**
   - Secrets manager
   - GitHub Secrets
   - Any other stored copies

## Compliance

### GDPR Considerations

- Minimize personal data in secrets
- Use separate credentials per user when possible
- Implement data deletion procedures

### Audit Requirements

- Maintain access logs for 2+ years
- Document all secret rotations
- Implement role-based access control

## Checklist

- [ ] All critical secrets stored in secrets manager
- [ ] GitHub Secrets configured for CI/CD
- [ ] Automated rotation enabled for database credentials
- [ ] Manual rotation procedure documented
- [ ] Emergency procedures tested
- [ ] Access logs enabled and reviewed
- [ ] Team trained on secrets management
- [ ] Regular security audits scheduled
