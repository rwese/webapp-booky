# Database Architecture & Schema Design

## Overview

This document describes the PostgreSQL database architecture implemented for the Booky web application, replacing the existing IndexedDB storage with a full backend database solution.

## Technology Stack

- **Database**: PostgreSQL 15+
- **ORM**: Prisma 7.2.0
- **Backend**: Express.js 4.18
- **Language**: TypeScript 5.3

## Schema Design

### Core Entities

#### Users

Stores user accounts for authentication and data isolation.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  settings      UserSettings?
  books         Book[]
  ratings       Rating[]
  tags          Tag[]
  collections   Collection[]
  readingLogs   ReadingLog[]
  syncOperations SyncOperation[]
}
```

#### Books

Main entity storing all book information with extensive metadata support.

```prisma
model Book {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title           String
  subtitle        String?
  authors         String[]
  isbn13          String?  @unique
  coverUrl        String?
  localCoverPath  String?
  description     String?
  publisher       String?
  publishedYear   Int?
  publishedDate   String?
  pageCount       Int?
  format          String   @default("physical")
  addedAt         DateTime @default(now())
  externalIds     Json?
  needsSync       Boolean  @default(true)
  localOnly       Boolean  @default(false)

  // ... extensive metadata fields
}
```

### Relationship Tables

#### Book Tags (Many-to-Many)

```prisma
model BookTag {
  id      String @id @default(cuid())
  bookId  String
  book    Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)
  tagId   String
  tag     Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([bookId, tagId])
}
```

#### Collection Books (Many-to-Many with ordering)

```prisma
model CollectionBook {
  id           String     @id @default(cuid())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  bookId       String
  book         Book       @relation(fields: [bookId], references: [id], onDelete: Cascade)
  order        Int        @default(0)
  addedAt      DateTime   @default(now())

  @@unique([collectionId, bookId])
}
```

### Performance Indexes

All tables include strategic indexes for common query patterns:

```prisma
@@index([userId])
@@index([isbn13])
@@index([format])
@@index([addedAt])
@@index([userId, addedAt])
```

## Setup Instructions

### Prerequisites

1. **PostgreSQL 15+** installed locally or via Docker
2. **Node.js 18+** with npm or bun

### Installation

1. **Install dependencies**:

   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**:

   ```bash
   # Edit .env.local
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/booky?schema=public"
   ```

3. **Create database**:

   ```bash
   # If using PostgreSQL directly
   createdb booky

   # Or using Docker
   docker run --name booky-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=booky -p 5432:5432 -d postgres:15
   ```

4. **Generate Prisma client**:

   ```bash
   npx prisma generate
   ```

5. **Run migrations**:
   ```bash
   npx prisma db push
   ```

### Development Workflow

1. **Start development server**:

   ```bash
   npm run dev
   ```

2. **Access API**:
   - Base URL: `http://localhost:3001`
   - Health check: `GET /api/health`
   - Books: `GET/POST /api/books?userId=<id>`
   - Collections: `GET/POST /api/collections?userId=<id>`
   - Tags: `GET/POST /api/tags?userId=<id>`
   - Sync: `GET /api/sync/status?userId=<id>`

### Database Operations

The database service (`src/database.ts`) provides comprehensive CRUD operations:

```typescript
// Book operations
const books = await bookService.getAll(userId)
const book = await bookService.getById(bookId)
const newBook = await bookService.create(userId, bookData)
await bookService.update(bookId, changes)
await bookService.delete(bookId)

// Collection operations
const collections = await collectionService.getAll(userId)
await collectionService.addBookToCollection(collectionId, bookId)

// Sync operations
await syncService.queueOperation(userId, operation)
const pending = await syncService.getPendingOperations(userId)
```

### Migration Management

1. **Create new migration**:

   ```bash
   npx prisma migrate dev --name migration_name
   ```

2. **Apply migrations to production**:

   ```bash
   npx prisma migrate deploy
   ```

3. **Reset database (development only)**:
   ```bash
   npx prisma migrate reset
   ```

### Schema Updates

When modifying the schema:

1. **Update `prisma/schema.prisma`**
2. **Run development migration**:
   ```bash
   npx prisma migrate dev
   ```
3. **Update TypeScript types** in `src/types/index.ts` to match
4. **Update database service** if new operations needed

## Performance Considerations

### Index Strategy

- **Composite indexes** for common query combinations
- **User-scoped indexes** for multi-tenant queries
- **Timestamp indexes** for sync and filtering operations

### Query Optimization

- Use `select` to limit fetched fields
- Implement pagination for large result sets
- Utilize Prisma's `include` for relation loading
- Consider database-level filtering for complex queries

### Scaling Considerations

- Connection pooling via Prisma's built-in pool
- Read replicas for heavy read workloads
- Database-level caching for frequently accessed data
- Pagination and lazy loading for large datasets

## Security & Compliance

### Data Isolation

- All queries scoped to `userId` for multi-tenancy
- Cascade delete ensures data consistency
- No cross-user data access possible

### GDPR Compliance

- User data easily exportable via API
- Cascade deletion removes all user data
- No data retention beyond user control

## API Endpoints

### Books

- `GET /api/books?userId=<id>` - List all books
- `GET /api/books/:id` - Get single book
- `POST /api/books` - Create book
- `PUT /api/books/:id` - Update book
- `DELETE /api/books/:id` - Delete book

### Collections

- `GET /api/collections?userId=<id>` - List collections
- `POST /api/collections` - Create collection

### Tags

- `GET /api/tags?userId=<id>` - List tags
- `POST /api/tags` - Create tag

### Sync

- `GET /api/sync/status?userId=<id>` - Get sync status
- `POST /api/sync/operations` - Queue sync operations
- `POST /api/sync/full` - Full data sync

## Error Handling

All endpoints include comprehensive error handling:

```typescript
try {
  const result = await operation()
  res.json(result)
} catch (error) {
  console.error("Operation error:", error)
  res.status(500).json({ error: "Operation failed" })
}
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:e2e
```

## Deployment

### Production Setup

1. **Set production DATABASE_URL**:

   ```bash
   DATABASE_URL="postgresql://user:pass@host:5432/booky?schema=public"
   ```

2. **Run migrations**:

   ```bash
   npx prisma migrate deploy
   ```

3. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Future Improvements

- **Authentication integration**: Add JWT-based auth
- **Real-time sync**: WebSocket support for live updates
- **Search optimization**: Elasticsearch for full-text search
- **Analytics**: Separate analytics database
- **Caching**: Redis for frequently accessed data
- **Backup strategy**: Automated database backups
