/**
 * Cover Image Utilities
 * Handles cover image filename generation and storage format
 */

// Generate a book slug from title
export function generateBookSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric characters with hyphens
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 50);             // Limit length
}

// Generate a unique ID for the cover image
export function generateCoverId(): string {
  return crypto.randomUUID().substring(0, 8);
}

// Generate cover image filename in format: bookslug-uid.ext
export function generateCoverFilename(
  title: string, 
  extension: string = 'jpg'
): string {
  const slug = generateBookSlug(title);
  const id = generateCoverId();
  return `${slug}-${id}.${extension}`;
}

// Extract file extension from mime type
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
  };
  
  return mimeToExt[mimeType] || 'jpg';
}

// Extract file extension from filename
import { getFileExtension } from './importUtils';

// Validate cover image file
export function isValidCoverImage(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  return validTypes.includes(file.type) && file.size <= maxSize;
}

// Cover image storage paths
export const COVER_IMAGE_PATHS = {
  local: '/covers/',           // Local storage path
  remote: '/api/covers/',      // Remote API path
  thumbnail: '/covers/thumbnails/', // Thumbnail storage
};

// Get full cover image URL
export function getCoverImageUrl(filename: string, useRemote: boolean = false): string {
  const basePath = useRemote ? COVER_IMAGE_PATHS.remote : COVER_IMAGE_PATHS.local;
  return `${basePath}${filename}`;
}

// Parse cover filename to extract components
export function parseCoverFilename(filename: string): {
  slug: string;
  id: string;
  extension: string;
} | null {
  const match = filename.match(/^(.+)-([a-f0-9]{8})\.(.+)$/i);
  if (!match) return null;
  
  return {
    slug: match[1],
    id: match[2],
    extension: match[3]
  };
}

// Check if filename follows the expected format
export function isValidCoverFilename(filename: string): boolean {
  return parseCoverFilename(filename) !== null;
}

// Example usage and type definitions for cover image handling
export interface CoverImageConfig {
  maxFileSize: number;
  allowedFormats: string[];
  storagePath: string;
}

export const COVER_IMAGE_CONFIG: CoverImageConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  storagePath: '/covers/'
};

// Helper function to process uploaded cover image
export async function processCoverImageUpload(
  file: File, 
  bookTitle: string
): Promise<{
  filename: string;
  localPath: string;
  error?: string;
}> {
  // Validate file
  if (!isValidCoverImage(file)) {
    return {
      filename: '',
      localPath: '',
      error: 'Invalid file type or size'
    };
  }
  
  // Get extension from file
  const extension = getExtensionFromMimeType(file.type);
  
  // Generate filename
  const filename = generateCoverFilename(bookTitle, extension);
  const localPath = getCoverImageUrl(filename, false);
  
  return { filename, localPath };
}