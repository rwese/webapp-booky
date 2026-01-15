# User Data Sync API

## Overview

This document describes the comprehensive synchronization system implemented for the Booky web application. The system enables real-time data synchronization between client devices and the backend server, supporting offline-first workflows, conflict resolution, and incremental updates.

## Features

### Core Sync Capabilities

- **Real-time Sync** - Automatic synchronization when online
- **Offline Support** - Queue operations when offline, sync when back online
- **Incremental Updates** - Only sync changes since last sync timestamp
- **Full Sync** - Complete data replacement for initial setup or recovery
- **Batch Operations** - Efficient bulk data transfer

### Conflict Management

- **Automatic Detection** - Identify conflicting changes
- **Last-Write-Wins** - Automatic resolution strategy
- **Merge Support** - Recursive data merging for complex objects
- **Conflict Logging** - Track unresolved conflicts

### Data Integrity

- **Server Validation** - All incoming data validated on server
- **Type Safety** - Full TypeScript type checking
- **Transaction Support** - Atomic operations for data consistency
- **Error Recovery** - Graceful handling of sync failures

## Architecture

### Sync Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Queue     │────▶│   Backend   │
│   (Offline) │     │   Buffer    │     │   Server    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                        │
       │           ┌─────────────┐              │
       └──────────▶│   Status    │◀─────────────┘
                   │   Tracker   │
                   └─────────────┘
```

### Components

1. **Client Sync Service** - Manages online/offline state and operation queue
2. **Sync Queue** - PostgreSQL table storing pending operations
3. **Sync Service** - Backend logic for processing sync operations
4. **Conflict Resolver** - Handles data conflicts automatically
5. **Change Tracker** - Monitors data changes for incremental sync

## API Endpoints

### Sync Operations

#### Process Sync Operations

```http
POST /api/sync/operations
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operations": [
    {
      "id": "op-123",
      "type": "create",
      "entity": "book",
      "entityId": "book-456",
      "data": { /* book data */ },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Response (200 OK)**:

```json
{
  "results": [
    {
      "id": "op-123",
      "status": "success",
      "entity": "book",
      "entityId": "book-456"
    }
  ]
}
```

#### Get Sync Status

```http
GET /api/sync/status
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "status": "ready",
  "lastSync": "2024-01-15T10:30:00Z",
  "pendingOperations": 5,
  "conflicts": 0
}
```

#### Get Pending Operations

```http
GET /api/sync/pending
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "operations": [
    {
      "id": "op-123",
      "type": "create",
      "entity": "book",
      "entityId": "book-456",
      "data": {
        /* operation data */
      },
      "timestamp": "2024-01-15T10:30:00Z",
      "synced": false
    }
  ]
}
```

#### Get Changes Since Timestamp (Incremental Sync)

```http
GET /api/sync/changes?since=2024-01-15T10:00:00Z
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "changes": [
    {
      "type": "book",
      "data": {
        /* book data with updatedAt > since */
      }
    },
    {
      "type": "rating",
      "data": {
        /* rating data */
      }
    }
  ],
  "since": "2024-01-15T10:00:00Z"
}
```

#### Full Sync (Replace All Data)

```http
POST /api/sync/full
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "books": [ /* all books */ ],
  "collections": [ /* all collections */ ],
  "tags": [ /* all tags */ ],
  "readings": [ /* all reading logs */ ],
  "settings": { /* user settings */ }
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "syncedAt": "2024-01-15T10:30:00Z"
}
```

#### Queue Sync Operation

```http
POST /api/sync/queue
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "update",
  "entity": "book",
  "entityId": "book-456",
  "data": { /* changes */ }
}
```

**Response (201 Created)**:

```json
{
  "success": true,
  "operation": {
    "id": "op-789",
    "type": "update",
    "entity": "book",
    "entityId": "book-456",
    "timestamp": "2024-01-15T10:30:00Z",
    "synced": false
  }
}
```

#### Mark Operations as Synced

```http
POST /api/sync/mark-synced
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "operationIds": ["op-123", "op-456", "op-789"]
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "Marked 3 operations as synced"
}
```

#### Clear Synced Operations

```http
DELETE /api/sync/clear
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "Cleared synced operations"
}
```

## Supported Entities

| Entity         | Operations             | Description                      |
| -------------- | ---------------------- | -------------------------------- |
| `book`         | create, update, delete | Book entries and metadata        |
| `rating`       | create, update, delete | User ratings and reviews         |
| `tag`          | create, update, delete | User-defined tags                |
| `collection`   | create, update, delete | Book collections and smart lists |
| `readingLog`   | create, update, delete | Reading progress and status      |
| `userSettings` | create, update, delete | User preferences and settings    |

## Sync Strategies

### 1. Incremental Sync

- **Use Case**: Regular synchronization of changes
- **Flow**: Client requests changes since last sync timestamp
- **Efficiency**: Only transfers modified data
- **Frequency**: Every 30 seconds when online

### 2. Full Sync

- **Use Case**: Initial setup, data recovery, conflict resolution
- **Flow**: Client sends all data, server replaces existing data
- **Data Integrity**: Uses database transactions
- **Frequency**: On first login, manual trigger, or conflict resolution

### 3. Operation Queue Sync

- **Use Case**: Offline-first workflow
- **Flow**: Queue operations locally, process when online
- **Reliability**: Persistent queue with retry logic
- **Fallback**: Manual sync trigger available

## Conflict Resolution

### Detection

Conflicts are detected when:

1. Local data has been modified after last sync
2. Server data has been modified after last sync
3. Modification timestamps overlap

### Resolution Strategy

1. **Last-Write-Wins**: Most recent timestamp wins
2. **Automatic Merge**: Recursive object merging for complex data
3. **Server Preference**: Server data takes precedence if timestamps equal
4. **Manual Resolution**: Conflicts logged for manual review

### Conflict Data Structure

```typescript
interface ConflictInfo {
  localData: any
  serverData: any
  localTimestamp: Date
  serverTimestamp: Date
  entity: string
  entityId: string
}
```

## Client Integration

### Sync Service Usage

```typescript
import { syncService } from "./services/syncService"

// Start automatic sync monitoring
syncService.startMonitoring()

// Manual sync trigger
await syncService.sync()

// Force full sync
await syncService.fullSync()

// Get current sync status
const status = await syncService.getStatus()
```

### Sync Queue Operations

```typescript
// Queue an operation for sync
await syncService.queueOperation("book", "book-123", "update", {
  title: "Updated Title",
})

// Get pending operations count
const pending = (await syncOperations.getPendingOperations()).length
```

### Offline Handling

```typescript
// Subscribe to online/offline changes
const unsubscribe = syncService.subscribe((isOnline) => {
  if (isOnline) {
    console.log("Back online - syncing...")
    syncService.sync()
  } else {
    console.log("Offline - operations will be queued")
  }
})

// Check online status
const isOnline = syncService.getOnlineStatus()
```

## Performance Considerations

### Optimization Strategies

- **Batch Processing**: Process operations in batches of 10
- **Incremental Updates**: Only sync changes since last sync
- **Compression**: Gzip compression for large payloads
- **Pagination**: Paginate large result sets

### Rate Limiting

- **Global Limit**: 100 requests per 15 minutes
- **Sync Endpoints**: Included in global limit
- **Burst Protection**: Exponential backoff on failures

### Scalability

- **Database Indexing**: Optimized indexes on sync tables
- **Connection Pooling**: Prisma connection pool
- **Read Replicas**: Support for read-heavy workloads

## Error Handling

### Error Codes

| Code                | Description              | Action                         |
| ------------------- | ------------------------ | ------------------------------ |
| `SYNC_FAILED`       | Batch processing failed  | Retry with exponential backoff |
| `VALIDATION_ERROR`  | Invalid operation data   | Fix data and retry             |
| `UNAUTHORIZED`      | Invalid or missing token | Re-authenticate                |
| `CONFLICT_DETECTED` | Data conflict detected   | Automatic resolution           |
| `RATE_LIMITED`      | Too many requests        | Wait and retry                 |

### Retry Strategy

1. **Immediate Retry**: First failure
2. **Exponential Backoff**: 1s, 2s, 4s, 8s...
3. **Max Retries**: 5 attempts
4. **Manual Intervention**: Queue for manual review

## Security

### Authentication

- All sync endpoints require authentication
- JWT token validation via `Authorization` header
- User data isolation by `userId`

### Data Validation

- Server-side validation of all incoming data
- Type checking with TypeScript
- SQL injection prevention via Prisma

### Privacy

- No cross-user data access
- Encrypted token storage
- GDPR-compliant data handling

## Monitoring & Logging

### Key Metrics

- Sync success/failure rate
- Average sync duration
- Pending operation count
- Conflict frequency

### Logging

- Sync operations: `{ type, entity, entityId, status }`
- Conflicts: `{ localTimestamp, serverTimestamp, entity, entityId }`
- Errors: `{ error, stack, operation }`

### Alerts

- High conflict rate (> 10%)
- Sync failure rate (> 5%)
- Large pending queue (> 100 operations)

## Testing

### Unit Tests

```bash
npm test
```

**Coverage**:

- Sync operation processing
- Conflict detection
- Merge logic
- Timestamp comparison

### Integration Tests

```bash
npm run test:e2e
```

**Scenarios**:

- Online sync flow
- Offline queue processing
- Conflict resolution
- Full sync recovery

## Deployment

### Production Setup

1. Configure database connection pooling
2. Set up monitoring and alerting
3. Configure rate limiting
4. Enable HTTPS
5. Set up log aggregation

### Docker

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

### Scaling

- **Horizontal**: Multiple server instances behind load balancer
- **Database**: Read replicas for heavy read loads
- **Caching**: Redis for frequently accessed data
- **CDN**: Static asset delivery

## Future Improvements

### Planned Features

- **WebSocket Sync**: Real-time bidirectional sync
- **Selective Sync**: Choose which entities to sync
- **Compression**: Gzip for payload optimization
- **Delta Sync**: Binary diff for minimal data transfer
- **Conflict UI**: Manual conflict resolution interface

### Performance Optimizations

- **Incremental Indexes**: Faster change detection
- **Batch Size Tuning**: Adaptive batch sizes
- **Connection Pooling**: Optimized database connections
- **CDN Integration**: Static asset delivery

## Troubleshooting

### Common Issues

#### Sync Not Working

1. Check authentication token
2. Verify network connectivity
3. Check rate limit status
4. Review server logs

#### Conflicts Not Resolving

1. Check timestamp synchronization
2. Verify client clock accuracy
3. Review conflict logs
4. Manual intervention may be required

#### High Latency

1. Check database performance
2. Monitor connection pool usage
3. Review batch size configuration
4. Consider read replicas

### Diagnostic Commands

```bash
# Check sync status
curl -H "Authorization: Bearer <token>" \
  https://api.booky.app/sync/status

# View pending operations
curl -H "Authorization: Bearer <token>" \
  https://api.booky.app/sync/pending

# Force full sync
curl -X POST -H "Authorization: Bearer <token>" \
  -d '{"force": true}' \
  https://api.booky.app/sync/full
```
