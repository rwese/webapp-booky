# Booky Backend Lite

A lightweight, self-contained backend for the Booky book collection app using SQLite instead of PostgreSQL.

## Features

- **SQLite Database**: Single file, no server required, ~1MB footprint
- **JWT Authentication**: Simple email/password with bcrypt password hashing
- **Core APIs**: Books, Tags, Collections, Ratings, Reading Logs
- **File Uploads**: Local filesystem storage for book covers
- **Rate Limiting**: Built-in protection against abuse
- **Minimal Dependencies**: Reduced attack surface and resource usage

## Resource Requirements

| Resource | Target | Comparison (Full Backend) |
| -------- | ------ | ------------------------- |
| Memory   | < 50MB | 500MB+                    |
| Disk     | < 10MB | 100MB+                    |
| Startup  | < 2s   | 10s+                      |

## Quick Start

### 1. Install Dependencies

```bash
cd backend-lite
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Initialize Database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start at `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Books

- `GET /api/books` - List books (with pagination, filtering, sorting)
- `GET /api/books/:id` - Get single book
- `POST /api/books` - Create book
- `PUT /api/books/:id` - Update book
- `DELETE /api/books/:id` - Delete book

### Tags

- `GET /api/tags` - List tags
- `POST /api/tags` - Create tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag
- `POST /api/tags/:tagId/books/:bookId` - Add tag to book
- `DELETE /api/tags/:tagId/books/:bookId` - Remove tag from book

### Collections

- `GET /api/collections` - List collections
- `GET /api/collections/:id` - Get collection with books
- `POST /api/collections` - Create collection
- `PUT /api/collections/:id` - Update collection
- `DELETE /api/collections/:id` - Delete collection
- `POST /api/collections/:id/books` - Add book to collection
- `DELETE /api/collections/:id/books/:bookId` - Remove book from collection
- `PUT /api/collections/:id/books/reorder` - Reorder books

### Ratings

- `GET /api/ratings` - List ratings
- `POST /api/ratings` - Create/update rating
- `DELETE /api/ratings/:bookId` - Delete rating
- `GET /api/ratings/stats` - Get rating statistics

### Reading Logs

- `GET /api/reading` - List reading logs
- `POST /api/reading` - Create/update reading log
- `DELETE /api/reading/:bookId` - Delete reading log
- `GET /api/reading/stats` - Get reading statistics

### Utilities

- `GET /health` - Health check
- `GET /api` - API information
- `POST /api/upload/cover` - Upload book cover image

## Environment Variables

| Variable                  | Description               | Default                |
| ------------------------- | ------------------------- | ---------------------- |
| `DATABASE_PATH`           | SQLite database file path | `./data/booky.db`      |
| `JWT_SECRET`              | Secret key for JWT tokens | `dev-secret-change-me` |
| `JWT_EXPIRES_IN`          | Token expiration time     | `7d`                   |
| `PORT`                    | Server port               | `3001`                 |
| `NODE_ENV`                | Environment mode          | `development`          |
| `UPLOAD_DIR`              | Upload directory          | `./uploads`            |
| `MAX_FILE_SIZE`           | Max upload size (bytes)   | `5242880`              |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window         | `900000`               |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window   | `100`                  |

## Production Deployment

1. Build the application:

   ```bash
   npm run build
   ```

2. Set production environment:

   ```bash
   export NODE_ENV=production
   export JWT_SECRET=<strong-random-secret>
   ```

3. Start the server:
   ```bash
   npm start
   ```

## Development with Watch Mode

```bash
npm run dev
```

Uses `tsx` for fast TypeScript execution with hot reload.

## Testing

```bash
# Run tests
npm test

# With coverage
npm run test:coverage
```

## Database Management

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with sample data
npm run db:seed
```

## Differences from Full Backend

| Feature  | Full Backend  | Lite Backend |
| -------- | ------------- | ------------ |
| Database | PostgreSQL    | SQLite       |
| Cache    | Redis         | In-memory    |
| Auth     | OAuth + JWT   | JWT only     |
| Email    | AWS SES       | Console only |
| Social   | Yes           | No           |
| Sync     | Complex queue | Simplified   |
| Metrics  | Prometheus    | Logging only |

## License

MIT
