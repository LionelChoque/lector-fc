import pdf2pic from 'pdf2pic';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

interface ProcessingOptions {
  quality: number;
  width?: number;
  height?: number;
  format: 'webp' | 'jpeg' | 'png';
  density?: number; // DPI
}

interface PdfPageInfo {
  pageNumber: number;
  buffer: Buffer;
  originalSize: { width: number; height: number };
  optimizedSize: { width: number; height: number };
}

/**
 * Real PDF to Image conversion service using pdf2pic and sharp
 * Handles optimization, compression, and multiple resolution generation
 */
export class PdfImageProcessor {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'pdf-processing');
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  /**
   * Converts a specific page of PDF to optimized image
   */
  async convertPdfPageToImage(
    pdfPath: string, 
    pageNumber: number, 
    options: ProcessingOptions
  ): Promise<Buffer | null> {
    try {
      // Check if PDF file exists
      const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.error(`PDF file not found: ${pdfPath}`);
        return null;
      }

      // Configure pdf2pic conversion options
      const density = options.density || 150; // DPI for conversion
      const convert = pdf2pic.fromPath(pdfPath, {
        density: density,           // Output DPI
        saveFilename: "temp",       // Temporary filename
        savePath: this.tempDir,     // Output directory
        format: "png",              // Initial format (will be optimized by sharp)
        width: options.width || 1200,    // Max width
        height: options.height || 1600   // Max height
      });

      // Convert specific page
      const result = await convert(pageNumber, { responseType: 'buffer' });
      
      if (!result.buffer) {
        console.error(`Failed to convert page ${pageNumber} from PDF: ${pdfPath}`);
        return null;
      }

      // Optimize image with sharp
      const optimizedBuffer = await this.optimizeImage(result.buffer, options);
      
      return optimizedBuffer;

    } catch (error) {
      console.error(`Error converting PDF page ${pageNumber} from ${pdfPath}:`, error);
      return null;
    }
  }

  /**
   * Converts all pages of PDF to images
   */
  async convertPdfToImages(
    pdfPath: string, 
    options: ProcessingOptions
  ): Promise<PdfPageInfo[]> {
    try {
      const pages: PdfPageInfo[] = [];
      
      // First, get the number of pages in the PDF
      const pageCount = await this.getPdfPageCount(pdfPath);
      
      if (pageCount === 0) {
        console.error(`Could not determine page count for PDF: ${pdfPath}`);
        return [];
      }

      // Convert each page
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const buffer = await this.convertPdfPageToImage(pdfPath, pageNum, options);
        
        if (buffer) {
          // Get image dimensions
          const metadata = await sharp(buffer).metadata();
          
          pages.push({
            pageNumber: pageNum,
            buffer,
            originalSize: { 
              width: metadata.width || 0, 
              height: metadata.height || 0 
            },
            optimizedSize: { 
              width: metadata.width || 0, 
              height: metadata.height || 0 
            }
          });
        } else {
          console.warn(`Failed to convert page ${pageNum} of PDF: ${pdfPath}`);
        }
      }

      return pages;

    } catch (error) {
      console.error(`Error converting PDF to images: ${pdfPath}`, error);
      return [];
    }
  }

  /**
   * Optimizes image using sharp with various quality settings
   */
  private async optimizeImage(inputBuffer: Buffer, options: ProcessingOptions): Promise<Buffer> {
    try {
      let sharpInstance = sharp(inputBuffer);

      // Resize if dimensions specified
      if (options.width || options.height) {
        sharpInstance = sharpInstance.resize(options.width, options.height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert to specified format with quality optimization
      switch (options.format) {
        case 'webp':
          return await sharpInstance
            .webp({ 
              quality: options.quality,
              effort: 6, // Maximum compression effort
              smartSubsample: true
            })
            .toBuffer();

        case 'jpeg':
          return await sharpInstance
            .jpeg({ 
              quality: options.quality,
              progressive: true,
              mozjpeg: true // Better compression
            })
            .toBuffer();

        case 'png':
          return await sharpInstance
            .png({ 
              quality: options.quality,
              compressionLevel: 9, // Maximum compression
              adaptiveFiltering: true
            })
            .toBuffer();

        default:
          return await sharpInstance.toBuffer();
      }

    } catch (error) {
      console.error('Error optimizing image:', error);
      return inputBuffer; // Return original if optimization fails
    }
  }

  /**
   * Gets the number of pages in a PDF
   */
  private async getPdfPageCount(pdfPath: string): Promise<number> {
    try {
      // Use pdf2pic to get page count
      // This is a simple way to check - we'll attempt to convert page 1 and handle errors
      const convert = pdf2pic.fromPath(pdfPath, {
        density: 50, // Low density for quick test
        saveFilename: "pagecount-test",
        savePath: this.tempDir,
        format: "png"
      });

      // Try to convert pages until we get an error (indicating end of document)
      let pageCount = 0;
      let maxPages = 50; // Reasonable limit to prevent infinite loops

      for (let i = 1; i <= maxPages; i++) {
        try {
          const result = await convert(i, { responseType: 'buffer' });
          if (result.buffer) {
            pageCount = i;
          } else {
            break;
          }
        } catch (error) {
          break; // No more pages
        }
      }

      return pageCount;

    } catch (error) {
      console.error('Error getting PDF page count:', error);
      return 1; // Default to 1 page if we can't determine
    }
  }

  /**
   * Generates multiple resolutions of an image for responsive loading
   */
  async generateMultipleResolutions(
    inputBuffer: Buffer,
    baseName: string
  ): Promise<{ [resolution: string]: Buffer }> {
    const resolutions = {
      thumbnail: { width: 200, height: 280, quality: 70 },
      preview: { width: 600, height: 800, quality: 85 },
      full: { width: 1200, height: 1600, quality: 90 }
    };

    const results: { [resolution: string]: Buffer } = {};

    for (const [name, config] of Object.entries(resolutions)) {
      try {
        const optimized = await this.optimizeImage(inputBuffer, {
          ...config,
          format: 'webp'
        });
        results[name] = optimized;
      } catch (error) {
        console.error(`Error generating ${name} resolution for ${baseName}:`, error);
      }
    }

    return results;
  }

  /**
   * Cleans up temporary files
   */
  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const cleanupPromises = files.map(file => 
        fs.unlink(path.join(this.tempDir, file)).catch(() => {})
      );
      await Promise.allSettled(cleanupPromises);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Estimates storage size for different quality options
   */
  async estimateStorageSize(pdfPath: string): Promise<{
    pageCount: number;
    estimatedSizes: {
      thumbnail: number;  // bytes per page
      preview: number;    // bytes per page  
      full: number;       // bytes per page
      total: number;      // total estimated bytes
    }
  }> {
    try {
      const pageCount = await this.getPdfPageCount(pdfPath);
      
      // Convert first page to get actual size estimates
      const testBuffer = await this.convertPdfPageToImage(pdfPath, 1, {
        quality: 85,
        width: 600,
        height: 800,
        format: 'webp'
      });

      if (!testBuffer) {
        return {
          pageCount,
          estimatedSizes: {
            thumbnail: 15000,  // 15KB estimate
            preview: 45000,    // 45KB estimate
            full: 120000,      // 120KB estimate
            total: pageCount * (15000 + 45000 + 120000)
          }
        };
      }

      // Generate different resolutions to get actual sizes
      const resolutions = await this.generateMultipleResolutions(testBuffer, 'test');
      
      const thumbnailSize = resolutions.thumbnail?.length || 15000;
      const previewSize = resolutions.preview?.length || 45000;
      const fullSize = resolutions.full?.length || 120000;
      
      return {
        pageCount,
        estimatedSizes: {
          thumbnail: thumbnailSize,
          preview: previewSize,
          full: fullSize,
          total: pageCount * (thumbnailSize + previewSize + fullSize)
        }
      };

    } catch (error) {
      console.error('Error estimating storage size:', error);
      return {
        pageCount: 1,
        estimatedSizes: {
          thumbnail: 15000,
          preview: 45000,
          full: 120000,
          total: 180000
        }
      };
    }
  }
}

// Singleton instance
export const pdfImageProcessor = new PdfImageProcessor();