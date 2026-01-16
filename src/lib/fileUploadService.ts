/**
 * File Upload Service
 * 
 * Integrates frontend with Booky backend for file uploads including
 * book covers, avatars, and imports.
 */

import { authService } from './backendAuth';
import { db } from './db';

interface StorageUsageData {
  totalSize: number;
  imagesSize: number;
  dataSize: number;
  lastCleanup: string;
}

const BACKEND_API = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

/**
 * Backend File Storage API
 */
export class FileUploadService {
  /**
   * Upload a book cover image
   */
  async uploadCoverImage(bookId: string, file: File): Promise<{ success: boolean; coverUrl?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('cover', file);

      const response = await fetch(`${BACKEND_API}/files/cover/${bookId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getAccessToken()}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Upload failed' };
      }

      return { success: true, coverUrl: result.coverUrl };
    } catch (error) {
      console.error('Cover upload error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Delete a book cover image
   */
  async deleteCoverImage(bookId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${BACKEND_API}/files/cover/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authService.getAccessToken()}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Delete failed' };
      }

      return { success: true };
    } catch (error) {
      console.error('Cover delete error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
    }
  }

  /**
   * Get a cover image URL (with optional size)
   */
  getCoverUrl(bookId: string, size: 'thumbnail' | 'small' | 'medium' | 'large' = 'medium'): string {
    return `${BACKEND_API}/files/cover/${bookId}/${size}`;
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(file: File): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${BACKEND_API}/files/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getAccessToken()}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Upload failed' };
      }

      return { success: true, avatarUrl: result.avatarUrl };
    } catch (error) {
      console.error('Avatar upload error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Upload import file (CSV, JSON)
   */
  async uploadImportFile(file: File): Promise<{ success: boolean; importId?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('import', file);

      const response = await fetch(`${BACKEND_API}/files/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getAccessToken()}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Upload failed' };
      }

      return { success: true, importId: result.importId };
    } catch (error) {
      console.error('Import upload error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Get storage usage for current user
   */
  async getStorageUsage(): Promise<{ success: boolean; usage?: StorageUsageData; error?: string }> {
    try {
      const usage = await authService.authenticatedFetch<StorageUsageData>(`${BACKEND_API}/files/usage`);
      return { success: true, usage };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get storage usage' };
    }
  }

  /**
   * Bulk upload book covers
   */
  async uploadBulkCovers(
    covers: Map<string, File>, // bookId -> file mapping
    onProgress?: (completed: number, total: number) => void
  ): Promise<{ success: number; failed: number; errors: Map<string, string> }> {
    const results = { success: 0, failed: 0, errors: new Map<string, string>() };
    const entries = Array.from(covers.entries());
    const total = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const [bookId, file] = entries[i];
      
      const result = await this.uploadCoverImage(bookId, file);
      
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.set(bookId, result.error || 'Unknown error');
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return results;
  }

  /**
   * Upload cover to IndexedDB (for offline support)
   */
  async saveCoverLocally(bookId: string, file: File): Promise<void> {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    
    await db.coverImages.put({
      id: bookId,
      blob,
      mimeType: file.type,
      createdAt: new Date(),
    });
  }

  /**
   * Get local cover from IndexedDB
   */
  async getLocalCover(bookId: string): Promise<string | null> {
    const record = await db.coverImages.get(bookId);
    if (!record) return null;
    
    return URL.createObjectURL(record.blob);
  }

  /**
   * Delete local cover from IndexedDB
   */
  async deleteLocalCover(bookId: string): Promise<void> {
    await db.coverImages.delete(bookId);
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();

/**
 * Helper function to create upload progress handler
 */
export function createProgressHandler(
  onProgress?: (progress: number) => void
): (loaded: number, total: number) => void {
  return (loaded: number, total: number) => {
    const progress = Math.round((loaded / total) * 100);
    if (onProgress) {
      onProgress(progress);
    }
  };
}

/**
 * Validate file before upload
 */
export function validateUploadFile(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] } = options;

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Convert file to base64 for local storage
 */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${file.type};base64,${base64}`;
}
