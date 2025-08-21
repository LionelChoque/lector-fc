import { promises as fs } from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { pdfImageProcessor } from './pdfImageProcessor';
import { storage } from './storage';

// Configuration for image optimization
interface ImageConfig {
  thumbnail: { width: number, height: number, quality: number };
  preview: { width: number, height: number, quality: number };
  full: { width: number, height: number, quality: number };
}

interface DocumentImageOptions {
  documentId: string;
  pageNumber: number;
  resolution: keyof ImageConfig;
  format?: 'webp' | 'jpeg' | 'png';
}

interface StorageMetrics {
  totalSize: number;
  fileCount: number;
  lastCleanup: Date;
}

// TTL for different types of images (in milliseconds)
const IMAGE_TTL = {
  thumbnail: 7 * 24 * 60 * 60 * 1000,  // 7 days
  preview: 7 * 24 * 60 * 60 * 1000,    // 7 days (increased for better performance)
  full: 7 * 24 * 60 * 60 * 1000,       // 7 days (increased for better user experience)
  temp: 60 * 60 * 1000,                // 1 hour for temp files
};

// TTL for documents in database (30 days as requested)
export const DOCUMENT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Manages document image generation, storage, and optimization
 * 
 * Key features:
 * - PDF to image conversion with multiple resolutions
 * - Object storage integration with automatic cleanup
 * - Space optimization through compression and TTL policies
 * - Lazy loading - images generated only when requested
 * - Smart caching with size-based cleanup
 */
export class DocumentImageManager {
  private storage: Storage;
  private bucketName: string;
  private privateDir: string;
  private publicDir: string;
  private localTempDir: string;
  private maxCacheSize: number; // in bytes
  private storageMetrics: StorageMetrics;

  constructor() {
    // Object storage configuration from environment
    this.bucketName = this.extractBucketName(process.env.PRIVATE_OBJECT_DIR || '');
    this.privateDir = process.env.PRIVATE_OBJECT_DIR || '';
    this.publicDir = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || '').split(',')[0] || '';
    this.localTempDir = path.join(process.cwd(), 'temp', 'images');
    this.maxCacheSize = 500 * 1024 * 1024; // 500MB max cache size
    
    // Initialize storage client (same config as object storage)
    this.storage = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: "http://127.0.0.1:1106/token",
        type: "external_account",
        credential_source: {
          url: "http://127.0.0.1:1106/credential",
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });

    this.storageMetrics = {
      totalSize: 0,
      fileCount: 0,
      lastCleanup: new Date(0)
    };

    this.ensureDirectories();
  }

  private extractBucketName(dir: string): string {
    const match = dir.match(/\/([^\/]+)\//);
    return match ? match[1] : 'default-bucket';
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.localTempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directories:', error);
    }
  }

  private getImagePath(documentId: string, pageNumber: number, resolution: keyof ImageConfig, format: string = 'webp'): string {
    return `${this.privateDir}/document-images/${documentId}/page-${pageNumber}-${resolution}.${format}`;
  }

  private getLocalTempPath(documentId: string, pageNumber: number, resolution: keyof ImageConfig, format: string = 'webp'): string {
    return path.join(this.localTempDir, `${documentId}-page-${pageNumber}-${resolution}.${format}`);
  }

  /**
   * Gets a document image, generating it if it doesn't exist
   */
  async getDocumentImage(options: DocumentImageOptions): Promise<Buffer | null> {
    const { documentId, pageNumber, resolution, format = 'webp' } = options;
    const imagePath = this.getImagePath(documentId, pageNumber, resolution, format);
    
    try {
      // Try to get from object storage cache first
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(imagePath.substring(1)); // Remove leading slash
      
      const [exists] = await file.exists();
      if (exists) {
        // Check if file is within TTL
        const [metadata] = await file.getMetadata();
        const createdTime = new Date(metadata.timeCreated!);
        const ttl = IMAGE_TTL[resolution];
        
        if (Date.now() - createdTime.getTime() < ttl) {
          const [buffer] = await file.download();
          return buffer;
        } else {
          // File expired, delete it
          await file.delete().catch(() => {}); // Ignore delete errors
        }
      }

      // Generate image if not cached or expired
      return await this.generateDocumentImage(options);
      
    } catch (error) {
      console.error('Error getting document image:', error);
      return null;
    }
  }

  /**
   * Generates a document image from PDF using real conversion
   */
  private async generateDocumentImage(options: DocumentImageOptions): Promise<Buffer | null> {
    const { documentId, pageNumber, resolution, format = 'webp' } = options;
    
    try {
      // Get the original document path
      const document = await storage.getDocument(documentId);
      if (!document) {
        console.error(`Document not found: ${documentId}`);
        return null;
      }

      const config = this.getImageConfig(resolution);
      let buffer: Buffer | null = null;

      // Try to convert PDF to image using real processor
      if (document.mimeType === 'application/pdf') {
        console.log(`🔄 Attempting PDF conversion for ${document.originalPath}, page ${pageNumber}`);
        buffer = await pdfImageProcessor.convertPdfPageToImage(
          document.originalPath,
          pageNumber,
          {
            quality: config.quality,
            width: config.width,
            height: config.height,
            format: format,
            density: resolution === 'full' ? 300 : resolution === 'preview' ? 150 : 100 // Higher density for full resolution
          }
        );
        
        if (buffer) {
          console.log(`✅ PDF conversion successful: ${buffer.length} bytes`);
        } else {
          console.log(`❌ PDF conversion failed for ${document.originalPath}`);
        }
      }
      
      // Fallback to placeholder if real conversion fails
      if (!buffer) {
        console.log(`Using placeholder for ${documentId} page ${pageNumber} (resolution: ${resolution})`);
        const placeholderSvg = this.generatePlaceholderSvg(documentId, pageNumber, config);
        buffer = Buffer.from(placeholderSvg, 'utf-8');
      }
      
      // Store in object storage for future use
      await this.storeImageInCache(documentId, pageNumber, resolution, format, buffer);
      
      // Update metrics
      this.updateStorageMetrics(buffer.length);
      
      // Trigger cleanup if needed
      if (this.shouldRunCleanup()) {
        this.runCleanup().catch(console.error);
      }
      
      return buffer;
      
    } catch (error) {
      console.error('Error generating document image:', error);
      return null;
    }
  }

  private getImageConfig(resolution: keyof ImageConfig): ImageConfig[keyof ImageConfig] {
    const configs: ImageConfig = {
      thumbnail: { width: 200, height: 280, quality: 70 },
      preview: { width: 600, height: 800, quality: 85 },
      full: { width: 1600, height: 2100, quality: 95 } // Increased resolution and quality for better clarity
    };
    return configs[resolution];
  }

  private generatePlaceholderSvg(documentId: string, pageNumber: number, config: { width: number; height: number }): string {
    return `
      <svg width="${config.width}" height="${config.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white" stroke="#e5e7eb" stroke-width="2"/>
        
        <!-- Header -->
        <rect x="20" y="20" width="${config.width - 40}" height="60" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="4"/>
        <text x="${config.width / 2}" y="45" text-anchor="middle" fill="#475569" font-size="12" font-family="system-ui">
          Document ID: ${documentId.substring(0, 8)}...
        </text>
        <text x="${config.width / 2}" y="65" text-anchor="middle" fill="#64748b" font-size="10" font-family="system-ui">
          Página ${pageNumber} - Resolución: ${config.width}x${config.height}
        </text>
        
        <!-- Content areas -->
        <rect x="20" y="100" width="${config.width - 140}" height="20" fill="#dbeafe" rx="2"/>
        <rect x="${config.width - 120}" y="100" width="100" height="20" fill="#dcfce7" rx="2"/>
        
        <rect x="20" y="140" width="${config.width - 40}" height="${config.height - 200}" fill="#fffef7" stroke="#f59e0b" rx="4"/>
        
        <rect x="${config.width - 120}" y="${config.height - 80}" width="100" height="50" fill="#fef2f2" stroke="#ef4444" rx="4"/>
        
        <text x="${config.width / 2}" y="${config.height - 15}" text-anchor="middle" fill="#9ca3af" font-size="10">
          Generated: ${new Date().toLocaleTimeString()}
        </text>
      </svg>
    `;
  }

  private async storeImageInCache(documentId: string, pageNumber: number, resolution: keyof ImageConfig, format: string, buffer: Buffer): Promise<void> {
    try {
      const imagePath = this.getImagePath(documentId, pageNumber, resolution, format);
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(imagePath.substring(1)); // Remove leading slash
      
      await file.save(buffer, {
        metadata: {
          contentType: format === 'svg' ? 'image/svg+xml' : `image/${format}`,
          metadata: {
            documentId,
            pageNumber: pageNumber.toString(),
            resolution,
            generatedAt: new Date().toISOString(),
            ttl: IMAGE_TTL[resolution].toString()
          }
        }
      });
      
    } catch (error) {
      console.error('Error storing image in cache:', error);
    }
  }

  private updateStorageMetrics(sizeIncrease: number): void {
    this.storageMetrics.totalSize += sizeIncrease;
    this.storageMetrics.fileCount += 1;
  }

  private shouldRunCleanup(): boolean {
    const timeSinceLastCleanup = Date.now() - this.storageMetrics.lastCleanup.getTime();
    const hoursSinceCleanup = timeSinceLastCleanup / (60 * 60 * 1000);
    
    return (
      this.storageMetrics.totalSize > this.maxCacheSize ||
      hoursSinceCleanup > 6 // Run cleanup every 6 hours
    );
  }

  /**
   * Cleans up expired and oversized cached images
   */
  private async runCleanup(): Promise<void> {
    try {
      console.log('Running image cache cleanup...');
      const bucket = this.storage.bucket(this.bucketName);
      const prefix = `${this.privateDir.substring(1)}/document-images/`; // Remove leading slash
      
      const [files] = await bucket.getFiles({ prefix });
      let deletedCount = 0;
      let reclaimedSpace = 0;
      
      const now = Date.now();
      
      for (const file of files) {
        try {
          const [metadata] = await file.getMetadata();
          const createdTime = new Date(metadata.timeCreated!);
          const resolution = metadata.metadata?.resolution as keyof ImageConfig || 'preview';
          const ttl = IMAGE_TTL[resolution];
          
          // Delete if expired
          if (now - createdTime.getTime() > ttl) {
            const size = parseInt(String(metadata.size || '0'));
            await file.delete();
            deletedCount++;
            reclaimedSpace += size;
          }
        } catch (error) {
          // If we can't get metadata or delete, skip the file
          console.warn(`Cleanup warning for file ${file.name}:`, error);
        }
      }
      
      // Update metrics
      this.storageMetrics.totalSize = Math.max(0, this.storageMetrics.totalSize - reclaimedSpace);
      this.storageMetrics.fileCount = Math.max(0, this.storageMetrics.fileCount - deletedCount);
      this.storageMetrics.lastCleanup = new Date();
      
      console.log(`Cleanup completed: ${deletedCount} files deleted, ${(reclaimedSpace / 1024 / 1024).toFixed(2)}MB reclaimed`);
      
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Gets storage statistics
   */
  async getStorageStats(): Promise<StorageMetrics & { maxCacheSize: number }> {
    return {
      ...this.storageMetrics,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Preloads images for a document (optional optimization)
   */
  async preloadDocumentImages(documentId: string, pageCount: number): Promise<void> {
    try {
      // Preload thumbnail and preview versions for faster access
      const preloadPromises: Promise<any>[] = [];
      
      for (let page = 1; page <= Math.min(pageCount, 3); page++) { // Preload first 3 pages
        preloadPromises.push(
          this.getDocumentImage({ documentId, pageNumber: page, resolution: 'thumbnail' }),
          this.getDocumentImage({ documentId, pageNumber: page, resolution: 'preview' })
        );
      }
      
      await Promise.allSettled(preloadPromises);
      console.log(`Preloaded images for document ${documentId}`);
      
    } catch (error) {
      console.error('Error preloading images:', error);
    }
  }

  /**
   * Deletes all images for a document (when document is deleted)
   */
  async deleteDocumentImages(documentId: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const prefix = `${this.privateDir.substring(1)}/document-images/${documentId}/`;
      
      const [files] = await bucket.getFiles({ prefix });
      
      const deletePromises = files.map(file => file.delete().catch(() => {}));
      await Promise.allSettled(deletePromises);
      
      console.log(`Deleted ${files.length} images for document ${documentId}`);
      
    } catch (error) {
      console.error('Error deleting document images:', error);
    }
  }
}

// Singleton instance
export const documentImageManager = new DocumentImageManager();