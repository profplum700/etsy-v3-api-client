/**
 * Bulk Operations Module
 * Provides efficient bulk operations with concurrency control and progress tracking
 */

import { UpdateListingParams } from './types';

// ============================================================================
// Types
// ============================================================================

export interface BulkOperationConfig {
  /**
   * Number of operations to process concurrently
   * @default 5
   */
  concurrency?: number;

  /**
   * Whether to stop processing on first error
   * @default false
   */
  stopOnError?: boolean;

  /**
   * Callback for progress updates
   */
  onProgress?: (completed: number, total: number, lastResult?: BulkOperationResult<unknown>) => void;

  /**
   * Callback for each individual operation completion
   */
  onItemComplete?: (result: BulkOperationResult<unknown>) => void;

  /**
   * Callback for each error (only if stopOnError is false)
   */
  onItemError?: (error: BulkOperationError) => void;
}

export interface BulkOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  id: string | number;
  index: number;
}

export interface BulkOperationError {
  id: string | number;
  index: number;
  error: Error;
}

export interface BulkUpdateListingOperation {
  listingId: string | number;
  updates: UpdateListingParams;
}

export interface BulkImageUploadOperation {
  file: Blob | Buffer | string;
  rank: number;
  altText?: string;
}

export interface BulkOperationSummary<T> {
  total: number;
  successful: number;
  failed: number;
  results: BulkOperationResult<T>[];
  errors: BulkOperationError[];
  duration: number;
}

// ============================================================================
// Bulk Operation Manager
// ============================================================================

/**
 * Manages bulk operations with concurrency control and progress tracking
 */
export class BulkOperationManager {
  private concurrency: number;
  private stopOnError: boolean;
  private onProgress?: (completed: number, total: number, lastResult?: BulkOperationResult<unknown>) => void;
  private onItemComplete?: (result: BulkOperationResult<unknown>) => void;
  private onItemError?: (error: BulkOperationError) => void;

  constructor(config: BulkOperationConfig = {}) {
    this.concurrency = config.concurrency ?? 5;
    this.stopOnError = config.stopOnError ?? false;
    this.onProgress = config.onProgress;
    this.onItemComplete = config.onItemComplete;
    this.onItemError = config.onItemError;
  }

  /**
   * Execute bulk operations with concurrency control
   */
  async executeBulk<TInput, TOutput>(
    items: TInput[],
    operation: (item: TInput, index: number) => Promise<TOutput>,
    getId?: (item: TInput, index: number) => string | number
  ): Promise<BulkOperationSummary<TOutput>> {
    const startTime = Date.now();
    const results: BulkOperationResult<TOutput>[] = [];
    const errors: BulkOperationError[] = [];

    let completed = 0;
    let successful = 0;
    let failed = 0;

    // Create a queue of operations
    const queue = items.map((item, index) => ({
      item,
      index,
      id: getId ? getId(item, index) : index
    }));

    // Process operations with concurrency limit
    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(this.concurrency, items.length); i++) {
      workers.push(this.worker(queue, operation, results, errors, () => {
        completed++;
        const lastResult = results[results.length - 1];

        if (lastResult?.success) {
          successful++;
        } else {
          failed++;
        }

        if (this.onProgress) {
          this.onProgress(completed, items.length, lastResult);
        }
      }));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    const duration = Date.now() - startTime;

    return {
      total: items.length,
      successful,
      failed,
      results,
      errors,
      duration
    };
  }

  /**
   * Worker that processes items from the queue
   */
  private async worker<TInput, TOutput>(
    queue: Array<{ item: TInput; index: number; id: string | number }>,
    operation: (item: TInput, index: number) => Promise<TOutput>,
    results: BulkOperationResult<TOutput>[],
    errors: BulkOperationError[],
    onComplete: () => void
  ): Promise<void> {
    while (queue.length > 0) {
      const work = queue.shift();
      if (!work) break;

      const { item, index, id } = work;

      try {
        const data = await operation(item, index);
        const result: BulkOperationResult<TOutput> = {
          success: true,
          data,
          id,
          index
        };

        results.push(result);

        if (this.onItemComplete) {
          this.onItemComplete(result);
        }

        // Update counters for successful operation
        onComplete();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const result: BulkOperationResult<TOutput> = {
          success: false,
          error: err,
          id,
          index
        };

        results.push(result);

        const bulkError: BulkOperationError = {
          id,
          index,
          error: err
        };

        errors.push(bulkError);

        if (this.onItemError) {
          this.onItemError(bulkError);
        }

        // Update counters for failed operation BEFORE potentially breaking
        onComplete();

        if (this.stopOnError) {
          // Clear the queue to stop processing
          queue.length = 0;
          break;
        }
      }
    }
  }

  /**
   * Update concurrency setting
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
  }

  /**
   * Get current concurrency setting
   */
  getConcurrency(): number {
    return this.concurrency;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a bulk operation manager with default configuration
 */
export function createBulkOperationManager(config?: BulkOperationConfig): BulkOperationManager {
  return new BulkOperationManager(config);
}

/**
 * Execute a simple bulk operation without creating a manager instance
 */
export async function executeBulkOperation<TInput, TOutput>(
  items: TInput[],
  operation: (item: TInput, index: number) => Promise<TOutput>,
  config?: BulkOperationConfig
): Promise<BulkOperationSummary<TOutput>> {
  const manager = new BulkOperationManager(config);
  return manager.executeBulk(items, operation);
}
