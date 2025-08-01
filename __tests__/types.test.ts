/**
 * Unit tests for Types and Utilities
 */

import {
  EtsyApiError,
  EtsyAuthError,
  EtsyRateLimitError,
  ETSY_WHEN_MADE_VALUES
} from '../src/types';

import {
  VERSION,
  LIBRARY_NAME,
  getLibraryInfo,
  createEtsyClient,
  createAuthHelper,
  createTokenManager,
  createRateLimiter,
} from '../src/index';

import { EtsyClient } from '../src/client';
import { AuthHelper } from '../src/auth/auth-helper';
import { TokenManager } from '../src/auth/token-manager';
import { EtsyRateLimiter } from '../src/rate-limiting';

describe('Error Classes', () => {
  describe('EtsyApiError', () => {
    it('should create error with message only', () => {
      const error = new EtsyApiError('Test error message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EtsyApiError);
      expect(error.name).toBe('EtsyApiError');
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBeUndefined();
      expect(error.response).toBeUndefined();
    });

    it('should create error with message and status code', () => {
      const error = new EtsyApiError('Test error message', 404);
      
      expect(error.name).toBe('EtsyApiError');
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(404);
      expect(error.response).toBeUndefined();
    });

    it('should create error with message, status code, and response', () => {
      const response = { error: 'Not found' };
      const error = new EtsyApiError('Test error message', 404, response);
      
      expect(error.name).toBe('EtsyApiError');
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(404);
      expect(error.response).toBe(response);
    });

    it('should have proper stack trace', () => {
      const error = new EtsyApiError('Test error message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('EtsyApiError');
    });
  });

  describe('EtsyAuthError', () => {
    it('should create error with message only', () => {
      const error = new EtsyAuthError('Auth error message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EtsyAuthError);
      expect(error.name).toBe('EtsyAuthError');
      expect(error.message).toBe('Auth error message');
      expect(error.code).toBeUndefined();
    });

    it('should create error with message and code', () => {
      const error = new EtsyAuthError('Auth error message', 'INVALID_TOKEN');
      
      expect(error.name).toBe('EtsyAuthError');
      expect(error.message).toBe('Auth error message');
      expect(error.code).toBe('INVALID_TOKEN');
    });

    it('should have proper stack trace', () => {
      const error = new EtsyAuthError('Auth error message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('EtsyAuthError');
    });
  });

  describe('EtsyRateLimitError', () => {
    it('should create error with message only', () => {
      const error = new EtsyRateLimitError('Rate limit exceeded');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EtsyRateLimitError);
      expect(error.name).toBe('EtsyRateLimitError');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBeUndefined();
    });

    it('should create error with message and retry after', () => {
      const error = new EtsyRateLimitError('Rate limit exceeded', 300);
      
      expect(error.name).toBe('EtsyRateLimitError');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBe(300);
    });

    it('should have proper stack trace', () => {
      const error = new EtsyRateLimitError('Rate limit exceeded');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('EtsyRateLimitError');
    });
  });
});

describe('Constants', () => {
  describe('ETSY_WHEN_MADE_VALUES', () => {
    it('should contain all expected when_made values', () => {
      const expectedValues = [
        '1990s',
        '1980s',
        '1970s',
        '1960s',
        '1950s',
        '1940s',
        '1930s',
        '1920s',
        '1910s',
        '1900s',
        '1800s',
        '1700s',
        'before_1700'
      ];

      expect(ETSY_WHEN_MADE_VALUES).toEqual(expectedValues);
    });

    it('should be a readonly array', () => {
      expect(Array.isArray(ETSY_WHEN_MADE_VALUES)).toBe(true);
      expect(ETSY_WHEN_MADE_VALUES.length).toBe(13);
    });

    it('should be sorted from most recent to oldest', () => {
      const decades = ETSY_WHEN_MADE_VALUES.filter(v => v.includes('s') && v !== 'before_1700');
      
      for (let i = 0; i < decades.length - 1; i++) {
        const current = parseInt(decades[i]);
        const next = parseInt(decades[i + 1]);
        expect(current).toBeGreaterThan(next);
      }
    });
  });

  describe('VERSION and LIBRARY_NAME', () => {
    it('should have correct version', () => {
      expect(VERSION).toBe('1.0.2');
      expect(typeof VERSION).toBe('string');
    });

    it('should have correct library name', () => {
      expect(LIBRARY_NAME).toBe('etsy-v3-api-client');
      expect(typeof LIBRARY_NAME).toBe('string');
    });
  });
});

describe('Utility Functions', () => {
  describe('getLibraryInfo', () => {
    it('should return correct library information', () => {
      const info = getLibraryInfo();
      
      expect(info).toEqual({
        name: 'etsy-v3-api-client',
        version: '1.0.2',
        description: 'JavaScript/TypeScript client for the Etsy Open API v3 with OAuth 2.0 authentication',
        author: 'profplum700',
        license: 'MIT',
        homepage: 'https://github.com/ForestHillArtsHouse/etsy-v3-api-client#readme'
      });
    });

    it('should return a new object each time', () => {
      const info1 = getLibraryInfo();
      const info2 = getLibraryInfo();
      
      expect(info1).not.toBe(info2);
      expect(info1).toEqual(info2);
    });
  });

  describe('createEtsyClient', () => {
    it('should create an EtsyClient instance', () => {
      const config = {
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date()
      };

      const client = createEtsyClient(config);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should pass configuration to EtsyClient', () => {
      const config = {
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(),
        baseUrl: 'https://custom.api.com'
      };

      const client = createEtsyClient(config);
      expect(client).toBeInstanceOf(EtsyClient);
    });
  });

  describe('createAuthHelper', () => {
    it('should create an AuthHelper instance', () => {
      const config = {
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r']
      };

      const authHelper = createAuthHelper(config);
      expect(authHelper).toBeInstanceOf(AuthHelper);
    });

    it('should pass configuration to AuthHelper', async () => {
      const config = {
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r'],
        state: 'custom-state'
      };

      const authHelper = createAuthHelper(config);
      expect(authHelper).toBeInstanceOf(AuthHelper);
      expect(await authHelper.getState()).toBe('custom-state');
    });
  });

  describe('createTokenManager', () => {
    it('should create a TokenManager instance', () => {
      const config = {
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date()
      };

      const tokenManager = createTokenManager(config);
      expect(tokenManager).toBeInstanceOf(TokenManager);
    });

    it('should create TokenManager with storage', () => {
      const config = {
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date()
      };

      const mockStorage = {
        save: jest.fn(),
        load: jest.fn(),
        clear: jest.fn()
      };

      const tokenManager = createTokenManager(config, mockStorage);
      expect(tokenManager).toBeInstanceOf(TokenManager);
    });
  });

  describe('createRateLimiter', () => {
    it('should create an EtsyRateLimiter instance with defaults', () => {
      const rateLimiter = createRateLimiter();
      expect(rateLimiter).toBeInstanceOf(EtsyRateLimiter);
    });

    it('should create EtsyRateLimiter with custom configuration', () => {
      const config = {
        maxRequestsPerDay: 5000,
        maxRequestsPerSecond: 5
      };

      const rateLimiter = createRateLimiter(config);
      expect(rateLimiter).toBeInstanceOf(EtsyRateLimiter);
      
      const rateLimiterConfig = rateLimiter.getConfig();
      expect(rateLimiterConfig.maxRequestsPerDay).toBe(5000);
      expect(rateLimiterConfig.maxRequestsPerSecond).toBe(5);
    });
  });

});

describe('Type Definitions', () => {
  describe('Interface completeness', () => {
    it('should have all required properties in EtsyClientConfig', () => {
      const config = {
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date()
      };

      // Should not throw TypeScript errors
      expect(typeof config.keystring).toBe('string');
      expect(typeof config.accessToken).toBe('string');
      expect(typeof config.refreshToken).toBe('string');
      expect(config.expiresAt).toBeInstanceOf(Date);
    });

    it('should have all required properties in AuthHelperConfig', () => {
      const config = {
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r']
      };

      // Should not throw TypeScript errors
      expect(typeof config.keystring).toBe('string');
      expect(typeof config.redirectUri).toBe('string');
      expect(Array.isArray(config.scopes)).toBe(true);
    });
  });

  describe('Type guards and validation', () => {
    it('should validate ETSY_WHEN_MADE_VALUES type', () => {
      const testValue = '1950s';
      expect(ETSY_WHEN_MADE_VALUES.includes(testValue as typeof ETSY_WHEN_MADE_VALUES[number])).toBe(true);
      
      const invalidValue = '2000s';
      expect(ETSY_WHEN_MADE_VALUES.includes(invalidValue as typeof ETSY_WHEN_MADE_VALUES[number])).toBe(false);
    });

    it('should validate error instances', () => {
      const apiError = new EtsyApiError('test');
      const authError = new EtsyAuthError('test');
      const rateLimitError = new EtsyRateLimitError('test');

      expect(apiError instanceof Error).toBe(true);
      expect(authError instanceof Error).toBe(true);
      expect(rateLimitError instanceof Error).toBe(true);
      
      expect(apiError instanceof EtsyApiError).toBe(true);
      expect(authError instanceof EtsyAuthError).toBe(true);
      expect(rateLimitError instanceof EtsyRateLimitError).toBe(true);
    });
  });
});

describe('Integration with other modules', () => {
  it('should work correctly with EtsyClient', () => {
    const config = {
      keystring: 'test-key',
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAt: new Date()
    };

    const client = createEtsyClient(config);
    expect(client.getRemainingRequests()).toBeDefined();
    expect(client.getCurrentTokens()).toBeDefined();
  });

  it('should work correctly with AuthHelper', async () => {
    const config = {
      keystring: 'test-key',
      redirectUri: 'https://example.com/callback',
      scopes: ['shops_r', 'listings_r']
    };

    const authHelper = createAuthHelper(config);
    const authUrl = await authHelper.getAuthUrl();
    expect(authUrl).toContain('https://www.etsy.com/oauth/connect');
    expect(authHelper.getScopes()).toEqual(['shops_r', 'listings_r']);
  });

  it('should work correctly with rate limiter', () => {
    const rateLimiter = createRateLimiter();
    const status = rateLimiter.getRateLimitStatus();
    
    expect(status).toHaveProperty('remainingRequests');
    expect(status).toHaveProperty('resetTime');
    expect(status).toHaveProperty('canMakeRequest');
  });
});

describe('Error handling scenarios', () => {
  it('should handle error chaining properly', () => {
    const originalError = new Error('Original error');
    const wrappedError = new EtsyApiError('Wrapped error', 500, originalError);
    
    expect(wrappedError.response).toBe(originalError);
    expect(wrappedError.statusCode).toBe(500);
    expect(wrappedError.message).toBe('Wrapped error');
  });

  it('should handle error serialization', () => {
    const error = new EtsyApiError('Test error', 404, { detail: 'Not found' });
    
    // Should be JSON serializable
    const serialized = JSON.stringify({
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      response: error.response
    });
    
    expect(serialized).toContain('Test error');
    expect(serialized).toContain('404');
    expect(serialized).toContain('Not found');
  });
});

describe('Edge cases and boundary conditions', () => {
  it('should handle empty configurations gracefully', () => {
    expect(() => {
      const config = {
        keystring: '',
        accessToken: '',
        refreshToken: '',
        expiresAt: new Date()
      };
      createEtsyClient(config);
    }).not.toThrow();
  });

  it('should handle undefined optional properties', () => {
    const config = {
      keystring: 'test-key',
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAt: new Date(),
      baseUrl: undefined,
      refreshSave: undefined
    };

    expect(() => createEtsyClient(config)).not.toThrow();
  });

  it('should handle very large numbers in configurations', () => {
    const config = {
      maxRequestsPerDay: Number.MAX_SAFE_INTEGER,
      maxRequestsPerSecond: 1000,
      minRequestInterval: 0
    };

    expect(() => createRateLimiter(config)).not.toThrow();
  });
});