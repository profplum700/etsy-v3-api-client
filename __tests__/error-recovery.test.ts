/**
 * Tests for Enhanced Error Recovery (Phase 1)
 */

import { EtsyApiError, EtsyErrorDetails } from '../src/types';

describe('Enhanced Error Recovery', () => {
  describe('EtsyApiError', () => {
    describe('constructor', () => {
      it('should create error with message and status code', () => {
        const error = new EtsyApiError('Test error', 500);

        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe('EtsyApiError');
      });

      it('should create error with response data', () => {
        const response = {
          error_code: 'INVALID_REQUEST',
          field: 'title',
          message: 'Title is too long'
        };
        const error = new EtsyApiError('Validation error', 400, response);

        expect(error.response).toEqual(response);
        expect(error.details.errorCode).toBe('INVALID_REQUEST');
        expect(error.details.field).toBe('title');
      });

      it('should create error with retry-after value', () => {
        const error = new EtsyApiError('Rate limited', 429, null, 60);

        expect(error.getRetryAfter()).toBe(60);
      });

      it('should initialize structured error details', () => {
        const error = new EtsyApiError('Test error', 500);

        expect(error.details).toBeDefined();
        expect(error.details.statusCode).toBe(500);
      });

      it('should extract error details from response', () => {
        const response = {
          error_code: 'SERVER_ERROR',
          field: 'quantity',
          suggestion: 'Please reduce the quantity'
        };
        const error = new EtsyApiError('Error', 500, response);

        expect(error.details.errorCode).toBe('SERVER_ERROR');
        expect(error.details.field).toBe('quantity');
        expect(error.details.suggestion).toBe('Please reduce the quantity');
      });

      it('should handle response with "code" instead of "error_code"', () => {
        const response = {
          code: 'INVALID_PARAM'
        };
        const error = new EtsyApiError('Error', 400, response);

        expect(error.details.errorCode).toBe('INVALID_PARAM');
      });
    });

    describe('isRetryable()', () => {
      it('should return true for 429 rate limit errors', () => {
        const error = new EtsyApiError('Rate limited', 429);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 500 server errors', () => {
        const error = new EtsyApiError('Server error', 500);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 502 bad gateway', () => {
        const error = new EtsyApiError('Bad gateway', 502);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 503 service unavailable', () => {
        const error = new EtsyApiError('Service unavailable', 503);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 504 gateway timeout', () => {
        const error = new EtsyApiError('Gateway timeout', 504);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 408 request timeout', () => {
        const error = new EtsyApiError('Request timeout', 408);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 409 conflict', () => {
        const error = new EtsyApiError('Conflict', 409);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 423 locked', () => {
        const error = new EtsyApiError('Locked', 423);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return true for 425 too early', () => {
        const error = new EtsyApiError('Too early', 425);
        expect(error.isRetryable()).toBe(true);
      });

      it('should return false for 400 bad request', () => {
        const error = new EtsyApiError('Bad request', 400);
        expect(error.isRetryable()).toBe(false);
      });

      it('should return false for 401 unauthorized', () => {
        const error = new EtsyApiError('Unauthorized', 401);
        expect(error.isRetryable()).toBe(false);
      });

      it('should return false for 403 forbidden', () => {
        const error = new EtsyApiError('Forbidden', 403);
        expect(error.isRetryable()).toBe(false);
      });

      it('should return false for 404 not found', () => {
        const error = new EtsyApiError('Not found', 404);
        expect(error.isRetryable()).toBe(false);
      });

      it('should return false when no status code', () => {
        const error = new EtsyApiError('Error');
        expect(error.isRetryable()).toBe(false);
      });
    });

    describe('getRetryAfter()', () => {
      it('should return retry-after value when set', () => {
        const error = new EtsyApiError('Rate limited', 429, null, 60);
        expect(error.getRetryAfter()).toBe(60);
      });

      it('should return null when not set', () => {
        const error = new EtsyApiError('Error', 500);
        expect(error.getRetryAfter()).toBeNull();
      });
    });

    describe('getRateLimitReset()', () => {
      it('should return reset date for rate limit errors with retry-after', () => {
        const error = new EtsyApiError('Rate limited', 429, null, 60);
        const resetDate = error.getRateLimitReset();

        expect(resetDate).toBeInstanceOf(Date);

        // Should be approximately 60 seconds from now
        const expectedTime = Date.now() + 60 * 1000;
        const actualTime = resetDate!.getTime();
        expect(Math.abs(actualTime - expectedTime)).toBeLessThan(1000); // Within 1 second
      });

      it('should return null for non-rate-limit errors', () => {
        const error = new EtsyApiError('Server error', 500, null, 60);
        expect(error.getRateLimitReset()).toBeNull();
      });

      it('should return null when no retry-after value', () => {
        const error = new EtsyApiError('Rate limited', 429);
        expect(error.getRateLimitReset()).toBeNull();
      });
    });

    describe('getUserFriendlyMessage()', () => {
      it('should return basic message without enhancements', () => {
        const error = new EtsyApiError('Basic error', 400);
        const message = error.getUserFriendlyMessage();

        expect(message).toBe('Basic error');
      });

      it('should include suggestion when available', () => {
        const response = {
          suggestion: 'Please check your input'
        };
        const error = new EtsyApiError('Validation error', 400, response);
        const message = error.getUserFriendlyMessage();

        expect(message).toContain('Validation error');
        expect(message).toContain('Suggestion: Please check your input');
      });

      it('should include retry information for retryable errors', () => {
        const error = new EtsyApiError('Server error', 500);
        const message = error.getUserFriendlyMessage();

        expect(message).toContain('Server error');
        expect(message).toContain('This error can be retried');
      });

      it('should include retry-after time when available', () => {
        const error = new EtsyApiError('Rate limited', 429, null, 60);
        const message = error.getUserFriendlyMessage();

        expect(message).toContain('Rate limited');
        expect(message).toContain('Retry after 60 seconds');
      });

      it('should include both suggestion and retry information', () => {
        const response = {
          suggestion: 'Reduce request rate'
        };
        const error = new EtsyApiError('Rate limited', 429, response, 60);
        const message = error.getUserFriendlyMessage();

        expect(message).toContain('Rate limited');
        expect(message).toContain('Suggestion: Reduce request rate');
        expect(message).toContain('Retry after 60 seconds');
      });
    });

    describe('details property', () => {
      it('should contain statusCode', () => {
        const error = new EtsyApiError('Error', 500);
        expect(error.details.statusCode).toBe(500);
      });

      it('should contain errorCode when available', () => {
        const response = { error_code: 'TEST_ERROR' };
        const error = new EtsyApiError('Error', 500, response);
        expect(error.details.errorCode).toBe('TEST_ERROR');
      });

      it('should contain field when available', () => {
        const response = { field: 'title' };
        const error = new EtsyApiError('Error', 400, response);
        expect(error.details.field).toBe('title');
      });

      it('should contain suggestion when available', () => {
        const response = { suggestion: 'Fix this' };
        const error = new EtsyApiError('Error', 400, response);
        expect(error.details.suggestion).toBe('Fix this');
      });

      it('should contain retryAfter when available', () => {
        const error = new EtsyApiError('Error', 429, null, 120);
        expect(error.details.retryAfter).toBe(120);
      });

      it('should use message from response as suggestion', () => {
        const response = { message: 'This is helpful' };
        const error = new EtsyApiError('Error', 400, response);
        expect(error.details.suggestion).toBe('This is helpful');
      });
    });

    describe('backward compatibility', () => {
      it('should maintain statusCode getter', () => {
        const error = new EtsyApiError('Error', 500);
        expect(error.statusCode).toBe(500);
      });

      it('should maintain response getter', () => {
        const response = { data: 'test' };
        const error = new EtsyApiError('Error', 500, response);
        expect(error.response).toEqual(response);
      });

      it('should work with Error properties', () => {
        const error = new EtsyApiError('Test error', 500);
        expect(error.message).toBe('Test error');
        expect(error.name).toBe('EtsyApiError');
        expect(error.stack).toBeDefined();
      });
    });

    describe('edge cases', () => {
      it('should handle null response', () => {
        const error = new EtsyApiError('Error', 500, null);
        expect(error.details.errorCode).toBeUndefined();
        expect(error.details.field).toBeUndefined();
        expect(error.details.suggestion).toBeUndefined();
      });

      it('should handle undefined response', () => {
        const error = new EtsyApiError('Error', 500, undefined);
        expect(error.details.errorCode).toBeUndefined();
      });

      it('should handle non-object response', () => {
        const error = new EtsyApiError('Error', 500, 'string response');
        expect(error.details.errorCode).toBeUndefined();
      });

      it('should handle empty response object', () => {
        const error = new EtsyApiError('Error', 500, {});
        expect(error.details.errorCode).toBeUndefined();
        expect(error.details.field).toBeUndefined();
      });

      it('should handle missing status code', () => {
        const error = new EtsyApiError('Error');
        expect(error.statusCode).toBeUndefined();
        expect(error.details.statusCode).toBe(0);
        expect(error.isRetryable()).toBe(false);
      });
    });
  });
});
