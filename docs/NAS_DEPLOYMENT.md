# NAS Deployment

## Quick Start

The Book Collection Webapp is deployed at `~/docker/` on the NAS.

## Current Status

**Frontend**: ✅ Running on Python HTTP server (127.0.0.1:20180)
**Backend**: ✅ Running on Docker (127.0.0.1:3001)

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
