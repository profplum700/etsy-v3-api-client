/**
 * Tests for environment detection utilities
 */

import {
  isBrowser,
  isNode,
  isWebWorker,
  hasFetch,
  hasWebCrypto,
  hasLocalStorage,
  hasSessionStorage,
  getEnvironmentInfo,
  assertCryptoSupport,
  assertFetchSupport,
  getAvailableStorage,
} from '../../src/utils/environment';

describe('Environment Detection', () => {
  let originalProcess: any;
  let originalWindow: any;
  let originalNavigator: any;
  let originalCrypto: any;
  let originalFetch: any;
  let originalLocalStorage: any;
  let originalSessionStorage: any;
  let originalImportScripts: any;

  beforeAll(() => {
    // Save original globals
    originalProcess = (global as any).process;
    originalWindow = (global as any).window;
    originalNavigator = (global as any).navigator;
    originalCrypto = (global as any).crypto;
    originalFetch = (global as any).fetch;
    originalLocalStorage = (global as any).localStorage;
    originalSessionStorage = (global as any).sessionStorage;
    originalImportScripts = (globalThis as any).importScripts;
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
    if (originalNavigator !== undefined) {
      (global as any).navigator = originalNavigator;
    } else {
      delete (global as any).navigator;
    }
    if (originalCrypto !== undefined) {
      (global as any).crypto = originalCrypto;
    } else {
      delete (global as any).crypto;
    }
    if (originalFetch !== undefined) {
      (global as any).fetch = originalFetch;
    } else {
      delete (global as any).fetch;
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
    if (originalImportScripts !== undefined) {
      (globalThis as any).importScripts = originalImportScripts;
    } else {
      delete (globalThis as any).importScripts;
    }
  });

  const mockBrowserEnvironment = () => {
    delete (global as any).process;
    Object.defineProperty(global, 'window', {
      value: { document: {} },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Test Browser)' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'crypto', {
      value: { subtle: {} },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'fetch', {
      value: jest.fn(),
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
    delete (global as any).navigator;
    delete (global as any).crypto;
    delete (global as any).fetch;
    delete (global as any).localStorage;
    delete (global as any).sessionStorage;
    delete (globalThis as any).importScripts;
    
    Object.defineProperty(global, 'process', {
      value: {
        versions: { node: '18.0.0' },
        version: 'v18.0.0',
      },
      writable: true,
      configurable: true,
    });
  };

  const mockWebWorkerEnvironment = () => {
    delete (global as any).window;
    delete (global as any).process;
    
    Object.defineProperty(globalThis, 'importScripts', {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Web Worker)' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'crypto', {
      value: { subtle: {} },
      writable: true,
      configurable: true,
    });
  };

  const mockUnsupportedEnvironment = () => {
    delete (global as any).window;
    delete (global as any).process;
    delete (global as any).navigator;
    delete (global as any).crypto;
    delete (global as any).fetch;
    delete (global as any).localStorage;
    delete (global as any).sessionStorage;
    delete (globalThis as any).importScripts;
  };

  describe('Browser Environment Detection', () => {
    beforeEach(() => {
      mockBrowserEnvironment();
      // Force re-evaluation by requiring fresh module
      jest.resetModules();
    });

    it('should detect browser environment correctly', () => {
      const env = require('../../src/utils/environment');
      expect(env.isBrowser).toBe(true);
      expect(env.isNode).toBe(false);
      expect(env.isWebWorker).toBe(false);
    });

    it('should detect browser features correctly', () => {
      const env = require('../../src/utils/environment');
      expect(env.hasFetch).toBe(true);
      expect(env.hasWebCrypto).toBe(true);
      expect(env.hasLocalStorage).toBe(true);
      expect(env.hasSessionStorage).toBe(true);
    });

    it('should return correct environment info', () => {
      const env = require('../../src/utils/environment');
      const info = env.getEnvironmentInfo();
      
      expect(info).toEqual({
        isBrowser: true,
        isNode: false,
        isWebWorker: false,
        hasFetch: true,
        hasWebCrypto: true,
        hasLocalStorage: true,
        hasSessionStorage: true,
        userAgent: 'Mozilla/5.0 (Test Browser)',
        nodeVersion: undefined,
      });
    });

    it('should return localStorage as available storage', () => {
      const env = require('../../src/utils/environment');
      expect(env.getAvailableStorage()).toBe('localStorage');
    });
  });

  describe('Node.js Environment Detection', () => {
    beforeEach(() => {
      mockNodeEnvironment();
      jest.resetModules();
    });

    it('should detect Node.js environment correctly', () => {
      const env = require('../../src/utils/environment');
      expect(env.isBrowser).toBe(false);
      expect(env.isNode).toBe(true);
      expect(env.isWebWorker).toBe(false);
    });

    it('should detect missing browser features', () => {
      const env = require('../../src/utils/environment');
      expect(env.hasFetch).toBe(false);
      expect(env.hasWebCrypto).toBe(false);
      expect(env.hasLocalStorage).toBe(false);
      expect(env.hasSessionStorage).toBe(false);
    });

    it('should return correct environment info', () => {
      const env = require('../../src/utils/environment');
      const info = env.getEnvironmentInfo();
      
      expect(info).toEqual({
        isBrowser: false,
        isNode: true,
        isWebWorker: false,
        hasFetch: false,
        hasWebCrypto: false,
        hasLocalStorage: false,
        hasSessionStorage: false,
        userAgent: 'Node.js',
        nodeVersion: 'v18.0.0',
      });
    });

    it('should return file as available storage', () => {
      const env = require('../../src/utils/environment');
      expect(env.getAvailableStorage()).toBe('file');
    });
  });

  describe('Web Worker Environment Detection', () => {
    beforeEach(() => {
      mockWebWorkerEnvironment();
      jest.resetModules();
    });

    it('should detect Web Worker environment correctly', () => {
      const env = require('../../src/utils/environment');
      expect(env.isBrowser).toBe(false);
      expect(env.isNode).toBe(false);
      expect(env.isWebWorker).toBe(true);
    });

    it('should detect available features in Web Worker', () => {
      const env = require('../../src/utils/environment');
      expect(env.hasWebCrypto).toBe(true);
      expect(env.hasLocalStorage).toBe(false);
      expect(env.hasSessionStorage).toBe(false);
    });

    it('should return memory as available storage', () => {
      const env = require('../../src/utils/environment');
      expect(env.getAvailableStorage()).toBe('memory');
    });
  });

  describe('Unsupported Environment', () => {
    beforeEach(() => {
      mockUnsupportedEnvironment();
      jest.resetModules();
    });

    it('should detect no supported environment', () => {
      const env = require('../../src/utils/environment');
      expect(env.isBrowser).toBe(false);
      expect(env.isNode).toBe(false);
      expect(env.isWebWorker).toBe(false);
    });

    it('should detect no available features', () => {
      const env = require('../../src/utils/environment');
      expect(env.hasFetch).toBe(false);
      expect(env.hasWebCrypto).toBe(false);
      expect(env.hasLocalStorage).toBe(false);
      expect(env.hasSessionStorage).toBe(false);
    });

    it('should return memory as fallback storage', () => {
      const env = require('../../src/utils/environment');
      expect(env.getAvailableStorage()).toBe('memory');
    });
  });

  describe('Storage Detection Edge Cases', () => {
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
      const env = require('../../src/utils/environment');
      expect(env.hasLocalStorage).toBe(false);
    });

    it('should handle sessionStorage access errors', () => {
      mockBrowserEnvironment();
      
      // Mock sessionStorage to throw on access
      Object.defineProperty(global, 'sessionStorage', {
        get: () => {
          throw new Error('Access denied');
        },
        configurable: true,
      });
      
      jest.resetModules();
      const env = require('../../src/utils/environment');
      expect(env.hasSessionStorage).toBe(false);
    });

    it('should fallback to sessionStorage when localStorage unavailable', () => {
      mockBrowserEnvironment();
      delete (global as any).localStorage;
      
      jest.resetModules();
      const env = require('../../src/utils/environment');
      expect(env.getAvailableStorage()).toBe('sessionStorage');
    });

    it('should fallback to memory when no storage available', () => {
      mockBrowserEnvironment();
      delete (global as any).localStorage;
      delete (global as any).sessionStorage;
      
      jest.resetModules();
      const env = require('../../src/utils/environment');
      expect(env.getAvailableStorage()).toBe('memory');
    });
  });

  describe('Assertion Functions', () => {
    describe('assertCryptoSupport', () => {
      it('should not throw in browser with WebCrypto', () => {
        mockBrowserEnvironment();
        jest.resetModules();
        const env = require('../../src/utils/environment');
        
        expect(() => env.assertCryptoSupport()).not.toThrow();
      });

      it('should not throw in Node.js environment', () => {
        mockNodeEnvironment();
        jest.resetModules();
        const env = require('../../src/utils/environment');
        
        expect(() => env.assertCryptoSupport()).not.toThrow();
      });

      it('should throw in unsupported environment', () => {
        mockUnsupportedEnvironment();
        jest.resetModules();
        const env = require('../../src/utils/environment');
        
        expect(() => env.assertCryptoSupport()).toThrow(
          'Crypto operations require Web Crypto API in browsers or Node.js crypto module'
        );
      });

      it('should throw in browser without WebCrypto', () => {
        mockBrowserEnvironment();
        delete (global as any).crypto;
        jest.resetModules();
        const env = require('../../src/utils/environment');
        
        expect(() => env.assertCryptoSupport()).toThrow(
          'Crypto operations require Web Crypto API in browsers or Node.js crypto module'
        );
      });
    });

    describe('assertFetchSupport', () => {
      it('should not throw when fetch is available', () => {
        mockBrowserEnvironment();
        jest.resetModules();
        const env = require('../../src/utils/environment');
        
        expect(() => env.assertFetchSupport()).not.toThrow();
      });

      it('should throw when fetch is not available', () => {
        mockNodeEnvironment();
        jest.resetModules();
        const env = require('../../src/utils/environment');
        
        expect(() => env.assertFetchSupport()).toThrow(
          'Fetch API is not available. Please use Node.js 18+ or a modern browser.'
        );
      });
    });
  });

  describe('Feature Detection Robustness', () => {
    it('should handle partial crypto object', () => {
      mockBrowserEnvironment();
      Object.defineProperty(global, 'crypto', {
        value: {}, // crypto exists but no subtle
        writable: true,
        configurable: true,
      });
      
      jest.resetModules();
      const env = require('../../src/utils/environment');
      expect(env.hasWebCrypto).toBe(false);
    });

    it('should handle Node.js without versions', () => {
      Object.defineProperty(global, 'process', {
        value: {}, // process exists but no versions
        writable: true,
        configurable: true,
      });
      delete (global as any).window;
      
      jest.resetModules();
      const env = require('../../src/utils/environment');
      expect(env.isNode).toBe(false);
    });

    it('should handle browser without document', () => {
      Object.defineProperty(global, 'window', {
        value: {}, // window exists but no document
        writable: true,
        configurable: true,
      });
      delete (global as any).process;
      
      jest.resetModules();
      const env = require('../../src/utils/environment');
      expect(env.isBrowser).toBe(false);
    });
  });
});
