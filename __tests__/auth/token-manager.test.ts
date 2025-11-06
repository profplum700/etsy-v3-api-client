/**
 * Unit tests for TokenManager
 */

import {
  TokenManager,
  MemoryTokenStorage,
  FileTokenStorage,
  createDefaultTokenStorage
} from '../../src/auth/token-manager';
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
    (global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

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

describe('LocalStorageTokenStorage', () => {
  let storage: any;
  let mockTokens: EtsyTokens;
  let mockLocalStorage: { [key: string]: string };
  let LocalStorageTokenStorage: any;

  beforeEach(() => {
    // Mock browser environment first
    delete (global as any).process;
    Object.defineProperty(global, 'window', {
      value: { document: {} },
      writable: true,
      configurable: true,
    });

    // Mock localStorage
    mockLocalStorage = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: jest.fn(() => {
          Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
        }),
      },
      writable: true,
      configurable: true,
    });

    // Reset modules and import with fresh environment
    jest.resetModules();
    ({ LocalStorageTokenStorage } = require('../../src/auth/token-manager'));
    
    storage = new LocalStorageTokenStorage('test-tokens');
    mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: new Date(Date.now() + 3600000),
      token_type: 'Bearer',
      scope: 'shops_r listings_r'
    };
  });

  afterEach(() => {
    delete (global as any).localStorage;
    delete (global as any).window;
  });

  it('should save and load tokens', async () => {
    await storage.save(mockTokens);
    const loadedTokens = await storage.load();
    
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'test-tokens',
      expect.stringContaining('"access_token":"test-access-token"')
    );
    expect(localStorage.getItem).toHaveBeenCalledWith('test-tokens');
    expect(loadedTokens).toEqual(mockTokens);
  });

  it('should return null when no tokens stored', async () => {
    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });

  it('should handle date conversion when loading', async () => {
    const tokensWithStringDate = {
      ...mockTokens,
      expires_at: mockTokens.expires_at.toISOString()
    };
    mockLocalStorage['test-tokens'] = JSON.stringify(tokensWithStringDate);

    const loadedTokens = await storage.load();
    
    expect(loadedTokens?.expires_at).toBeInstanceOf(Date);
    expect(loadedTokens?.expires_at).toEqual(mockTokens.expires_at);
  });

  it('should clear tokens', async () => {
    await storage.save(mockTokens);
    await storage.clear();
    
    expect(localStorage.removeItem).toHaveBeenCalledWith('test-tokens');
    
    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });

  it('should handle localStorage errors gracefully', async () => {
    // Mock localStorage to throw errors
    (localStorage.setItem as jest.Mock).mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    await expect(storage.save(mockTokens)).rejects.toThrow('Storage quota exceeded');
  });

  it('should handle JSON parse errors', async () => {
    mockLocalStorage['test-tokens'] = 'invalid-json';

    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });
});

describe('SessionStorageTokenStorage', () => {
  let storage: any;
  let mockTokens: EtsyTokens;
  let mockSessionStorage: { [key: string]: string };
  let SessionStorageTokenStorage: any;

  beforeEach(() => {
    // Mock browser environment first
    delete (global as any).process;
    Object.defineProperty(global, 'window', {
      value: { document: {} },
      writable: true,
      configurable: true,
    });

    // Mock sessionStorage
    mockSessionStorage = {};
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: jest.fn((key: string) => mockSessionStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
        clear: jest.fn(() => {
          Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);
        }),
      },
      writable: true,
      configurable: true,
    });

    // Reset modules and import with fresh environment
    jest.resetModules();
    ({ SessionStorageTokenStorage } = require('../../src/auth/token-manager'));
    
    storage = new SessionStorageTokenStorage('test-tokens');
    mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: new Date(Date.now() + 3600000),
      token_type: 'Bearer',
      scope: 'shops_r listings_r'
    };
  });

  afterEach(() => {
    delete (global as any).sessionStorage;
    delete (global as any).window;
  });

  it('should save and load tokens', async () => {
    await storage.save(mockTokens);
    const loadedTokens = await storage.load();
    
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'test-tokens',
      expect.stringContaining('"access_token":"test-access-token"')
    );
    expect(sessionStorage.getItem).toHaveBeenCalledWith('test-tokens');
    expect(loadedTokens).toEqual(mockTokens);
  });

  it('should return null when no tokens stored', async () => {
    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });

  it('should handle date conversion when loading', async () => {
    const tokensWithStringDate = {
      ...mockTokens,
      expires_at: mockTokens.expires_at.toISOString()
    };
    mockSessionStorage['test-tokens'] = JSON.stringify(tokensWithStringDate);

    const loadedTokens = await storage.load();
    
    expect(loadedTokens?.expires_at).toBeInstanceOf(Date);
    expect(loadedTokens?.expires_at).toEqual(mockTokens.expires_at);
  });

  it('should clear tokens', async () => {
    await storage.save(mockTokens);
    await storage.clear();
    
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('test-tokens');
    
    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });

  it('should handle sessionStorage errors gracefully', async () => {
    // Mock sessionStorage to throw errors
    (sessionStorage.setItem as jest.Mock).mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    await expect(storage.save(mockTokens)).rejects.toThrow('Storage quota exceeded');
  });

  it('should handle JSON parse errors', async () => {
    mockSessionStorage['test-tokens'] = 'invalid-json';

    const loadedTokens = await storage.load();
    expect(loadedTokens).toBeNull();
  });
});

describe('createDefaultTokenStorage', () => {
  let originalProcess: any;
  let originalWindow: any;
  let originalLocalStorage: any;
  let originalSessionStorage: any;

  beforeAll(() => {
    originalProcess = (global as any).process;
    originalWindow = (global as any).window;
    originalLocalStorage = (global as any).localStorage;
    originalSessionStorage = (global as any).sessionStorage;
  });

  afterAll(() => {
    // Restore original globals
    if (originalProcess !== undefined) {
      (global as any).process = originalProcess;
    } else {
      delete (global as any).process;
    }
    if (originalWindow !== undefined) {
      (global as any).window = originalWindow;
    } else {
      delete (global as any).window;
    }
    if (originalLocalStorage !== undefined) {
      (global as any).localStorage = originalLocalStorage;
    } else {
      delete (global as any).localStorage;
    }
    if (originalSessionStorage !== undefined) {
      (global as any).sessionStorage = originalSessionStorage;
    } else {
      delete (global as any).sessionStorage;
    }
  });

  const mockBrowserEnvironment = () => {
    delete (global as any).process;
    Object.defineProperty(global, 'window', {
      value: { document: {} },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
      configurable: true,
    });
  };

  const mockNodeEnvironment = () => {
    delete (global as any).window;
    delete (global as any).localStorage;
    delete (global as any).sessionStorage;
    Object.defineProperty(global, 'process', {
      value: {
        versions: { node: '18.0.0' },
        version: 'v18.0.0',
      },
      writable: true,
      configurable: true,
    });
  };

  it('should return LocalStorageTokenStorage in browser with localStorage', () => {
    mockBrowserEnvironment();
    
    // Reset modules to ensure fresh import with new environment
    jest.resetModules();
    const { createDefaultTokenStorage, LocalStorageTokenStorage } = require('../../src/auth/token-manager');
    
    const storage = createDefaultTokenStorage();
    expect(storage).toBeInstanceOf(LocalStorageTokenStorage);
  });

  it('should return SessionStorageTokenStorage in browser without localStorage', () => {
    mockBrowserEnvironment();
    delete (global as any).localStorage;
    
    jest.resetModules();
    const { createDefaultTokenStorage, SessionStorageTokenStorage } = require('../../src/auth/token-manager');
    
    const storage = createDefaultTokenStorage();
    expect(storage).toBeInstanceOf(SessionStorageTokenStorage);
  });

  it('should return MemoryTokenStorage in browser without any storage', () => {
    mockBrowserEnvironment();
    delete (global as any).localStorage;
    delete (global as any).sessionStorage;
    
    jest.resetModules();
    const { createDefaultTokenStorage, MemoryTokenStorage } = require('../../src/auth/token-manager');
    
    const storage = createDefaultTokenStorage();
    expect(storage).toBeInstanceOf(MemoryTokenStorage);
  });

  it('should return FileTokenStorage in Node.js environment', () => {
    mockNodeEnvironment();
    
    const storage = createDefaultTokenStorage();
    expect(storage).toBeInstanceOf(FileTokenStorage);
  });

  it('should return FileTokenStorage with custom path in Node.js', () => {
    mockNodeEnvironment();
    
    const storage = createDefaultTokenStorage({ filePath: '/custom/path/tokens.json' });
    expect(storage).toBeInstanceOf(FileTokenStorage);
  });

  it('should return MemoryTokenStorage in unsupported environment', () => {
    delete (global as any).window;
    delete (global as any).process;
    delete (global as any).localStorage;
    delete (global as any).sessionStorage;
    
    jest.resetModules();
    const { createDefaultTokenStorage, MemoryTokenStorage } = require('../../src/auth/token-manager');
    
    const storage = createDefaultTokenStorage();
    expect(storage).toBeInstanceOf(MemoryTokenStorage);
  });

  it('should handle localStorage access errors', () => {
    mockBrowserEnvironment();
    
    // Mock localStorage to throw on access
    Object.defineProperty(global, 'localStorage', {
      get: () => {
        throw new Error('Access denied');
      },
      configurable: true,
    });
    
    jest.resetModules();
    const { createDefaultTokenStorage, SessionStorageTokenStorage } = require('../../src/auth/token-manager');
    
    const storage = createDefaultTokenStorage();
    expect(storage).toBeInstanceOf(SessionStorageTokenStorage);
  });

  it('should handle sessionStorage access errors', () => {
    mockBrowserEnvironment();
    delete (global as any).localStorage;
    
    // Mock sessionStorage to throw on access
    Object.defineProperty(global, 'sessionStorage', {
      get: () => {
        throw new Error('Access denied');
      },
      configurable: true,
    });
    
    jest.resetModules();
    const { createDefaultTokenStorage, MemoryTokenStorage } = require('../../src/auth/token-manager');
    
    const storage = createDefaultTokenStorage();
    expect(storage).toBeInstanceOf(MemoryTokenStorage);
  });
});