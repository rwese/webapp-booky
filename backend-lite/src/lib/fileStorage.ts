/**
 * File Storage Service for Backend-Lite
 * 
 * Handles local file storage for book cover images.
 * Simplified version adapted from main backend.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Ensure uploads directory exists
const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};

// Initialize on module load
ensureUploadsDir();

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  entityType: string; // 'cover'
  entityId: string;
  path: string;
  createdAt: Date;
  checksum: string;
}

export interface UploadResult {
  success: boolean;
  file?: FileMetadata;
  coverUrl?: string;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Calculate file checksum
 */
function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validate uploaded file
 */
export function validateFileUpload(buffer: Buffer, mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return { valid: false, error: `Invalid file type. Only ${ALLOWED_IMAGE_TYPES.join(', ')} are allowed.` };
  }
  
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` };
  }
  
  return { valid: true };
}

/**
 * Upload cover image for a book
 */
export async function uploadCoverImage(
  userId: string,
  bookId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFileUpload(buffer, mimeType);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Generate unique file ID
    const fileId = crypto.randomUUID();
    const checksum = calculateChecksum(buffer);
    
    // Create entity directory (books/{bookId})
    const entityDir = path.join(UPLOADS_DIR, 'covers', bookId);
    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }
    
    // Generate filename with checksum to prevent duplicates
    const ext = path.extname(originalName);
    const filename = `${fileId}${ext}`;
    const filePath = path.join(entityDir, filename);
    
    // Save file
    fs.writeFileSync(filePath, buffer);
    
    // Create metadata
    const metadata: FileMetadata = {
      id: fileId,
      originalName,
      mimeType,
      size: buffer.length,
      entityType: 'cover',
      entityId: bookId,
      path: filePath,
      createdAt: new Date(),
      checksum,
    };
    
    // Save metadata as JSON alongside file
    const metadataPath = path.join(entityDir, `${fileId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Return cover URL (relative path)
    const coverUrl = `/uploads/covers/${bookId}/${filename}`;
    
    return {
      success: true,
      file: metadata,
      coverUrl,
    };
  } catch (error) {
    console.error('Error uploading cover image:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

/**
 * Delete cover image for a book
 */
export async function deleteCoverImage(bookId: string): Promise<DeleteResult> {
  try {
    const entityDir = path.join(UPLOADS_DIR, 'covers', bookId);
    
    if (!fs.existsSync(entityDir)) {
      return { success: true }; // Nothing to delete
    }
    
    // Delete all files in the directory
    const files = fs.readdirSync(entityDir);
    for (const file of files) {
      const filePath = path.join(entityDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete the directory
    fs.rmdirSync(entityDir);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting cover image:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
}

/**
 * Get cover image info for a book
 */
export async function getCoverImage(bookId: string): Promise<FileMetadata | null> {
  try {
    const entityDir = path.join(UPLOADS_DIR, 'covers', bookId);
    
    if (!fs.existsSync(entityDir)) {
      return null;
    }
    
    // Find metadata file
    const files = fs.readdirSync(entityDir);
    const metadataFile = files.find(f => f.endsWith('.json'));
    
    if (!metadataFile) {
      return null;
    }
    
    const metadataPath = path.join(entityDir, metadataFile);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    
    return metadata as FileMetadata;
  } catch (error) {
    console.error('Error getting cover image:', error);
    return null;
  }
}

/**
 * Get cover image file path
 */
export async function getCoverImagePath(bookId: string): Promise<string | null> {
  const metadata = await getCoverImage(bookId);
  if (!metadata) {
    return null;
  }
  
  const entityDir = path.join(UPLOADS_DIR, 'covers', bookId);
  const files = fs.readdirSync(entityDir);
  const imageFile = files.find(f => !f.endsWith('.json'));
  
  if (!imageFile) {
    return null;
  }
  
  return path.join(entityDir, imageFile);
}

/**
 * Get storage usage for a user
 */
export async function getStorageUsage(userId: string): Promise<{ totalFiles: number; totalSize: number }> {
  try {
    const coversDir = path.join(UPLOADS_DIR, 'covers');
    
    if (!fs.existsSync(coversDir)) {
      return { totalFiles: 0, totalSize: 0 };
    }
    
    let totalFiles = 0;
    let totalSize = 0;
    
    const books = fs.readdirSync(coversDir);
    for (const bookId of books) {
      const bookDir = path.join(coversDir, bookId);
      if (fs.statSync(bookDir).isDirectory()) {
        const files = fs.readdirSync(bookDir);
        for (const file of files) {
          const filePath = path.join(bookDir, file);
          if (fs.statSync(filePath).isFile()) {
            totalFiles++;
            totalSize += fs.statSync(filePath).size;
          }
        }
      }
    }
    
    return { totalFiles, totalSize };
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return { totalFiles: 0, totalSize: 0 };
  }
}
