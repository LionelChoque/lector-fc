import { db } from './db';
import { documents, processingResults, lineItems, validations } from '@shared/schema';
import { lt, sql } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';
import { DOCUMENT_TTL } from './documentImageManager';

interface CleanupMetrics {
  documentsDeleted: number;
  processingResultsDeleted: number;
  lineItemsDeleted: number;
  validationsDeleted: number;
  filesDeleted: number;
  spaceReclaimed: number; // in bytes
}

/**
 * Manages automatic cleanup of expired documents and related data
 * Implements 30-day retention policy as requested by user
 */
export class DocumentCleanupManager {
  private isRunning: boolean = false;
  private lastCleanup: Date = new Date();

  /**
   * Runs comprehensive cleanup of expired documents
   * - Deletes documents older than 30 days
   * - Cascades to processing_results, line_items, validations
   * - Removes associated files from uploads directory
   * - Provides detailed metrics of cleanup operation
   */
  async runCleanup(): Promise<CleanupMetrics> {
    if (this.isRunning) {
      console.log('⏳ Document cleanup already in progress, skipping...');
      return this.getEmptyMetrics();
    }

    this.isRunning = true;
    const cutoffDate = new Date(Date.now() - DOCUMENT_TTL);
    
    console.log(`🧹 Starting document cleanup for items older than ${cutoffDate.toISOString()}`);
    
    const metrics: CleanupMetrics = {
      documentsDeleted: 0,
      processingResultsDeleted: 0,
      lineItemsDeleted: 0,
      validationsDeleted: 0,
      filesDeleted: 0,
      spaceReclaimed: 0
    };

    try {
      // 1. Find expired documents
      const expiredDocuments = await db
        .select()
        .from(documents)
        .where(lt(documents.uploadedAt, cutoffDate));

      console.log(`📋 Found ${expiredDocuments.length} expired documents`);

      for (const document of expiredDocuments) {
        try {
          // 2. Delete associated line items
          const lineItemsResult = await db
            .delete(lineItems)
            .where(sql`processing_result_id IN (
              SELECT id FROM processing_results WHERE document_id = ${document.id}
            )`);
          metrics.lineItemsDeleted += (lineItemsResult as any).rowCount || 0;

          // 3. Delete validations
          const validationsResult = await db
            .delete(validations)
            .where(sql`document_id = ${document.id}`);
          metrics.validationsDeleted += (validationsResult as any).rowCount || 0;

          // 4. Delete processing results
          const processingResult = await db
            .delete(processingResults)
            .where(sql`document_id = ${document.id}`);
          metrics.processingResultsDeleted += (processingResult as any).rowCount || 0;

          // 5. Delete file from uploads directory
          try {
            const filePath = path.resolve(document.originalPath);
            const stats = await fs.stat(filePath);
            await fs.unlink(filePath);
            metrics.filesDeleted++;
            metrics.spaceReclaimed += stats.size;
            console.log(`🗑️ Deleted file: ${document.fileName} (${(stats.size / 1024).toFixed(1)}KB)`);
          } catch (fileError) {
            console.warn(`⚠️ Could not delete file ${document.originalPath}:`, fileError);
          }

          // 6. Finally delete the document record
          await db
            .delete(documents)
            .where(sql`id = ${document.id}`);
          metrics.documentsDeleted++;

          console.log(`✅ Cleaned up document: ${document.fileName}`);
        } catch (error) {
          console.error(`❌ Error cleaning up document ${document.id}:`, error);
        }
      }

      this.lastCleanup = new Date();
      
      console.log(`🎯 Cleanup completed successfully:`, {
        documents: metrics.documentsDeleted,
        processingResults: metrics.processingResultsDeleted,
        lineItems: metrics.lineItemsDeleted,
        validations: metrics.validationsDeleted,
        files: metrics.filesDeleted,
        spaceReclaimed: `${(metrics.spaceReclaimed / 1024 / 1024).toFixed(2)} MB`
      });

    } catch (error) {
      console.error('❌ Document cleanup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }

    return metrics;
  }

  /**
   * Schedules automatic cleanup to run every 6 hours
   * Can be called multiple times safely - will not create duplicate timers
   */
  startAutomaticCleanup(): void {
    console.log('⏰ Starting automatic document cleanup (every 6 hours)');
    
    // Run initial cleanup after 1 minute
    setTimeout(() => {
      this.runCleanup().catch(console.error);
    }, 60 * 1000);

    // Then run every 6 hours
    setInterval(() => {
      this.runCleanup().catch(console.error);
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Checks if cleanup should be triggered based on time elapsed
   */
  shouldRunCleanup(): boolean {
    const timeSinceLastCleanup = Date.now() - this.lastCleanup.getTime();
    const sixHours = 6 * 60 * 60 * 1000;
    return timeSinceLastCleanup > sixHours;
  }

  /**
   * Gets current cleanup status and metrics
   */
  getCleanupStatus() {
    return {
      isRunning: this.isRunning,
      lastCleanup: this.lastCleanup,
      timeSinceLastCleanup: Date.now() - this.lastCleanup.getTime(),
      documentTtlDays: DOCUMENT_TTL / (24 * 60 * 60 * 1000)
    };
  }

  private getEmptyMetrics(): CleanupMetrics {
    return {
      documentsDeleted: 0,
      processingResultsDeleted: 0,
      lineItemsDeleted: 0,
      validationsDeleted: 0,
      filesDeleted: 0,
      spaceReclaimed: 0
    };
  }
}

// Singleton instance
export const documentCleanupManager = new DocumentCleanupManager();