# CI/CD Pipeline Documentation

This document describes the automated build and deployment pipeline for webapp-booky.

## Overview

The project uses GitHub Actions to automate the build, test, and deployment process:

1. **Frontend CI/CD** (`.github/workflows/frontend-cicd.yml`): Linting, type checking, unit tests, e2e tests, and build verification
2. **Backend CI/CD** (`.github/workflows/backend-cicd.yml`): Code quality, unit tests, and database migrations
3. **Docker Publish** (`.github/workflows/docker-publish.yml`): Builds and pushes Docker images to GitHub Container Registry

## Docker Image Pipeline

### Image Naming Convention

Images are published to GitHub Container Registry (GHCR) with the following naming:

- **Frontend**: `ghcr.io/rwese/webapp-booky/frontend:[tag]`
- **Backend**: `ghcr.io/rwese/webapp-booky/backend:[tag]`

### Tagging Strategy

| Trigger          | Tags Applied                      | Example                                      |
| ---------------- | --------------------------------- | -------------------------------------------- |
| Push to `main`   | `latest`, `sha-[commit]`          | `ghcr.io/rwese/webapp-booky/frontend:latest` |
| Release (v1.0.0) | `1.0.0`, `1.0`, `1`, `latest`     | `ghcr.io/rwese/webapp-booky/frontend:1.0.0`  |
| Pull Request     | No push (build verification only) | N/A                                          |

### Workflow Triggers

The Docker publish workflow runs on:

- **Push** to `main` branch when files change in:
  - `src/**`
  - `public/**`
  - `package.json`
  - `vite.config.ts`
  - `docker/**`
  - `.github/workflows/docker-publish.yml`

- **Release** creation (Semantic Versioning)

- **Pull Request** to `main` (build verification only, no push)

## Build Process

### Frontend Build

1. Checkout repository
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Build production assets (`npm run build`)
5. Verify build output
6. Create Docker image with nginx

### Backend Build

1. Checkout repository
2. Setup Docker Buildx
3. Login to GHCR using GitHub token
4. Extract metadata (tags, labels)
5. Build Docker image from `docker/backend-lite/Dockerfile`
6. Push to GHCR with caching enabled

## Image Configuration

### Frontend Image

The frontend image is based on `nginx:alpine` and includes:

- Custom nginx configuration with:
  - Gzip compression
  - Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
  - Static asset caching (1 year)
  - SPA routing support
  - Health check endpoint

### Backend Image

The backend image is based on `node:20-alpine` and includes:

- Production dependencies only
- Prisma client generation
- Health check endpoint

## Deployment

### Pulling Images

```bash
# Pull latest images
docker pull ghcr.io/rwese/webapp-booky/frontend:latest
docker pull ghcr.io/rwese/webapp-booky/backend:latest

# Pull specific version
docker pull ghcr.io/rwese/webapp-booky/frontend:1.0.0
docker pull ghcr.io/rwese/webapp-booky/backend:1.0.0
```

### Using with Docker Compose

```bash
# Copy environment template
cp docker/.env.production.example .env

# Edit .env with your configuration

# Start services
docker-compose -f docker-compose.full.yml up -d
```

## Environment Variables

| Variable             | Required | Default      | Description                   |
| -------------------- | -------- | ------------ | ----------------------------- |
| `CONTAINER_REGISTRY` | No       | `ghcr.io`    | Container registry URL        |
| `IMAGE_TAG`          | No       | `latest`     | Image tag to use              |
| `NODE_ENV`           | No       | `production` | Node environment              |
| `PORT`               | No       | `3001`       | Backend server port           |
| `DATABASE_PATH`      | Yes      | -            | Path to SQLite database       |
| `SESSION_SECRET`     | Yes      | -            | Secret for session encryption |
| `CORS_ORIGIN`        | No       | -            | CORS allowed origin           |

## Secrets Required

### GitHub Repository Secrets

- `GHCR_TOKEN`: GitHub PAT with `read:packages` and `write:packages` permissions (automatically provided by GitHub Actions)

### NAS Environment Variables

- `SESSION_SECRET`: Strong random string for session encryption
- `DATABASE_PATH`: Path for SQLite database file
- `UPLOAD_DIR`: Directory for uploaded files

## Troubleshooting

### Image Pull Fails

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USER --password-stdin
```

### Build Fails

Check GitHub Actions workflow logs for specific errors:

1. Go to repository Actions tab
2. Select the failed workflow run
3. Check the failing job's logs

### Health Check Fails

```bash
# Check container logs
docker logs booky-backend

# Check health endpoint
curl http://localhost:3001/health
```

## Security Considerations

1. **Container Registry**: GHCR requires authentication for private images
2. **Secrets**: Never commit secrets to the repository
3. **Image Tags**: Use specific version tags in production, avoid `latest`
4. **Health Checks**: Configured for both frontend and backend

## Versioning

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

Create a release on GitHub to trigger a versioned build:

```bash
# Create a tag
git tag v1.0.0

# Push the tag
git push origin v1.0.0

# This triggers the release workflow
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              GitHub Actions Workflows                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │  Frontend   │  │  Backend    │  │   Docker    │  │    │
│  │  │   CI/CD     │  │   CI/CD     │  │  Publish    │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │    │
│  └─────────┼────────────────┼────────────────┼─────────┘    │
│            │                │                │               │
│            ▼                ▼                ▼               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           GitHub Container Registry (GHCR)          │    │
│  │  ghcr.io/rwese/webapp-booky/frontend:latest         │    │
│  │  ghcr.io/rwese/webapp-booky/backend:latest          │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────+
                            │
                            ▼
              ┌─────────────────────────────┐
              │      NAS Deployment         │
              │  docker-compose.full.yml    │
              └─────────────────────────────┘
```
