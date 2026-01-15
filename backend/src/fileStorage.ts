import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local' or 's3'
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const COVER_SIZES = {
  thumbnail: { width: 100, height: 150 },
  small: { width: 200, height: 300 },
  medium: { width: 400, height: 600 },
  large: { width: 800, height: 1200 }
};

// Types
interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  entityType: string; // 'cover', 'import', 'avatar'
  entityId?: string;
  path: string;
  variants: string[]; // Array of variant paths (thumbnails, etc.)
  createdAt: Date;
  checksum: string;
}

interface UploadResult {
  success: boolean;
  file?: FileMetadata;
  error?: string;
  variants?: { [key: string]: string };
}

interface StorageUsage {
  userId: string;
  totalFiles: number;
  totalSize: number;
  byType: { [key: string]: { count: number; size: number } };
}

// Get storage base path
const getStoragePath = (): string => {
  const basePath = process.env.STORAGE_PATH || './storage';
  return path.resolve(basePath);
};

// Ensure storage directories exist
const ensureDirectories = () => {
  const basePath = getStoragePath();
  const dirs = [
    basePath,
    path.join(basePath, 'covers'),
    path.join(basePath, 'covers', 'originals'),
    path.join(basePath, 'covers', 'thumbnails'),
    path.join(basePath, 'covers', 'small'),
    path.join(basePath, 'covers', 'medium'),
    path.join(basePath, 'covers', 'large'),
    path.join(basePath, 'imports'),
    path.join(basePath, 'tmp'),
    path.join(basePath, 'avatars')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
};

// Calculate file checksum
const calculateChecksum = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

// Validate file type
const validateFileType = (mimeType: string, allowedTypes: string[] = ALLOWED_IMAGE_TYPES): boolean => {
  return allowedTypes.includes(mimeType);
};

// Generate unique filename
const generateFilename = (originalName: string): string => {
  const ext = path.extname(originalName).toLowerCase();
  const id = uuidv4();
  return `${id}${ext}`;
};

// ==================== LOCAL STORAGE OPERATIONS ====================

/**
 * Store file locally
 */
const storeLocal = async (
  buffer: Buffer,
  relativePath: string,
  filename: string
): Promise<string> => {
  const basePath = getStoragePath();
  const fullPath = path.join(basePath, relativePath, filename);
  
  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  await fs.promises.writeFile(fullPath, buffer);
  return relativePath + '/' + filename;
};

/**
 * Delete local file
 */
const deleteLocal = async (filePath: string): Promise<boolean> => {
  const basePath = getStoragePath();
  const fullPath = path.join(basePath, filePath);
  
  if (fs.existsSync(fullPath)) {
    await fs.promises.unlink(fullPath);
    return true;
  }
  return false;
};

/**
 * Read local file
 */
const readLocal = async (filePath: string): Promise<Buffer | null> => {
  const basePath = getStoragePath();
  const fullPath = path.join(basePath, filePath);
  
  if (fs.existsSync(fullPath)) {
    return await fs.promises.readFile(fullPath);
  }
  return null;
};

/**
 * Check if local file exists
 */
const existsLocal = (filePath: string): boolean => {
  const basePath = getStoragePath();
  const fullPath = path.join(basePath, filePath);
  return fs.existsSync(fullPath);
};

/**
 * Get local file stats
 */
const statsLocal = async (filePath: string): Promise<{ size: number; mtime: Date } | null> => {
  const basePath = getStoragePath();
  const fullPath = path.join(basePath, filePath);
  
  if (fs.existsSync(fullPath)) {
    const stats = await fs.promises.stat(fullPath);
    return { size: stats.size, mtime: stats.mtime };
  }
  return null;
};

// ==================== IMAGE PROCESSING ====================

/**
 * Process and optimize image
 */
const processImage = async (
  buffer: Buffer,
  mimeType: string
): Promise<{ optimized: Buffer; original: Buffer }> => {
  let pipeline = sharp(buffer);
  
  // Optimize based on type
  if (mimeType === 'image/jpeg') {
    pipeline = pipeline.jpeg({ quality: 85, progressive: true });
  } else if (mimeType === 'image/png') {
    pipeline = pipeline.png({ compressionLevel: 9, progressive: true });
  } else if (mimeType === 'image/webp') {
    pipeline = pipeline.webp({ quality: 85 });
  }
  
  const optimized = await pipeline.toBuffer();
  return { optimized, original: buffer };
};

/**
 * Generate image variants (thumbnails, etc.)
 */
const generateVariants = async (
  buffer: Buffer,
  mimeType: string,
  baseId: string
): Promise<{ [key: string]: Buffer }> => {
  const variants: { [key: string]: Buffer } = {};
  
  for (const [name, dimensions] of Object.entries(COVER_SIZES)) {
    try {
      let pipeline = sharp(buffer).resize({
        width: dimensions.width,
        height: dimensions.height,
        fit: 'cover',
        position: 'center'
      });
      
      // Apply format-specific optimizations
      if (mimeType === 'image/jpeg') {
        pipeline = pipeline.jpeg({ quality: 80, progressive: true });
      } else if (mimeType === 'image/png') {
        pipeline = pipeline.png({ compressionLevel: 8, progressive: true });
      } else if (mimeType === 'image/webp') {
        pipeline = pipeline.webp({ quality: 80 });
      }
      
      const variantBuffer = await pipeline.toBuffer();
      variants[name] = variantBuffer;
    } catch (error) {
      console.error(`Error generating ${name} variant:`, error);
    }
  }
  
  return variants;
};

// ==================== MAIN FILE OPERATIONS ====================

/**
 * Upload cover image with variants
 */
export async function uploadCoverImage(
  userId: string,
  bookId: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Validate file type
    if (!validateFileType(mimeType)) {
      return {
        success: false,
        error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      };
    }
    
    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }
    
    // Ensure directories exist
    ensureDirectories();
    
    // Calculate checksum
    const checksum = calculateChecksum(fileBuffer);
    
    // Generate unique filename
    const filename = generateFilename(originalName);
    
    // Process image
    const { optimized, original } = await processImage(fileBuffer, mimeType);
    
    // Generate variants
    const variants = await generateVariants(original, mimeType, bookId);
    
    // Store original
    const originalPath = await storeLocal(
      optimized, // Store optimized version as "original"
      `covers/originals`,
      filename
    );
    
    // Store variants
    const variantPaths: { [key: string]: string } = {};
    for (const [name, buffer] of Object.entries(variants)) {
      const variantPath = await storeLocal(buffer, `covers/${name}`, filename);
      variantPaths[name] = variantPath;
    }
    
    // Create metadata
    const metadata: FileMetadata = {
      id: uuidv4(),
      originalName,
      mimeType,
      size: fileBuffer.length,
      userId,
      entityType: 'cover',
      entityId: bookId,
      path: originalPath,
      variants: Object.keys(variantPaths),
      createdAt: new Date(),
      checksum
    };
    
    return {
      success: true,
      file: metadata,
      variants: variantPaths
    };
  } catch (error) {
    console.error('Error uploading cover image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Upload generic file
 */
export async function uploadFile(
  userId: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  entityType: string = 'import',
  entityId?: string
): Promise<UploadResult> {
  try {
    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }
    
    // Ensure directories exist
    ensureDirectories();
    
    // Generate unique filename
    const filename = generateFilename(originalName);
    
    // Store file
    const relativePath = entityType === 'avatar' ? 'avatars' : 'imports';
    const storedPath = await storeLocal(fileBuffer, relativePath, filename);
    
    // Calculate checksum
    const checksum = calculateChecksum(fileBuffer);
    
    // Create metadata
    const metadata: FileMetadata = {
      id: uuidv4(),
      originalName,
      mimeType,
      size: fileBuffer.length,
      userId,
      entityType,
      entityId,
      path: storedPath,
      variants: [],
      createdAt: new Date(),
      checksum
    };
    
    return {
      success: true,
      file: metadata
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Delete file and its variants
 */
export async function deleteFile(fileId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, you'd look up the file in the database
    // For now, we'll just try to delete the file based on the ID
    const basePath = getStoragePath();
    
    // Try to find and delete the file
    const patterns = [
      `covers/originals/${fileId}`,
      `covers/thumbnails/${fileId}`,
      `covers/small/${fileId}`,
      `covers/medium/${fileId}`,
      `covers/large/${fileId}`,
      `imports/${fileId}`,
      `avatars/${fileId}`
    ];
    
    let deleted = false;
    for (const pattern of patterns) {
      const fullPath = path.join(basePath, pattern);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        deleted = true;
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    };
  }
}

/**
 * Get file by ID
 */
export async function getFile(fileId: string): Promise<{ buffer: Buffer | null; mimeType: string; metadata?: FileMetadata } | null> {
  try {
    // In a real implementation, you'd look up the file in the database
    // For now, we'll try to find the file in storage
    
    const basePath = getStoragePath();
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    for (const ext of extensions) {
      const testPath = path.join(basePath, `covers/originals/${fileId}${ext}`);
      if (fs.existsSync(testPath)) {
        const buffer = await fs.promises.readFile(testPath);
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                        ext === '.png' ? 'image/png' : 
                        ext === '.gif' ? 'image/gif' : 'image/webp';
        return { buffer, mimeType };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
}

/**
 * Get file variant
 */
export async function getFileVariant(
  fileId: string, 
  variant: string = 'medium'
): Promise<{ buffer: Buffer | null; mimeType: string } | null> {
  try {
    const basePath = getStoragePath();
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    for (const ext of extensions) {
      const testPath = path.join(basePath, `covers/${variant}/${fileId}${ext}`);
      if (fs.existsSync(testPath)) {
        const buffer = await fs.promises.readFile(testPath);
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                        ext === '.png' ? 'image/png' : 
                        ext === '.gif' ? 'image/gif' : 'image/webp';
        return { buffer, mimeType };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting file variant:', error);
    return null;
  }
}

/**
 * Get storage usage for a user
 */
export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  try {
    const basePath = getStoragePath();
    const usage: StorageUsage = {
      userId,
      totalFiles: 0,
      totalSize: 0,
      byType: {}
    };
    
    // Scan storage directories
    const directories = ['covers', 'imports', 'avatars'];
    
    for (const dir of directories) {
      const dirPath = path.join(basePath, dir);
      if (!fs.existsSync(dirPath)) continue;
      
      const files = await fs.promises.readdir(dirPath, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isFile()) {
          usage.totalFiles++;
          usage.totalSize += stats.size;
          
          // Track by type
          if (!usage.byType[dir]) {
            usage.byType[dir] = { count: 0, size: 0 };
          }
          usage.byType[dir].count++;
          usage.byType[dir].size += stats.size;
        }
      }
    }
    
    return usage;
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return {
      userId,
      totalFiles: 0,
      totalSize: 0,
      byType: {}
    };
  }
}

/**
 * Clean up orphaned files
 */
export async function cleanupOrphanedFiles(): Promise<{ cleaned: number; errors: string[] }> {
  const result = { cleaned: 0, errors: [] as string[] };
  
  try {
    const basePath = getStoragePath();
    
    // Get all files in storage
    const allFiles: string[] = [];
    const directories = ['covers', 'imports', 'avatars'];
    
    for (const dir of directories) {
      const dirPath = path.join(basePath, dir);
      if (!fs.existsSync(dirPath)) continue;
      
      const files = await fs.promises.readdir(dirPath, { recursive: true });
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.promises.stat(filePath);
        if (stats.isFile()) {
          allFiles.push(filePath);
        }
      }
    }
    
    // In a real implementation, you'd check each file against the database
    // and delete files that aren't referenced
    // For now, we'll just return success
    result.cleaned = 0;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Cleanup failed';
    result.errors.push(errorMessage);
    console.error('Error cleaning orphaned files:', error);
  }
  
  return result;
}

/**
 * Validate file for upload
 */
export function validateFileUpload(
  buffer: Buffer,
  mimeType: string,
  maxSize: number = MAX_FILE_SIZE
): { valid: boolean; error?: string } {
  // Check file size
  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`
    };
  }
  
  // Check file type
  if (!validateFileType(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    };
  }
  
  // Check for empty file
  if (buffer.length === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }
  
  return { valid: true };
}

/**
 * Initialize storage system
 */
export function initializeStorage(): void {
  ensureDirectories();
  console.log('Storage system initialized at:', getStoragePath());
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalSize: number;
  totalFiles: number;
  directorySizes: { [key: string]: number };
}> {
  const basePath = getStoragePath();
  const stats = {
    totalSize: 0,
    totalFiles: 0,
    directorySizes: {} as { [key: string]: number }
  };
  
  const directories = ['covers', 'imports', 'avatars', 'tmp'];
  
  for (const dir of directories) {
    const dirPath = path.join(basePath, dir);
    if (!fs.existsSync(dirPath)) continue;
    
    const files = await fs.promises.readdir(dirPath, { recursive: true });
    let dirSize = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const statsInner = await fs.promises.stat(filePath);
      if (statsInner.isFile()) {
        stats.totalFiles++;
        dirSize += statsInner.size;
        stats.totalSize += statsInner.size;
      }
    }
    
    stats.directorySizes[dir] = dirSize;
  }
  
  return stats;
}

export default {
  uploadCoverImage,
  uploadFile,
  deleteFile,
  getFile,
  getFileVariant,
  getStorageUsage,
  cleanupOrphanedFiles,
  validateFileUpload,
  initializeStorage,
  getStorageStats
};
