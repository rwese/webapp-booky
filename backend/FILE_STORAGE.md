# File Storage API

## Overview

This document describes the comprehensive file storage system implemented for the Booky web application. The system handles storage, optimization, and delivery of book cover images, import files, and user avatars.

## Features

### Core Functionality

- **Cover Image Upload** - Upload and optimize book cover images
- **Image Variants** - Automatic generation of multiple sizes (thumbnail, small, medium, large)
- **Import File Support** - Upload JSON, CSV, and other import files
- **Avatar Management** - User profile picture handling
- **Bulk Operations** - Upload multiple files at once

### Performance Features

- **Image Optimization** - Automatic compression and resizing
- **CDN Integration** - Fast content delivery via CDN
- **Smart Caching** - 1-year cache headers for images
- **Variant Generation** - On-demand size variants

### Management Features

- **Storage Tracking** - Per-user storage usage monitoring
- **Orphaned File Cleanup** - Automatic cleanup of unused files
- **Validation** - File type and size validation
- **Security** - Secure upload and access control

## Architecture

### Storage Types

#### Local Storage (Development)

```
./storage/
├── covers/
│   ├── originals/    # Original uploaded images
│   ├── thumbnail/    # 100x150 thumbnails
│   ├── small/        # 200x300 small images
│   ├── medium/       # 400x600 medium images
│   └── large/        # 800x1200 large images
├── imports/          # Import files (JSON, CSV)
├── avatars/          # User profile pictures
└── tmp/              # Temporary files
```

#### Cloud Storage (Production)

- **AWS S3** - Primary cloud storage option
- **Cloudinary** - Alternative with built-in optimization
- **Custom CDN** - Integration with any CDN provider

### Image Processing Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│  Validate   │────▶│  Optimize   │────▶│  Generate   │
│   File      │     │  Type/Size  │     │  Compress   │     │  Variants   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                          ┌─────────────┐
                                                          │   Store &   │
                                                          │   Cache     │
                                                          └─────────────┘
```

## API Endpoints

### Cover Image Upload

#### Upload Single Cover

```http
POST /api/files/cover/:bookId
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file=<image_file>
```

**Response (201 Created)**:

```json
{
  "success": true,
  "message": "Cover image uploaded successfully",
  "file": {
    "id": "uuid-here",
    "originalName": "book-cover.jpg",
    "mimeType": "image/jpeg",
    "size": 245678,
    "entityType": "cover",
    "entityId": "book-123",
    "path": "covers/originals/uuid.jpg",
    "variants": ["thumbnail", "small", "medium", "large"],
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "variants": {
    "thumbnail": "covers/thumbnail/uuid.jpg",
    "small": "covers/small/uuid.jpg",
    "medium": "covers/medium/uuid.jpg",
    "large": "covers/large/uuid.jpg"
  }
}
```

#### Upload Bulk Covers

```http
POST /api/files/covers/bulk
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

covers[0]=<image_file_1>
covers[1]=<image_file_2>
bookId_cover0="book-1"
bookId_cover1="book-2"
```

**Response (201 Created)**:

```json
{
  "success": true,
  "uploaded": 2,
  "errors": 0,
  "results": [
    {
      "bookId": "book-1",
      "file": {
        /* file metadata */
      },
      "variants": {
        /* variant paths */
      }
    },
    {
      "bookId": "book-2",
      "file": {
        /* file metadata */
      },
      "variants": {
        /* variant paths */
      }
    }
  ]
}
```

#### Delete Cover

```http
DELETE /api/files/cover/:bookId
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "Cover image deleted successfully"
}
```

### File Retrieval

#### Get Cover Image (Original)

```http
GET /api/files/cover/:bookId
```

**Response**: Image file with `Content-Type: image/jpeg`

#### Get Cover Image Variant

```http
GET /api/files/cover/:bookId/:size
```

**Valid Sizes**: `thumbnail`, `small`, `medium`, `large`

**Response**: Image file with 1-year cache header

**Example**:

```http
GET /api/files/cover/book-123/medium
```

### Import File Upload

#### Upload Import File

```http
POST /api/files/import
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file=<import_file>
```

**Response (201 Created)**:

```json
{
  "success": true,
  "message": "Import file uploaded successfully",
  "file": {
    "id": "uuid-here",
    "originalName": "library-export.json",
    "mimeType": "application/json",
    "size": 1048576,
    "entityType": "import",
    "path": "imports/uuid.json",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Avatar Upload

#### Upload Avatar

```http
POST /api/files/avatar
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

avatar=<image_file>
```

**Response (201 Created)**:

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "file": {
    "id": "uuid-here",
    "originalName": "profile.jpg",
    "mimeType": "image/jpeg",
    "size": 125678,
    "entityType": "avatar",
    "path": "avatars/uuid.jpg",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Storage Management

#### Get Storage Usage

```http
GET /api/files/usage
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "usage": {
    "userId": "user-123",
    "totalFiles": 50,
    "totalSize": 52428800, // 50MB in bytes
    "byType": {
      "covers": {
        "count": 45,
        "size": 47185920 // 45MB
      },
      "imports": {
        "count": 3,
        "size": 3145728 // 3MB
      },
      "avatars": {
        "count": 2,
        "size": 2097152 // 2MB
      }
    }
  }
}
```

#### Get Storage Statistics

```http
GET /api/files/stats
```

**Response (200 OK)**:

```json
{
  "success": true,
  "stats": {
    "totalSize": 1073741824, // 1GB in bytes
    "totalFiles": 500,
    "directorySizes": {
      "covers": 859832320,
      "imports": 157286400,
      "avatars": 56623104,
      "tmp": 1048576
    }
  }
}
```

#### Cleanup Orphaned Files

```http
POST /api/files/cleanup
Authorization: Bearer <access_token>
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "Cleanup completed",
  "cleaned": 25,
  "errors": []
}
```

## Image Variants

### Size Specifications

| Variant     | Width | Height | Use Case          |
| ----------- | ----- | ------ | ----------------- |
| `thumbnail` | 100px | 150px  | Grid views, lists |
| `small`     | 200px | 300px  | Cards, previews   |
| `medium`    | 400px | 600px  | Detail views      |
| `large`     | 800px | 1200px | Full-size display |

### Usage Examples

```javascript
// Get different sizes
const getCoverUrl = (bookId, size = "medium") =>
  `${API_BASE}/api/files/cover/${bookId}/${size}`

// Example URLs
const thumbnail = "/api/files/cover/book-123/thumbnail"
const medium = "/api/files/cover/book-123/medium"
const large = "/api/files/cover/book-123/large"
```

## Frontend Integration

### Upload Cover Image

```typescript
import { fileApi } from "./lib/api"

async function uploadCover(bookId: string, file: File) {
  try {
    const result = await fileApi.uploadCover(bookId, file)

    if (result.success) {
      console.log("Cover uploaded:", result.variants)
      // Set the cover URL in your state
      return result.variants.medium
    } else {
      console.error("Upload failed:", result.error)
    }
  } catch (error) {
    console.error("Upload error:", error)
  }
}
```

### Get Cover Image

```typescript
// Get cover with specific size
const getCoverImage = async (bookId: string, size = "medium") => {
  const response = await fetch(`/api/files/cover/${bookId}/${size}`)

  if (response.ok) {
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  return null // or fallback image
}
```

### Check Storage Usage

```typescript
const checkStorage = async () => {
  const response = await fetch("/api/files/usage", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const data = await response.json()

  if (data.success) {
    const { totalSize, totalFiles } = data.usage
    console.log(`Using ${totalSize / 1024 / 1024}MB across ${totalFiles} files`)
  }
}
```

## Configuration

### Environment Variables

```env
# Storage Configuration
STORAGE_TYPE="local"                    # 'local' or 's3'
STORAGE_PATH="./storage"                 # Local storage path
MAX_FILE_SIZE="10485760"                 # 10MB in bytes
ALLOWED_IMAGE_TYPES="image/jpeg,image/png,image/gif,image/webp"

# CDN Configuration
CDN_URL="https://cdn.booky.app"         # CDN base URL
CDN_ENABLED="false"                     # Enable CDN integration

# AWS S3 Configuration (for production)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="booky-storage"
AWS_S3_ENDPOINT="s3.amazonaws.com"
```

### CDN Integration

To enable CDN delivery:

1. **Set up CDN** (CloudFront, Cloudflare, etc.)
2. **Configure environment**:
   ```env
   CDN_URL="https://cdn.booky.app"
   CDN_ENABLED="true"
   ```
3. **Update DNS** to point to CDN
4. **Configure caching** rules for image files

The API will automatically:

- Generate CDN URLs for all files
- Set appropriate cache headers
- Optimize for CDN delivery

## Security

### Upload Security

- **File Type Validation** - Only allow approved image types
- **Size Limits** - Prevent resource exhaustion
- **Authentication** - All uploads require valid JWT
- **Virus Scanning** - Ready for ClamAV integration

### Access Control

- **User Isolation** - Users can only access their own files
- **Token Validation** - All endpoints validate JWT tokens
- **Path Traversal Protection** - Prevent directory traversal attacks

### Best Practices

1. **Use HTTPS** - Always use HTTPS in production
2. **Limit File Types** - Only allow necessary file types
3. **Set Size Limits** - Prevent large file attacks
4. **Validate Inputs** - Sanitize all file uploads
5. **Monitor Usage** - Track storage and bandwidth

## Performance

### Optimization Strategies

- **Image Compression** - Reduce file size without quality loss
- **Variant Generation** - Serve appropriate sizes
- **CDN Caching** - 1-year cache for images
- **Gzip Compression** - Compress responses

### Recommended Sizes

- **Thumbnails**: 100x150px, ~5KB
- **Small**: 200x300px, ~15KB
- **Medium**: 400x600px, ~40KB
- **Large**: 800x1200px, ~100KB

### Scaling Considerations

- **Local Storage**: Good for development, limited scaling
- **S3 Storage**: Excellent scalability, pay per use
- **CDN**: Essential for global audience
- **Database**: Track file references for cleanup

## Monitoring

### Key Metrics

- Upload success/failure rate
- File size distribution
- Storage usage per user
- CDN cache hit rate
- Average upload time

### Logging

All operations are logged for auditing:

- Upload attempts (success/failure)
- File access patterns
- Storage cleanup operations
- Error occurrences

### Alerts

Configure alerts for:

- High storage usage (>80% of quota)
- Upload failure rate (>5%)
- Unusual access patterns
- CDN cache miss rate

## Testing

### Unit Tests

```bash
npm test
```

**Test Coverage**:

- File validation
- Image processing
- Variant generation
- Storage operations

### Integration Tests

```bash
npm run test:e2e
```

**Test Scenarios**:

- Upload flow
- Image retrieval
- Storage tracking
- Cleanup operations

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001

# Create storage directory
RUN mkdir -p /app/storage

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    volumes:
      - ./storage:/app/storage
    environment:
      - STORAGE_PATH=/app/storage
      - STORAGE_TYPE=local
```

### Production Setup

1. **Configure S3** for scalable storage
2. **Set up CDN** for fast delivery
3. **Configure monitoring** and alerts
4. **Set up backup** for storage metadata
5. **Configure auto-scaling** if using cloud

## Troubleshooting

### Common Issues

#### Upload Fails

1. Check file size limit (max 10MB)
2. Verify file type (JPEG, PNG, GIF, WebP)
3. Check authentication token
4. Review server logs

#### Images Not Loading

1. Verify file path in database
2. Check file exists in storage
3. Validate CDN configuration
4. Check URL format

#### Slow Uploads

1. Check network connection
2. Verify image size
3. Review server resources
4. Check CDN configuration

### Debug Commands

```bash
# Check storage directory
ls -la storage/

# Check file stats
stat storage/covers/originals/<file-id>

# Monitor uploads
tail -f logs/server.log | grep "upload"

# Check storage usage
du -sh storage/
```

## Future Improvements

### Planned Features

- **Video Covers**: Support for book trailers
- **Watermarking**: Automatic watermark insertion
- **AI Tagging**: Auto-generate tags from images
- **Face Detection**: Identify authors in covers
- **Background Removal**: Auto-remove backgrounds

### Performance Optimizations

- **Progressive Loading**: Load images progressively
- **WebP Support**: Convert to WebP for smaller size
- **Lazy Loading**: On-demand image loading
- **Pre-generation**: Generate variants on upload

### Integration Opportunities

- **OCR Integration**: Extract text from covers
- **ML Services**: Use AI for cover analysis
- **Third-party APIs**: Integrate with book databases
- **Social Sharing**: Auto-generate share images

## API Reference

### Quick Reference

| Method | Endpoint                         | Description            |
| ------ | -------------------------------- | ---------------------- |
| POST   | `/api/files/cover/:bookId`       | Upload cover image     |
| DELETE | `/api/files/cover/:bookId`       | Delete cover image     |
| GET    | `/api/files/cover/:bookId`       | Get cover (original)   |
| GET    | `/api/files/cover/:bookId/:size` | Get cover variant      |
| POST   | `/api/files/covers/bulk`         | Upload multiple covers |
| POST   | `/api/files/import`              | Upload import file     |
| POST   | `/api/files/avatar`              | Upload avatar          |
| GET    | `/api/files/usage`               | Get storage usage      |
| GET    | `/api/files/stats`               | Get storage stats      |
| POST   | `/api/files/cleanup`             | Clean orphaned files   |

### Error Codes

| Code                  | Description                |
| --------------------- | -------------------------- |
| `VALIDATION_ERROR`    | Invalid file or parameters |
| `UPLOAD_FAILED`       | File upload failed         |
| `NOT_FOUND`           | File not found             |
| `INVALID_SIZE`        | Invalid variant size       |
| `UNAUTHORIZED`        | Authentication required    |
| `RATE_LIMIT_EXCEEDED` | Too many requests          |
