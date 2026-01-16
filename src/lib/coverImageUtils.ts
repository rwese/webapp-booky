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

// Process a cropped blob into a File object
export async function processCroppedImage(
  croppedBlob: Blob,
  bookTitle: string,
  originalFileName?: string
): Promise<{
  file: File;
  filename: string;
  localPath: string;
}> {
  // Determine extension from original file or default to jpeg
  let extension = 'jpg';
  if (originalFileName) {
    const parts = originalFileName.split('.');
    if (parts.length > 1) {
      extension = parts[parts.length - 1].toLowerCase();
    }
  }
  
  // Generate filename
  const filename = generateCoverFilename(bookTitle, extension);
  const localPath = getCoverImageUrl(filename, false);
  
  // Create File from Blob
  const file = new File([croppedBlob], filename, {
    type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
    lastModified: Date.now()
  });
  
  return { file, filename, localPath };
}

// Convert a data URL to a Blob
export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2D context'));
        return;
      }
      ctx.drawImage(image, 0, 0);
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/jpeg', 0.95);
    });
    image.addEventListener('error', error => reject(error));
    image.src = dataUrl;
  });
}

// Get image dimensions from a File or Blob
export function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve({ width: image.width, height: image.height });
    });
    image.addEventListener('error', error => reject(error));
    if (file instanceof Blob) {
      image.src = URL.createObjectURL(file);
    } else {
      image.src = URL.createObjectURL(file);
    }
  });
}

// Check if an image needs cropping (too large or wrong aspect ratio)
export function imageNeedsCropping(
  width: number, 
  height: number,
  targetAspectRatio: number = 16 / 9,
  maxDimension: number = 2000
): boolean {
  const currentAspectRatio = width / height;
  const aspectRatioDiff = Math.abs(currentAspectRatio - targetAspectRatio);
  const aspectThreshold = 0.1; // Allow 10% deviation
  
  return (
    width > maxDimension || 
    height > maxDimension || 
    aspectRatioDiff > aspectThreshold
  );
}
