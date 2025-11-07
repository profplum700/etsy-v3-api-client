/**
 * Unit tests for Enhanced Error Handling with Suggestions
 */

import { EtsyApiError } from '../src/types';

describe('Enhanced EtsyApiError', () => {
  describe('Constructor and Basic Properties', () => {
    it('should create error with endpoint parameter', () => {
      const error = new EtsyApiError(
        'Test error',
        404,
        undefined,
        undefined,
        '/v3/application/listings/123'
      );

      expect(error.endpoint).toBe('/v3/application/listings/123');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.suggestions).toBeDefined();
      expect(Array.isArray(error.suggestions)).toBe(true);
      expect(error.docsUrl).toBeDefined();
    });

    it('should extract validation errors from response', () => {
      const response = {
        errors: [
          { field: 'title', message: 'Title is required' },
          { field: 'price', message: 'Price must be positive' },
        ],
      };

      const error = new EtsyApiError('Validation failed', 400, response);

      expect(error.details.validationErrors).toBeDefined();
      expect(error.details.validationErrors).toHaveLength(2);
      expect(error.details.validationErrors?.[0]?.field).toBe('title');
      expect(error.details.validationErrors?.[0]?.message).toBe('Title is required');
    });

    it('should handle malformed validation errors gracefully', () => {
      const response = {
        errors: ['invalid', null, { field: 'test' }],
      };

      const error = new EtsyApiError('Validation failed', 400, response);

      expect(error.details.validationErrors).toBeDefined();
      expect(error.details.validationErrors).toHaveLength(3);
    });
  });

  describe('Suggestions for 400 Bad Request', () => {
    it('should provide suggestions for 400 errors', () => {
      const error = new EtsyApiError('Bad request', 400);

      expect(error.suggestions).toContain('Review the Etsy API documentation for this endpoint');
      expect(error.suggestions).toContain('Check all required parameters are provided');
      expect(error.suggestions).toContain('Validate parameter formats and types');
    });

    it('should include validation errors in suggestions', () => {
      const response = {
        errors: [
          { field: 'title', message: 'Must be 1-140 characters' },
          { field: 'price', message: 'Must be greater than 0' },
        ],
      };

      const error = new EtsyApiError('Validation failed', 400, response);

      const suggestionsText = error.suggestions.join('\n');
      expect(suggestionsText).toContain('title: Must be 1-140 characters');
      expect(suggestionsText).toContain('price: Must be greater than 0');
    });

    it('should include field name when provided', () => {
      const response = { field: 'quantity' };
      const error = new EtsyApiError('Invalid quantity', 400, response);

      expect(error.suggestions).toContain('Field causing issue: quantity');
    });
  });

  describe('Suggestions for 401 Unauthorized', () => {
    it('should provide suggestions for 401 errors', () => {
      const error = new EtsyApiError('Unauthorized', 401);

      expect(error.suggestions).toContain('Verify your access token is valid and not expired');
      expect(error.suggestions).toContain('Check if you need to refresh the token');
      expect(error.suggestions).toContain('Ensure you completed the OAuth flow correctly');
    });

    it('should provide shop-specific suggestions for shop endpoints', () => {
      const error = new EtsyApiError(
        'Unauthorized',
        401,
        undefined,
        undefined,
        '/v3/application/shops/123'
      );

      expect(error.suggestions).toContain('Verify the shop_id matches the authenticated user');
    });
  });

  describe('Suggestions for 403 Forbidden', () => {
    it('should provide scope suggestions for listings endpoints', () => {
      const error = new EtsyApiError(
        'Forbidden',
        403,
        undefined,
        undefined,
        '/v3/application/listings/123'
      );

      expect(error.suggestions).toContain('Check if your OAuth app has the required scopes:');
      expect(error.suggestions).toContain('  • listings_r (for reading listings)');
      expect(error.suggestions).toContain('  • listings_w (for creating/updating listings)');
    });

    it('should provide scope suggestions for receipts endpoints', () => {
      const error = new EtsyApiError(
        'Forbidden',
        403,
        undefined,
        undefined,
        '/v3/application/receipts/123'
      );

      expect(error.suggestions).toContain('  • transactions_r (for reading orders)');
    });

    it('should provide scope suggestions for shops endpoints', () => {
      const error = new EtsyApiError(
        'Forbidden',
        403,
        undefined,
        undefined,
        '/v3/application/shops/123'
      );

      expect(error.suggestions).toContain('  • shops_r (for reading shop data)');
      expect(error.suggestions).toContain('  • shops_w (for updating shop data)');
    });

    it('should suggest production approval', () => {
      const error = new EtsyApiError('Forbidden', 403);

      expect(error.suggestions).toContain('Verify your app is approved for production access');
      expect(error.suggestions).toContain('Check if the resource belongs to the authenticated user');
    });
  });

  describe('Suggestions for 404 Not Found', () => {
    it('should provide suggestions for 404 errors', () => {
      const error = new EtsyApiError('Not found', 404);

      expect(error.suggestions).toContain('Verify the resource ID exists and is spelled correctly');
    });

    it('should provide listing-specific suggestions', () => {
      const error = new EtsyApiError(
        'Not found',
        404,
        undefined,
        undefined,
        '/v3/application/listings/123'
      );

      expect(error.suggestions).toContain('Check if the listing is active and not deleted');
      expect(error.suggestions).toContain('Ensure the listing belongs to the authenticated shop');
    });

    it('should provide shop-specific suggestions', () => {
      const error = new EtsyApiError(
        'Not found',
        404,
        undefined,
        undefined,
        '/v3/application/shops/123'
      );

      expect(error.suggestions).toContain('Verify the shop ID is correct');
    });

    it('should provide receipt-specific suggestions', () => {
      const error = new EtsyApiError(
        'Not found',
        404,
        undefined,
        undefined,
        '/v3/application/receipts/123'
      );

      expect(error.suggestions).toContain('Check if the receipt ID is valid');
      expect(error.suggestions).toContain("Ensure you have access to this shop's receipts");
    });
  });

  describe('Suggestions for 409 Conflict', () => {
    it('should provide suggestions for 409 errors', () => {
      const error = new EtsyApiError('Conflict', 409);

      expect(error.suggestions).toContain('Resource state conflict detected');
      expect(error.suggestions).toContain('Check if the resource was modified by another process');
      expect(error.suggestions).toContain('Try fetching the latest resource state before updating');
    });
  });

  describe('Suggestions for 429 Rate Limited', () => {
    it('should provide rate limit suggestions', () => {
      const error = new EtsyApiError('Rate limited', 429);

      const suggestionsText = error.suggestions.join('\n');
      expect(suggestionsText).toContain('Rate limit exceeded');
      expect(suggestionsText).toContain('Implement exponential backoff retry logic');
      expect(suggestionsText).toContain('Consider caching responses to reduce API calls');
      expect(suggestionsText).toContain('Check if you can batch multiple operations');
    });

    it('should include retry-after time in suggestions', () => {
      const error = new EtsyApiError('Rate limited', 429, undefined, 300);

      expect(error.suggestions).toContain('Wait 300 seconds before retrying');
    });

    it('should include reset time in suggestions', () => {
      const error = new EtsyApiError('Rate limited', 429, undefined, 60);

      const suggestionsText = error.suggestions.join('\n');
      expect(suggestionsText).toContain('Rate limit exceeded. Resets at');
    });
  });

  describe('Suggestions for Server Errors (5xx)', () => {
    it('should provide suggestions for 500 errors', () => {
      const error = new EtsyApiError('Internal server error', 500);

      expect(error.suggestions).toContain("This is an Etsy server error, not your code");
      expect(error.suggestions).toContain('Retry the request after a short delay (exponential backoff)');
      expect(error.suggestions).toContain('Check Etsy API status: https://status.etsy.com');
    });

    it('should indicate retryable for 500 errors', () => {
      const error = new EtsyApiError('Internal server error', 500);

      expect(error.isRetryable()).toBe(true);
      expect(error.suggestions).toContain('This error is retryable - the request can be safely retried');
    });

    it('should provide same suggestions for 502, 503, 504', () => {
      const codes = [502, 503, 504];

      codes.forEach(code => {
        const error = new EtsyApiError('Server error', code);
        expect(error.suggestions).toContain("This is an Etsy server error, not your code");
        expect(error.isRetryable()).toBe(true);
      });
    });
  });

  describe('Suggestions for Other Errors', () => {
    it('should provide generic suggestions for unknown status codes', () => {
      const error = new EtsyApiError('Unknown error', 418);

      expect(error.suggestions).toContain('Check the Etsy API documentation for this endpoint');
      expect(error.suggestions).toContain('Review your request parameters and format');
    });

    it('should provide network error suggestions when no status code', () => {
      const error = new EtsyApiError('Network error');

      expect(error.suggestions).toContain('Check your network connection and try again');
    });

    it('should include Etsy suggestion when provided in response', () => {
      const response = { suggestion: 'Try using a different value' };
      const error = new EtsyApiError('Error', 422, response);

      expect(error.suggestions).toContain('Etsy suggestion: Try using a different value');
    });
  });

  describe('Documentation URL Generation', () => {
    it('should generate docs URL with error code', () => {
      const response = { error_code: 'INVALID_PARAM' };
      const error = new EtsyApiError('Error', 400, response);

      expect(error.docsUrl).toBe(
        'https://github.com/profplum700/etsy-v3-api-client/blob/main/docs/troubleshooting/ERROR_CODES.md#invalid_param'
      );
    });

    it('should generate docs URL with status code when no error code', () => {
      const error = new EtsyApiError('Error', 404);

      expect(error.docsUrl).toBe(
        'https://github.com/profplum700/etsy-v3-api-client/blob/main/docs/troubleshooting/ERROR_CODES.md#404'
      );
    });

    it('should handle missing status code and error code', () => {
      const error = new EtsyApiError('Error');

      expect(error.docsUrl).toContain('unknown');
    });
  });

  describe('toString() Method', () => {
    it('should format error with all information', () => {
      const error = new EtsyApiError(
        'Test error',
        404,
        { error_code: 'NOT_FOUND' },
        undefined,
        '/v3/application/listings/123'
      );

      const errorString = error.toString();

      expect(errorString).toContain('EtsyApiError: Test error');
      expect(errorString).toContain('Status Code: 404');
      expect(errorString).toContain('Error Code: NOT_FOUND');
      expect(errorString).toContain('Endpoint: /v3/application/listings/123');
      expect(errorString).toContain('Timestamp:');
      expect(errorString).toContain('Suggestions:');
      expect(errorString).toContain('Documentation:');
    });

    it('should handle nested validation error formatting', () => {
      const response = {
        errors: [
          { field: 'title', message: 'Required' },
        ],
      };

      const error = new EtsyApiError('Validation failed', 400, response);
      const errorString = error.toString();

      // Validation errors should be included without double bullets
      expect(errorString).toContain('title: Required');
    });

    it('should handle missing optional fields', () => {
      const error = new EtsyApiError('Simple error');
      const errorString = error.toString();

      expect(errorString).toContain('EtsyApiError: Simple error');
      expect(errorString).toContain('Status Code: Unknown');
      expect(errorString).not.toContain('Error Code:');
      expect(errorString).not.toContain('Endpoint:');
    });
  });

  describe('toJSON() Method', () => {
    it('should return JSON representation with all fields', () => {
      const error = new EtsyApiError(
        'Test error',
        404,
        { error_code: 'NOT_FOUND' },
        undefined,
        '/v3/application/listings/123'
      );

      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'EtsyApiError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('statusCode', 404);
      expect(json).toHaveProperty('errorCode', 'NOT_FOUND');
      expect(json).toHaveProperty('endpoint', '/v3/application/listings/123');
      expect(json).toHaveProperty('suggestions');
      expect(json).toHaveProperty('docsUrl');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('details');
      expect(json).toHaveProperty('isRetryable');
    });

    it('should be serializable to JSON', () => {
      const error = new EtsyApiError('Test error', 404);
      const json = error.toJSON();

      expect(() => JSON.stringify(json)).not.toThrow();

      const parsed = JSON.parse(JSON.stringify(json));
      expect(parsed.message).toBe('Test error');
      expect(parsed.statusCode).toBe(404);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility with old error creation', () => {
      const error = new EtsyApiError('Old style error', 404);

      // Old properties should still work
      expect(error.message).toBe('Old style error');
      expect(error.statusCode).toBe(404);
      expect(error.isRetryable()).toBe(false);
      expect(error.getRetryAfter()).toBeNull();
      expect(error.getRateLimitReset()).toBeNull();
    });

    it('should work with existing error handling code', () => {
      const error = new EtsyApiError('Error', 429, undefined, 60);

      // Old methods should still work
      expect(error.isRetryable()).toBe(true);
      expect(error.getRetryAfter()).toBe(60);
      expect(error.getRateLimitReset()).toBeInstanceOf(Date);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined response gracefully', () => {
      const error = new EtsyApiError('Error', 400, undefined);

      expect(error.details.validationErrors).toBeUndefined();
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle null response gracefully', () => {
      const error = new EtsyApiError('Error', 400, null);

      expect(error.details.validationErrors).toBeUndefined();
      expect(error.suggestions).toBeDefined();
    });

    it('should handle empty errors array', () => {
      const response = { errors: [] };
      const error = new EtsyApiError('Error', 400, response);

      expect(error.details.validationErrors).toEqual([]);
    });

    it('should handle very long suggestion lists', () => {
      const response = {
        errors: Array.from({ length: 50 }, (_, i) => ({
          field: `field${i}`,
          message: `Error ${i}`,
        })),
      };

      const error = new EtsyApiError('Many errors', 400, response);
      const errorString = error.toString();

      expect(error.details.validationErrors).toHaveLength(50);
      expect(errorString.length).toBeGreaterThan(100);
    });
  });
});
