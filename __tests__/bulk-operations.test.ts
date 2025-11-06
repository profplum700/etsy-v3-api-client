/**
 * Tests for Bulk Operations (Phase 2)
 */

import {
  BulkOperationManager,
  createBulkOperationManager,
  executeBulkOperation
} from '../src/bulk-operations';

describe('Bulk Operations', () => {
  describe('BulkOperationManager', () => {
    it('should process operations with default concurrency', async () => {
      const manager = new BulkOperationManager();
      const items = [1, 2, 3, 4, 5];
      const results: number[] = [];

      const summary = await manager.executeBulk(
        items,
        async (item) => {
          results.push(item * 2);
          return item * 2;
        }
      );

      expect(summary.total).toBe(5);
      expect(summary.successful).toBe(5);
      expect(summary.failed).toBe(0);
      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle errors without stopping', async () => {
      const manager = new BulkOperationManager({ stopOnError: false });
      const items = [1, 2, 3, 4, 5];

      const summary = await manager.executeBulk(
        items,
        async (item) => {
          if (item === 3) {
            throw new Error('Test error');
          }
          return item * 2;
        }
      );

      expect(summary.total).toBe(5);
      expect(summary.successful).toBe(4);
      expect(summary.failed).toBe(1);
      expect(summary.errors).toHaveLength(1);
      expect(summary.errors[0]!.id).toBe(2); // index 2
    });

    it('should clear queue when stopOnError is true and error occurs', async () => {
      const manager = new BulkOperationManager({ stopOnError: true, concurrency: 1 });
      const items = Array.from({ length: 20 }, (_, i) => i + 1);
      const processedItems: number[] = [];

      const summary = await manager.executeBulk(
        items,
        async (item) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          processedItems.push(item);
          if (item === 5) {
            throw new Error('Test error');
          }
          return item * 2;
        }
      );

      // Should process items 1-5, with item 5 failing
      // Then stop (queue cleared)
      expect(processedItems.length).toBeLessThanOrEqual(5);
      expect(summary.errors.length).toBeGreaterThan(0);
      expect(summary.total).toBe(items.length);
    });

    it('should correctly update counters when stopOnError triggers', async () => {
      const manager = new BulkOperationManager({ stopOnError: true, concurrency: 1 });
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const summary = await manager.executeBulk(
        items,
        async (item) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          if (item === 5) {
            throw new Error('Test error at item 5');
          }
          return item * 2;
        }
      );

      // Should have processed items 1-5
      // 4 successful (1, 2, 3, 4), 1 failed (5), then stopped
      expect(summary.successful).toBe(4);
      expect(summary.failed).toBe(1);
      expect(summary.successful + summary.failed).toBe(5);
      expect(summary.results).toHaveLength(5);
      expect(summary.errors).toHaveLength(1);
      expect(summary.errors[0]!.id).toBe(4); // index 4 (item 5)
    });

    it('should track progress with callback', async () => {
      const progressUpdates: number[] = [];
      const manager = new BulkOperationManager({
        onProgress: (completed, _total) => {
          progressUpdates.push(completed);
        }
      });

      const items = [1, 2, 3];

      await manager.executeBulk(
        items,
        async (item) => item * 2
      );

      expect(progressUpdates).toEqual([1, 2, 3]);
    });

    it('should respect concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;
      const manager = new BulkOperationManager({ concurrency: 2 });

      const items = Array.from({ length: 10 }, (_, i) => i);

      await manager.executeBulk(
        items,
        async (item) => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrent--;
          return item;
        }
      );

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should call onItemComplete for each item', async () => {
      const completedItems: number[] = [];
      const manager = new BulkOperationManager({
        onItemComplete: (result) => {
          if (result.success && result.data) {
            completedItems.push(result.data as number);
          }
        }
      });

      const items = [1, 2, 3];

      await manager.executeBulk(
        items,
        async (item) => item * 2
      );

      expect(completedItems).toEqual([2, 4, 6]);
    });

    it('should call onItemError for failed items', async () => {
      const errors: string[] = [];
      const manager = new BulkOperationManager({
        stopOnError: false,
        onItemError: (error) => {
          errors.push(error.error.message);
        }
      });

      const items = [1, 2, 3];

      await manager.executeBulk(
        items,
        async (item) => {
          if (item === 2) {
            throw new Error(`Error for item ${item}`);
          }
          return item * 2;
        }
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('Error for item 2');
    });
  });

  describe('Factory Functions', () => {
    it('should create manager with createBulkOperationManager', () => {
      const manager = createBulkOperationManager({ concurrency: 3 });
      expect(manager).toBeInstanceOf(BulkOperationManager);
      expect(manager.getConcurrency()).toBe(3);
    });

    it('should execute bulk operation with executeBulkOperation', async () => {
      const items = [1, 2, 3];
      const summary = await executeBulkOperation(
        items,
        async (item) => item * 2,
        { concurrency: 2 }
      );

      expect(summary.successful).toBe(3);
      expect(summary.failed).toBe(0);
    });
  });

  describe('Concurrency Control', () => {
    it('should update concurrency setting', () => {
      const manager = new BulkOperationManager({ concurrency: 5 });
      expect(manager.getConcurrency()).toBe(5);

      manager.setConcurrency(10);
      expect(manager.getConcurrency()).toBe(10);
    });

    it('should enforce minimum concurrency of 1', () => {
      const manager = new BulkOperationManager({ concurrency: 5 });
      manager.setConcurrency(0);
      expect(manager.getConcurrency()).toBe(1);
    });
  });
});
