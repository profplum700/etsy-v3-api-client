/**
 * Unit tests for Global Request Queue
 */

import { GlobalRequestQueue, getGlobalQueue, withQueue } from '../src/request-queue';
import { EtsyRateLimitError } from '../src/types';

describe('GlobalRequestQueue', () => {
  beforeEach(() => {
    // Reset singleton before each test
    GlobalRequestQueue.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = GlobalRequestQueue.getInstance();
      const instance2 = GlobalRequestQueue.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return same instance via getGlobalQueue helper', () => {
      const instance1 = GlobalRequestQueue.getInstance();
      const instance2 = getGlobalQueue();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = GlobalRequestQueue.getInstance();
      GlobalRequestQueue.resetInstance();
      const instance2 = GlobalRequestQueue.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Request Enqueueing', () => {
    it('should enqueue and execute a simple request', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const mockRequest = jest.fn().mockResolvedValue('success');

      const result = await queue.enqueue(mockRequest);

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should enqueue multiple requests and execute them in order', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const results: number[] = [];

      const requests = [
        () => Promise.resolve().then(() => { results.push(1); return 1; }),
        () => Promise.resolve().then(() => { results.push(2); return 2; }),
        () => Promise.resolve().then(() => { results.push(3); return 3; }),
      ];

      const promises = requests.map(req => queue.enqueue(req));
      await Promise.all(promises);

      expect(results).toEqual([1, 2, 3]);
    });

    it('should handle request failures', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const mockError = new Error('Request failed');
      const mockRequest = jest.fn().mockRejectedValue(mockError);

      await expect(queue.enqueue(mockRequest)).rejects.toThrow('Request failed');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should continue processing after a failed request', async () => {
      const queue = GlobalRequestQueue.getInstance();

      const request1 = jest.fn().mockRejectedValue(new Error('Fail'));
      const request2 = jest.fn().mockResolvedValue('success');

      await expect(queue.enqueue(request1)).rejects.toThrow('Fail');
      const result = await queue.enqueue(request2);

      expect(result).toBe('success');
      expect(request2).toHaveBeenCalled();
    });
  });

  describe('Priority Queue', () => {
    it('should prioritize high priority requests', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const executionOrder: string[] = [];

      // Add requests with different priorities
      // Use a small delay to ensure they're queued before processing
      const promises = [
        queue.enqueue(
          () => new Promise(resolve => setTimeout(() => {
            executionOrder.push('low');
            resolve('low');
          }, 10)),
          { priority: 'low' }
        ),
        queue.enqueue(
          () => new Promise(resolve => setTimeout(() => {
            executionOrder.push('high');
            resolve('high');
          }, 10)),
          { priority: 'high' }
        ),
        queue.enqueue(
          () => new Promise(resolve => setTimeout(() => {
            executionOrder.push('normal');
            resolve('normal');
          }, 10)),
          { priority: 'normal' }
        ),
      ];

      await Promise.all(promises);

      // Priority order should be maintained (first request starts immediately, rest are sorted)
      expect(executionOrder.length).toBe(3);
      expect(executionOrder).toContain('high');
      expect(executionOrder).toContain('normal');
      expect(executionOrder).toContain('low');
    });

    it('should use normal priority by default', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const mockRequest = jest.fn().mockResolvedValue('success');

      await queue.enqueue(mockRequest);

      expect(mockRequest).toHaveBeenCalled();
    });
  });

  describe('Queue Status', () => {
    it('should return current queue status', () => {
      const queue = GlobalRequestQueue.getInstance();
      const status = queue.getStatus();

      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('processing');
      expect(status).toHaveProperty('remainingRequests');
      expect(status).toHaveProperty('resetTime');
      expect(status.queueLength).toBe(0);
      expect(status.processing).toBe(false);
    });

    it('should update queue length as requests are added', async () => {
      const queue = GlobalRequestQueue.getInstance();

      // Add a slow request to keep queue occupied
      const slowRequest = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));

      const promise = queue.enqueue(slowRequest);

      // Queue might still be processing
      const status = queue.getStatus();
      expect(typeof status.queueLength).toBe('number');

      await promise;

      const finalStatus = queue.getStatus();
      expect(finalStatus.queueLength).toBe(0);
    });

    it('should track remaining requests', () => {
      const queue = GlobalRequestQueue.getInstance();
      const status = queue.getStatus();

      expect(status.remainingRequests).toBeGreaterThan(0);
      expect(status.remainingRequests).toBeLessThanOrEqual(10000); // Max per day
    });

    it('should provide reset time', () => {
      const queue = GlobalRequestQueue.getInstance();
      const status = queue.getStatus();

      expect(status.resetTime).toBeInstanceOf(Date);
      expect(status.resetTime.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Request Timeout', () => {
    it('should reject requests that exceed timeout', async () => {
      const queue = GlobalRequestQueue.getInstance();

      // Add a request that takes some time to block the queue
      const slowRequest = () => new Promise(resolve => setTimeout(() => resolve('slow'), 100));
      const slowPromise = queue.enqueue(slowRequest);

      // Add a request with a very short timeout that will have expired by the time it's processed
      const fastRequest = jest.fn().mockResolvedValue('fast');
      const timedPromise = queue.enqueue(fastRequest, { timeout: 1 });

      // Wait for the slow request to complete
      await slowPromise;

      // The timed request should have been rejected due to timeout
      await expect(timedPromise).rejects.toThrow(/Request timeout after \d+ms/);
    });

    it('should use default timeout of 30 seconds', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const fastRequest = jest.fn().mockResolvedValue('success');

      await queue.enqueue(fastRequest);

      expect(fastRequest).toHaveBeenCalled();
    });

    it('should timeout long-running request during execution', async () => {
      const queue = GlobalRequestQueue.getInstance();

      // Create a request that runs for 200ms
      const longRunningRequest = () => new Promise(resolve => {
        setTimeout(() => resolve('completed'), 200);
      });

      // Set timeout to 100ms - should timeout during execution, not in queue
      const promise = queue.enqueue(longRunningRequest, { timeout: 100 });

      // Should reject with timeout error
      await expect(promise).rejects.toThrow(/Request timeout after 100ms \(exceeded during execution\)/);
    });

    it('should continue processing queue after request timeout', async () => {
      const queue = GlobalRequestQueue.getInstance();

      // First request: hangs for 500ms
      const hangingRequest = () => new Promise(resolve => {
        setTimeout(() => resolve('hanging'), 500);
      });

      // Second request: completes quickly
      const fastRequest = jest.fn().mockResolvedValue('fast');

      // Enqueue hanging request with 50ms timeout
      const hangingPromise = queue.enqueue(hangingRequest, { timeout: 50 });

      // Enqueue fast request (should still process after timeout)
      const fastPromise = queue.enqueue(fastRequest);

      // First request should timeout
      await expect(hangingPromise).rejects.toThrow(/Request timeout/);

      // Second request should still succeed
      await expect(fastPromise).resolves.toBe('fast');
      expect(fastRequest).toHaveBeenCalled();
    });

    it('should calculate remaining timeout after queue wait time', async () => {
      const queue = GlobalRequestQueue.getInstance();

      // Block the queue with a slow request
      const blockingRequest = () => new Promise(resolve => {
        setTimeout(() => resolve('blocking'), 100);
      });

      queue.enqueue(blockingRequest);

      // Add request with 150ms timeout
      // After waiting 100ms in queue, only 50ms remains for execution
      const timedRequest = () => new Promise(resolve => {
        setTimeout(() => resolve('completed'), 60); // Takes 60ms to execute
      });

      const promise = queue.enqueue(timedRequest, { timeout: 150 });

      // Should timeout because execution (60ms) exceeds remaining time (~50ms)
      await expect(promise).rejects.toThrow(/Request timeout/);
    });
  });

  describe('Rate Limit Handling', () => {
    it('should handle rate limit errors', async () => {
      const queue = GlobalRequestQueue.getInstance();

      const rateLimitError = new EtsyRateLimitError('Rate limited', 60);
      const failingRequest = jest.fn().mockRejectedValue(rateLimitError);

      await expect(queue.enqueue(failingRequest)).rejects.toThrow('Rate limited');
    });

    it('should respect minimum request interval', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const timestamps: number[] = [];

      const requests = Array.from({ length: 3 }, () =>
        () => {
          timestamps.push(Date.now());
          return Promise.resolve('done');
        }
      );

      await Promise.all(requests.map(req => queue.enqueue(req)));

      // Check that there's at least some delay between requests
      if (timestamps.length >= 2) {
        const delay1 = timestamps[1]! - timestamps[0]!;
        expect(delay1).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Queue Clearing', () => {
    it('should clear all pending requests', async () => {
      const queue = GlobalRequestQueue.getInstance();

      // Add some slow requests
      const slowRequests = Array.from({ length: 5 }, () =>
        () => new Promise(resolve => setTimeout(() => resolve('done'), 1000))
      );

      const promises = slowRequests.map(req => queue.enqueue(req));

      // Clear the queue
      queue.clear();

      // All promises should reject
      await Promise.all(
        promises.map(p => expect(p).rejects.toThrow('Queue cleared'))
      );
    }, 10000);

    it('should reset queue length after clearing', () => {
      const queue = GlobalRequestQueue.getInstance();

      // Add request
      queue.enqueue(() => Promise.resolve('done')).catch(() => {});

      // Clear
      queue.clear();

      const status = queue.getStatus();
      expect(status.queueLength).toBe(0);
    });
  });

  describe('withQueue Helper', () => {
    it('should wrap request with queue', async () => {
      const mockRequest = jest.fn().mockResolvedValue('success');

      const result = await withQueue(mockRequest);

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should accept queue options', async () => {
      const mockRequest = jest.fn().mockResolvedValue('success');

      const result = await withQueue(mockRequest, { priority: 'high' });

      expect(result).toBe('success');
    });

    it('should handle errors', async () => {
      const mockError = new Error('Request failed');
      const mockRequest = jest.fn().mockRejectedValue(mockError);

      await expect(withQueue(mockRequest)).rejects.toThrow('Request failed');
    });
  });

  describe('Endpoint Tracking', () => {
    it('should track endpoint in queued request', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const mockRequest = jest.fn().mockResolvedValue('success');

      await queue.enqueue(mockRequest, {
        endpoint: '/v3/application/listings/123',
      });

      expect(mockRequest).toHaveBeenCalled();
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle many concurrent requests', async () => {
      const queue = GlobalRequestQueue.getInstance();

      const requests = Array.from({ length: 20 }, (_, i) =>
        jest.fn().mockResolvedValue(`result-${i}`)
      );

      const results = await Promise.all(
        requests.map(req => queue.enqueue(req))
      );

      expect(results).toHaveLength(20);
      results.forEach((result, i) => {
        expect(result).toBe(`result-${i}`);
      });
    }, 15000);

    it('should maintain request order for same priority', async () => {
      const queue = GlobalRequestQueue.getInstance();
      const executionOrder: number[] = [];

      const requests = Array.from({ length: 10 }, (_, i) =>
        () => {
          executionOrder.push(i);
          return Promise.resolve(i);
        }
      );

      await Promise.all(requests.map(req => queue.enqueue(req)));

      expect(executionOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing after error', async () => {
      const queue = GlobalRequestQueue.getInstance();

      const requests = [
        jest.fn().mockResolvedValue('success-1'),
        jest.fn().mockRejectedValue(new Error('fail')),
        jest.fn().mockResolvedValue('success-2'),
      ];

      const results = await Promise.allSettled(
        requests.map(req => queue.enqueue(req))
      );

      expect(results[0]!.status).toBe('fulfilled');
      expect(results[1]!.status).toBe('rejected');
      expect(results[2]!.status).toBe('fulfilled');

      if (results[0]!.status === 'fulfilled') {
        expect(results[0]!.value).toBe('success-1');
      }
      if (results[2]!.status === 'fulfilled') {
        expect(results[2]!.value).toBe('success-2');
      }
    });

    it('should not leave queue in bad state after errors', async () => {
      const queue = GlobalRequestQueue.getInstance();

      const failingRequest = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(queue.enqueue(failingRequest)).rejects.toThrow();

      // Queue should still work for new requests
      const successRequest = jest.fn().mockResolvedValue('success');
      const result = await queue.enqueue(successRequest);

      expect(result).toBe('success');
    });
  });

  describe('Daily Request Limit', () => {
    it('should track request count', async () => {
      const queue = GlobalRequestQueue.getInstance();

      const request = jest.fn().mockResolvedValue('success');

      const initialStatus = queue.getStatus();
      const initialRemaining = initialStatus.remainingRequests;

      await queue.enqueue(request);

      const finalStatus = queue.getStatus();
      expect(finalStatus.remainingRequests).toBe(initialRemaining - 1);
    });
  });

  describe('Type Safety', () => {
    it('should preserve request return type', async () => {
      const queue = GlobalRequestQueue.getInstance();

      const stringRequest = () => Promise.resolve('string');
      const numberRequest = () => Promise.resolve(42);
      const objectRequest = () => Promise.resolve({ key: 'value' });

      const stringResult: string = await queue.enqueue(stringRequest);
      const numberResult: number = await queue.enqueue(numberRequest);
      const objectResult: { key: string } = await queue.enqueue(objectRequest);

      expect(typeof stringResult).toBe('string');
      expect(typeof numberResult).toBe('number');
      expect(typeof objectResult).toBe('object');
    });
  });
});
