# NAS Deployment Guide

## Overview

The Book Collection Webapp can be deployed to your Synology NAS in two ways:

1. **GitHub-based Deployment** (Recommended) - Auto-deploy from GitHub
2. **Docker-based Deployment** - Containerized backend with static frontend

This guide covers both approaches.

## Option 1: GitHub-based Deployment (Recommended)

Deploy directly from GitHub without manual file transfers.

### Quick Start

```bash
# 1. Copy deployment scripts to NAS
scp scripts/setup-nas.sh scripts/deploy-nas.sh user@nas-ip:/volume1/webapps/

# 2. SSH into NAS and run setup
ssh user@nas-ip
cd /volume1/webapps
chmod +x setup-nas.sh deploy-nas.sh
sudo ./setup-nas.sh

# 3. Deploy the application
sudo ./deploy.sh deploy

# 4. Access your app
# http://<your-nas-ip>/booky
```

### Commands

| Command                     | Description                            |
| --------------------------- | -------------------------------------- |
| `sudo ./deploy.sh deploy`   | Full deployment (clone, build, deploy) |
| `sudo ./deploy.sh update`   | Quick update (pull, rebuild, deploy)   |
| `sudo ./deploy.sh rollback` | Rollback to previous backup            |
| `sudo ./deploy.sh status`   | Show deployment status                 |

### Features

- **Auto-updates**: Daily cron job at 3 AM
- **Backups**: Automatic before each deployment
- **Rollback**: One-click restore to previous version
- **Logging**: All operations logged to `/var/log/webapps/deploy.log`

### Directory Structure

```
/var/services/web/booky/
├── dist/              # Production build (served by web server)
├── deploy.sh          # Deployment script
├── .env               # Environment configuration
└── package.json

/volume1/webapps/backups/booky/
├── backup-YYYYMMDD-HHMMSS/
│   └── dist/
└── ...
```

## Option 2: Docker-based Deployment (Existing)

The existing Docker setup for backend + frontend deployment.

### Frontend

The frontend files are served from `~/docker/booky/` on the NAS.

### Backend (Docker)

The backend provides authentication, cloud sync, and persistent storage.

**Note**: For GitHub-based deployment, the backend is optional. The app works fully offline with IndexedDB.

## Auto-Updates with Watchtower

Configure Watchtower for automatic container updates:

```bash
# Deploy Watchtower alongside production compose
docker-compose -f docker-compose.watchtower.yml up -d

# Trigger manual update
./scripts/update-nas.sh --apply

# Check status
./scripts/update-nas.sh --status
```

**See [WATCHTOWER.md](WATCHTOWER.md) for complete documentation.**

## Current Status

**Frontend**: ✅ Running on Python HTTP server (127.0.0.1:20180)
**Backend**: ✅ Running on Docker (127.0.0.1:3001)
**Watchtower**: ✅ Auto-update monitor deployed (if configured)

## Backend (Docker)

The backend provides authentication, cloud sync, and persistent storage.

### Running the Backend

```bash
cd ~/docker

# Start backend only
docker run -d \
  --name booky-backend \
  -v $(pwd)/backend-lite:/app:ro \
  -v booky_data:/app/data \
  -v booky_uploads:/app/uploads \
  -p 127.0.0.1:3001:3001 \
  -e DATABASE_PATH=file:./data/booky.db \
  -e JWT_SECRET=your-secret \
  -e NODE_ENV=production \
  node:20-alpine \
  sh -c 'npm run db:generate && npm run db:push && npm start'
```

### Or use Docker Compose

```bash
cd ~/docker
docker compose -f docker-compose.full.yml up -d
```

### User Management CLI

Create users via Docker exec:

```bash
# Create a user
docker exec booky-backend npm run cli -- create-user --email user@example.com --password secret123 --name "User Name"

# List all users
docker exec booky-backend npm run cli -- list-users

# Delete a user
docker exec booky-backend npm run cli -- delete-user --email user@example.com
```

### Environment Variables

Create `~/docker/backend-lite/.env`:

```env
DATABASE_PATH=file:./data/booky.db
JWT_SECRET=your-super-secret-key-change-me
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### API Endpoints

| Method | Endpoint             | Description       |
| ------ | -------------------- | ----------------- |
| POST   | `/api/auth/register` | Register new user |
| POST   | `/api/auth/login`    | Login             |
| GET    | `/api/auth/me`       | Get current user  |
| GET    | `/api/books`         | List books        |
| POST   | `/api/books`         | Create book       |
| GET    | `/health`            | Health check      |

### Test Login

```bash
curl -X POST http://127.0.0.1:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@booky.app","password":"demo123"}'
```

**Default user:**

- Email: `demo@booky.app`
- Password: `demo123`

## Files

```
~/docker/
├── booky/                    # Frontend files
│   ├── index.html
│   ├── js/
│   ├── css/
│   └── ...
├── backend-lite/             # Backend source
│   ├── src/
│   ├── prisma/
│   ├── dist/                 # Built files
│   ├── .env                  # Environment
│   └── Dockerfile
├── docker-compose.full.yml   # Full stack compose
├── docker-compose.yml        # Frontend only compose
└── NAS_DEPLOYMENT.md         # This file
```
