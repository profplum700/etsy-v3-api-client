/**
 * Unit tests for TokenManager
 */

import { TokenManager, MemoryTokenStorage, FileTokenStorage } from '../../src/auth/token-manager';
import { EtsyAuthError, EtsyClientConfig, EtsyTokens } from '../../src/types';
import { promises as fs } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn()
  }
}));
// Mock node-fetch
jest.mock('node-fetch');

describe('TokenManager', () => {
  let mockConfig: EtsyClientConfig;
  let mockFetch: jest.Mock;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockConfig = {
      keystring: 'test-api-key',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };

    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    // Set up fs mocks properly
    mockFs = require('fs').promises as jest.Mocked<typeof fs>;
    mockFs.writeFile = jest.fn();
    mockFs.readFile = jest.fn();
    mockFs.unlink = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with required configuration', () => {
      const tokenManager = new TokenManager(mockConfig);
      expect(tokenManager).toBeInstanceOf(TokenManager);
    });

    it('should initialize with storage and callback', () => {
      const mockStorage = new MemoryTokenStorage();
      const mockCallback = jest.fn();
      const configWithCallback = {
        ...mockConfig,
        refreshSave: mockCallback
      };

      const tokenManager = new TokenManager(configWithCallback, mockStorage);
      expect(tokenManager).toBeInstanceOf(TokenManager);
    });
  });

  describe('getAccessToken', () => {
    it('should return current access token when not expired', async () => {
      const tokenManager = new TokenManager(mockConfig);
      const accessToken = await tokenManager.getAccessToken();
      expect(accessToken).toBe('test-access-token');
    });

    it('should refresh token when expired', async () => {
      const expiredConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      };

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const tokenManager = new TokenManager(expiredConfig);
      const accessToken = await tokenManager.getAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/public/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: expect.stringContaining('grant_type=refresh_token')
        })
      );
      expect(accessToken).toBe('new-access-token');
    });

    it('should refresh token when expires soon (within 1 minute)', async () => {
      const soonToExpireConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() + 30000) // 30 seconds from now
      };

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const tokenManager = new TokenManager(soonToExpireConfig);
      const accessToken = await tokenManager.getAccessToken();

      expect(mockFetch).toHaveBeenCalled();
      expect(accessToken).toBe('new-access-token');
    });

    it('should load tokens from storage when not initialized', async () => {
      const configWithoutTokens = {
        keystring: 'test-api-key',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const mockStorage = new MemoryTokenStorage();
      const mockTokens: EtsyTokens = {
        access_token: 'stored-access-token',
        refresh_token: 'stored-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      jest.spyOn(mockStorage, 'load').mockResolvedValue(mockTokens);

      const tokenManager = new TokenManager(configWithoutTokens, mockStorage);
      // Clear current tokens to simulate loading from storage
      await tokenManager.clearTokens();
      await mockStorage.save(mockTokens);

      const accessToken = await tokenManager.getAccessToken();
      expect(accessToken).toBe('stored-access-token');
    });

    it('should throw error when no tokens available', async () => {
      const configWithoutTokens = {
        keystring: 'test-api-key',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const tokenManager = new TokenManager(configWithoutTokens);
      await tokenManager.clearTokens();

      await expect(tokenManager.getAccessToken()).rejects.toThrow(EtsyAuthError);
      await expect(tokenManager.getAccessToken()).rejects.toThrow('No tokens available');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const tokenManager = new TokenManager(mockConfig);
      const result = await tokenManager.refreshToken();

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: expect.any(Date),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      });
    });

    it('should handle concurrent refresh requests', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const tokenManager = new TokenManager(mockConfig);
      
      // Start multiple refresh operations simultaneously
      const refreshPromises = [
        tokenManager.refreshToken(),
        tokenManager.refreshToken(),
        tokenManager.refreshToken()
      ];

      const results = await Promise.all(refreshPromises);

      // Should only make one API call
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // All promises should resolve to the same result
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

    it('should call refresh callback when provided', async () => {
      const mockCallback = jest.fn();
      const configWithCallback = {
        ...mockConfig,
        refreshSave: mockCallback
      };

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const tokenManager = new TokenManager(configWithCallback);
      await tokenManager.refreshToken();

      expect(mockCallback).toHaveBeenCalledWith(
        'new-access-token',
        'new-refresh-token',
        expect.any(Date)
      );
    });

    it('should save to storage when provided', async () => {
      const mockStorage = new MemoryTokenStorage();
      const saveSpy = jest.spyOn(mockStorage, 'save');

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const tokenManager = new TokenManager(mockConfig, mockStorage);
      await tokenManager.refreshToken();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      }));
    });

    it('should handle refresh failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('Invalid refresh token')
      });

      const tokenManager = new TokenManager(mockConfig);
      
      await expect(tokenManager.refreshToken()).rejects.toThrow(EtsyAuthError);
      await expect(tokenManager.refreshToken()).rejects.toThrow('Token refresh failed: 400 Bad Request');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const tokenManager = new TokenManager(mockConfig);
      
      await expect(tokenManager.refreshToken()).rejects.toThrow(EtsyAuthError);
      await expect(tokenManager.refreshToken()).rejects.toThrow('Token refresh failed: Network error');
    });

    it('should throw error when no tokens available', async () => {
      const configWithoutTokens = {
        keystring: 'test-api-key',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const tokenManager = new TokenManager(configWithoutTokens);
      await tokenManager.clearTokens();

      await expect(tokenManager.refreshToken()).rejects.toThrow(EtsyAuthError);
      await expect(tokenManager.refreshToken()).rejects.toThrow('No tokens available to refresh');
    });
  });

  describe('getCurrentTokens', () => {
    it('should return current tokens', () => {
      const tokenManager = new TokenManager(mockConfig);
      const tokens = tokenManager.getCurrentTokens();
      
      expect(tokens).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: expect.any(Date),
        token_type: 'Bearer',
        scope: ''
      });
    });

    it('should return null when no tokens', async () => {
      const tokenManager = new TokenManager(mockConfig);
      await tokenManager.clearTokens();
      
      const tokens = tokenManager.getCurrentTokens();
      expect(tokens).toBeNull();
    });

    it('should return a copy of tokens', () => {
      const tokenManager = new TokenManager(mockConfig);
      const tokens1 = tokenManager.getCurrentTokens();
      const tokens2 = tokenManager.getCurrentTokens();
      
      expect(tokens1).not.toBe(tokens2);
      expect(tokens1).toEqual(tokens2);
    });
  });

  describe('updateTokens', () => {
    it('should update tokens manually', () => {
      const tokenManager = new TokenManager(mockConfig);
      const newTokens: EtsyTokens = {
        access_token: 'updated-access-token',
        refresh_token: 'updated-refresh-token',
        expires_at: new Date(Date.now() + 7200000),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      tokenManager.updateTokens(newTokens);
      const currentTokens = tokenManager.getCurrentTokens();
      
      expect(currentTokens).toEqual(newTokens);
      expect(currentTokens).not.toBe(newTokens); // Should be a copy
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const tokenManager = new TokenManager(mockConfig);
      expect(tokenManager.isTokenExpired()).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() - 1000)
      };
      const tokenManager = new TokenManager(expiredConfig);
      expect(tokenManager.isTokenExpired()).toBe(true);
    });

    it('should return true when no tokens', async () => {
      const tokenManager = new TokenManager(mockConfig);
      await tokenManager.clearTokens();
      expect(tokenManager.isTokenExpired()).toBe(true);
    });
  });

  describe('willTokenExpireSoon', () => {
    it('should return false for token expiring in more than 5 minutes', () => {
      const tokenManager = new TokenManager(mockConfig);
      expect(tokenManager.willTokenExpireSoon()).toBe(false);
    });

    it('should return true for token expiring in less than 5 minutes', () => {
      const soonToExpireConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() + 240000) // 4 minutes from now
      };
      const tokenManager = new TokenManager(soonToExpireConfig);
      expect(tokenManager.willTokenExpireSoon()).toBe(true);
    });

    it('should return true for token expiring in less than custom minutes', () => {
      const soonToExpireConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() + 540000) // 9 minutes from now
      };
      const tokenManager = new TokenManager(soonToExpireConfig);
      expect(tokenManager.willTokenExpireSoon(10)).toBe(true);
    });

    it('should return true when no tokens', async () => {
      const tokenManager = new TokenManager(mockConfig);
      await tokenManager.clearTokens();
      expect(tokenManager.willTokenExpireSoon()).toBe(true);
    });
  });

  describe('clearTokens', () => {
    it('should clear tokens', async () => {
      const tokenManager = new TokenManager(mockConfig);
      await tokenManager.clearTokens();
      
      expect(tokenManager.getCurrentTokens()).toBeNull();
    });

    it('should clear storage when provided', async () => {
      const mockStorage = new MemoryTokenStorage();
      const clearSpy = jest.spyOn(mockStorage, 'clear');

      const tokenManager = new TokenManager(mockConfig, mockStorage);
      await tokenManager.clearTokens();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('getTimeUntilExpiration', () => {
    it('should return time until expiration', () => {
      const tokenManager = new TokenManager(mockConfig);
      const timeUntilExpiration = tokenManager.getTimeUntilExpiration();
      
      expect(timeUntilExpiration).toBeGreaterThan(0);
      expect(timeUntilExpiration).toBeLessThanOrEqual(3600000); // 1 hour
    });

    it('should return null when no tokens', async () => {
      const tokenManager = new TokenManager(mockConfig);
      await tokenManager.clearTokens();
      
      const timeUntilExpiration = tokenManager.getTimeUntilExpiration();
      expect(timeUntilExpiration).toBeNull();
    });
  });

  describe('fetch method', () => {
    it('should handle fetch not available error', async () => {
      // Remove global fetch
      delete (global as any).fetch;
      
      // Mock dynamic import to fail
      jest.doMock('node-fetch', () => {
        throw new Error('node-fetch not available');
      });

      const tokenManager = new TokenManager(mockConfig);
      
      await expect(tokenManager.refreshToken()).rejects.toThrow(EtsyAuthError);
      await expect(tokenManager.refreshToken()).rejects.toThrow('Fetch is not available');
    });
  });
});

describe('MemoryTokenStorage', () => {
  let storage: MemoryTokenStorage;
  let mockTokens: EtsyTokens;

  beforeEach(() => {
    storage = new MemoryTokenStorage();
    mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: new Date(Date.now() + 3600000),
      token_type: 'Bearer',
      scope: 'shops_r listings_r'
    };
  });

  it('should save and load tokens', async () => {
    await storage.save(mockTokens);
    const loadedTokens = await storage.load();
    
    expect(loadedTokens).toEqual(mockTokens);
    expect(loadedTokens).not.toBe(mockTokens); // Should be a copy
  });

  it('should return null when no tokens saved', async () => {
    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });

  it('should clear tokens', async () => {
    await storage.save(mockTokens);
    await storage.clear();
    
    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });
});

describe('FileTokenStorage', () => {
  let storage: FileTokenStorage;
  let mockTokens: EtsyTokens;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    storage = new FileTokenStorage('/tmp/test-tokens.json');
    mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: new Date(Date.now() + 3600000),
      token_type: 'Bearer',
      scope: 'shops_r listings_r'
    };

    // Set up fs mocks for this describe block
    mockFs = require('fs').promises as jest.Mocked<typeof fs>;
    mockFs.writeFile = jest.fn();
    mockFs.readFile = jest.fn();
    mockFs.unlink = jest.fn();
  });

  it('should save and load tokens', async () => {
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockTokens));

    await storage.save(mockTokens);
    const loadedTokens = await storage.load();
    
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/tmp/test-tokens.json',
      expect.stringContaining('"access_token": "test-access-token"'),
      'utf8'
    );
    expect(mockFs.readFile).toHaveBeenCalledWith('/tmp/test-tokens.json', 'utf8');
    expect(loadedTokens).toEqual(mockTokens);
  });

  it('should return null when file does not exist', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });

  it('should handle date conversion when loading', async () => {
    const tokensWithStringDate = {
      ...mockTokens,
      expires_at: mockTokens.expires_at.toISOString()
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(tokensWithStringDate));

    const loadedTokens = await storage.load();
    
    expect(loadedTokens?.expires_at).toBeInstanceOf(Date);
    expect(loadedTokens?.expires_at).toEqual(mockTokens.expires_at);
  });

  it('should clear tokens by deleting file', async () => {
    mockFs.unlink.mockResolvedValue(undefined);

    await storage.clear();
    
    expect(mockFs.unlink).toHaveBeenCalledWith('/tmp/test-tokens.json');
  });

  it('should handle error when clearing non-existent file', async () => {
    mockFs.unlink.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    // Should not throw error
    await storage.clear();
    
    expect(mockFs.unlink).toHaveBeenCalledWith('/tmp/test-tokens.json');
  });
});