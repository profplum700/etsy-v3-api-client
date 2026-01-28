/**
 * Tests for universal crypto utilities
 */
export {};

// Store original globals before any imports
const originalProcess = (global as any).process;
const originalWindow = (global as any).window;
const originalCrypto = (global as any).crypto;
const originalBtoa = (global as any).btoa;
const originalAtob = (global as any).atob;
const originalTextEncoder = (global as any).TextEncoder;

// Save real process for Vitest compatibility — Vitest's error handler needs process.listeners()
const _savedProcess = globalThis.process;
/** Creates a process stub without versions/version so isNode detection returns false */
function createNonNodeProcess() {
  return {
    listeners: _savedProcess.listeners.bind(_savedProcess),
    on: _savedProcess.on.bind(_savedProcess),
    off: _savedProcess.off.bind(_savedProcess),
    removeListener: _savedProcess.removeListener.bind(_savedProcess),
    emit: _savedProcess.emit.bind(_savedProcess),
    env: {},
  };
}

// Mock crypto module before importing main module
vi.mock('crypto', () => ({
  randomBytes: vi.fn((length: number) => Buffer.alloc(length, 42)),
  createHash: vi.fn(() => ({
    update: vi.fn(),
    digest: vi.fn(() => Buffer.alloc(32, 123))
  }))
}));

// Helper function to create browser environment
const createBrowserEnvironment = () => {
  Object.defineProperty(global, 'process', { value: createNonNodeProcess(), writable: true, configurable: true });
  
  Object.defineProperty(global, 'window', {
    value: { document: {} },
    writable: true,
    configurable: true
  });

  const mockWebCrypto = {
    getRandomValues: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    }),
    subtle: {
      digest: vi.fn(async (algorithm: string, data: Uint8Array) => {
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hash[i] = (data[0] || 0) + i;
        }
        return hash.buffer;
      })
    }
  };

  Object.defineProperty(global, 'crypto', {
    value: mockWebCrypto,
    writable: true,
    configurable: true
  });

  Object.defineProperty(global, 'btoa', {
    value: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    writable: true,
    configurable: true
  });

  Object.defineProperty(global, 'atob', {
    value: (str: string) => Buffer.from(str, 'base64').toString('binary'),
    writable: true,
    configurable: true
  });

  Object.defineProperty(global, 'TextEncoder', {
    value: class TextEncoder {
      encode(str: string) {
        return new Uint8Array(Buffer.from(str, 'utf8'));
      }
    },
    writable: true,
    configurable: true
  });

  return mockWebCrypto;
};

// Helper function to create Node.js environment
const createNodeEnvironment = () => {
  delete (global as any).window;
  delete (global as any).crypto;
  delete (global as any).btoa;
  delete (global as any).atob;

  Object.defineProperty(global, 'process', {
    value: {
      versions: { node: '18.0.0' },
      version: 'v18.0.0'
    },
    writable: true,
    configurable: true
  });

  Object.defineProperty(global, 'TextEncoder', {
    value: class TextEncoder {
      encode(str: string) {
        return new Uint8Array(Buffer.from(str, 'utf8'));
      }
    },
    writable: true,
    configurable: true
  });
};

// Helper function to create unsupported environment
const createUnsupportedEnvironment = () => {
  delete (global as any).window;
  Object.defineProperty(global, 'process', { value: createNonNodeProcess(), writable: true, configurable: true });
  delete (global as any).crypto;
  delete (global as any).btoa;
  delete (global as any).atob;
};

// Helper function to restore original environment
const restoreEnvironment = () => {
  // Restore globals
  if (originalProcess !== undefined) {
    (global as any).process = originalProcess;
  } else {
    Object.defineProperty(global, 'process', { value: createNonNodeProcess(), writable: true, configurable: true });
  }
  if (originalWindow !== undefined) {
    (global as any).window = originalWindow;
  } else {
    delete (global as any).window;
  }
  if (originalCrypto !== undefined) {
    (global as any).crypto = originalCrypto;
  } else {
    delete (global as any).crypto;
  }
  if (originalBtoa !== undefined) {
    (global as any).btoa = originalBtoa;
  } else {
    delete (global as any).btoa;
  }
  if (originalAtob !== undefined) {
    (global as any).atob = originalAtob;
  } else {
    delete (global as any).atob;
  }
  if (originalTextEncoder !== undefined) {
    (global as any).TextEncoder = originalTextEncoder;
  } else {
    delete (global as any).TextEncoder;
  }
};

describe('Universal Crypto Module', () => {
  afterEach(() => {
    // Clear module cache and reset mocks
    vi.resetModules();
    vi.clearAllMocks();
    restoreEnvironment();
  });

  describe('Browser Environment', () => {
    let mockWebCrypto: ReturnType<typeof createBrowserEnvironment>;
    let cryptoModule: any;

    beforeEach(async () => {
      mockWebCrypto = createBrowserEnvironment();
      // Import fresh module after environment setup
      cryptoModule = await import('../../src/utils/crypto');
    });

    describe('generateRandomBytes', () => {
      it('should generate random bytes using Web Crypto API', async () => {
        const bytes = await cryptoModule.generateRandomBytes(16);
        
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBe(16);
        expect(mockWebCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      });

      it('should generate different lengths correctly', async () => {
        const bytes32 = await cryptoModule.generateRandomBytes(32);
        const bytes64 = await cryptoModule.generateRandomBytes(64);
        
        expect(bytes32.length).toBe(32);
        expect(bytes64.length).toBe(64);
      });
    });

    describe('sha256', () => {
      it('should hash string data using Web Crypto API', async () => {
        const hash = await cryptoModule.sha256('test data');
        
        expect(hash).toBeInstanceOf(Uint8Array);
        expect(hash.length).toBe(32);
        expect(mockWebCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
      });

      it('should hash Uint8Array data using Web Crypto API', async () => {
        const data = new Uint8Array([1, 2, 3, 4]);
        const hash = await cryptoModule.sha256(data);
        
        expect(hash).toBeInstanceOf(Uint8Array);
        expect(hash.length).toBe(32);
        expect(mockWebCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', data);
      });
    });

    describe('base64UrlEncode', () => {
      it('should encode bytes to base64url using btoa', () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        const encoded = cryptoModule.base64UrlEncode(bytes);
        
        expect(typeof encoded).toBe('string');
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');
      });
    });

    describe('base64UrlDecode', () => {
      it('should decode base64url string using atob', () => {
        const encoded = 'AQIDBA';
        const decoded = cryptoModule.base64UrlDecode(encoded);
        
        expect(decoded).toBeInstanceOf(Uint8Array);
        expect(Array.from(decoded)).toEqual([1, 2, 3, 4]);
      });

      it('should handle padding correctly', () => {
        const encoded = 'AQ'; // Needs padding
        const decoded = cryptoModule.base64UrlDecode(encoded);
        
        expect(decoded).toBeInstanceOf(Uint8Array);
        expect(decoded[0]).toBe(1);
      });
    });
  });

  describe('Node.js Environment', () => {
    let cryptoModule: any;

    beforeEach(async () => {
      createNodeEnvironment();
      // Clear and reset mocks
      vi.resetModules();
      vi.clearAllMocks();
      // Ensure crypto mock is reset to default
      vi.unmock('crypto');
      // Import fresh module after environment setup
      cryptoModule = await import('../../src/utils/crypto');
    });

    describe('generateRandomBytes', () => {
      it('should generate random bytes using Node.js crypto', async () => {
        // Re-mock crypto for this test
        vi.doMock('crypto', () => ({
          randomBytes: vi.fn((length: number) => Buffer.alloc(length, 42)),
          createHash: vi.fn(() => ({
            update: vi.fn(),
            digest: vi.fn(() => Buffer.alloc(32, 123))
          }))
        }));
        
        vi.resetModules();
        createNodeEnvironment();
        const freshCryptoModule = await import('../../src/utils/crypto');
        const mockCrypto = await import('crypto');

        const bytes = await freshCryptoModule.generateRandomBytes(16);

        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBe(16);
        expect(Array.from(bytes)).toEqual(new Array(16).fill(42));
        expect(mockCrypto.randomBytes).toHaveBeenCalledWith(16);
      });

      it('should throw error when Node.js crypto is unavailable', async () => {
        // Create a clean test environment for this error case
        vi.resetModules();
        vi.doMock('crypto', () => {
          throw new Error('Module not found');
        });
        
        createNodeEnvironment();
        const failingCryptoModule = await import('../../src/utils/crypto');

        await expect(failingCryptoModule.generateRandomBytes(16)).rejects.toThrow('Node.js crypto module not available');

        // Clean up after this test
        vi.resetModules();
        vi.clearAllMocks();
        vi.unmock('crypto');
      });
    });

    describe('sha256', () => {
      it('should hash data using Node.js crypto', async () => {
        // Re-mock crypto for this test
        const mockHash = {
          update: vi.fn(),
          digest: vi.fn(() => Buffer.alloc(32, 123))
        };
        
        vi.doMock('crypto', () => ({
          randomBytes: vi.fn((length: number) => Buffer.alloc(length, 42)),
          createHash: vi.fn(() => mockHash)
        }));
        
        vi.resetModules();
        createNodeEnvironment();
        const freshCryptoModule = await import('../../src/utils/crypto');
        const mockCrypto = await import('crypto');

        const hash = await freshCryptoModule.sha256('test data');
        
        expect(hash).toBeInstanceOf(Uint8Array);
        expect(hash.length).toBe(32);
        expect(Array.from(hash)).toEqual(new Array(32).fill(123));
        expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
        expect(mockHash.update).toHaveBeenCalled();
        expect(mockHash.digest).toHaveBeenCalled();
      });

      it('should throw error when Node.js crypto is unavailable', async () => {
        // Create a clean test environment for this error case
        vi.resetModules();
        vi.doMock('crypto', () => {
          throw new Error('Module not found');
        });
        
        createNodeEnvironment();
        const failingCryptoModule = await import('../../src/utils/crypto');

        await expect(failingCryptoModule.sha256('test')).rejects.toThrow('Node.js crypto module not available');

        // Clean up after this test
        vi.resetModules();
        vi.clearAllMocks();
        vi.unmock('crypto');
      });
    });

    describe('base64UrlEncode', () => {
      it('should encode bytes to base64url using Buffer', () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        const encoded = cryptoModule.base64UrlEncode(bytes);
        
        expect(typeof encoded).toBe('string');
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');
      });
    });

    describe('base64UrlDecode', () => {
      it('should decode base64url string using Buffer', () => {
        const encoded = 'AQIDBA';
        const decoded = cryptoModule.base64UrlDecode(encoded);
        
        expect(decoded).toBeInstanceOf(Uint8Array);
        expect(Array.from(decoded)).toEqual([1, 2, 3, 4]);
      });
    });
  });

  describe('Unsupported Environment', () => {
    let cryptoModule: any;

    beforeEach(async () => {
      createUnsupportedEnvironment();
      vi.resetModules();
      vi.clearAllMocks();
      cryptoModule = await import('../../src/utils/crypto');
    });

    it('should throw error for generateRandomBytes', async () => {
      await expect(cryptoModule.generateRandomBytes(16)).rejects.toThrow('Crypto functions are not available in this environment');
    });

    it('should throw error for sha256', async () => {
      await expect(cryptoModule.sha256('test')).rejects.toThrow('SHA256 is not available in this environment');
    });

    it('should throw error for base64UrlEncode', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      expect(() => cryptoModule.base64UrlEncode(bytes)).toThrow('Base64URL encoding is not available in this environment');
    });

    it('should throw error for base64UrlDecode', () => {
      expect(() => cryptoModule.base64UrlDecode('AQID')).toThrow('Base64URL decoding is not available in this environment');
    });
  });

  describe('High-level Functions', () => {
    let cryptoModule: any;

    beforeEach(async () => {
      createBrowserEnvironment();
      vi.resetModules();
      vi.clearAllMocks();
      cryptoModule = await import('../../src/utils/crypto');
    });

    describe('generateRandomBase64Url', () => {
      it('should generate base64url encoded random string', async () => {
        const result = await cryptoModule.generateRandomBase64Url(16);
        
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toContain('+');
        expect(result).not.toContain('/');
        expect(result).not.toContain('=');
      });
    });

    describe('sha256Base64Url', () => {
      it('should create base64url encoded SHA256 hash', async () => {
        const result = await cryptoModule.sha256Base64Url('test data');
        
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toContain('+');
        expect(result).not.toContain('/');
        expect(result).not.toContain('=');
      });
    });

    describe('generateCodeVerifier', () => {
      it('should generate PKCE code verifier', async () => {
        const verifier = await cryptoModule.generateCodeVerifier();
        
        expect(typeof verifier).toBe('string');
        expect(verifier.length).toBeGreaterThanOrEqual(43); // 32 bytes = 43 base64url chars
        expect(verifier.length).toBeLessThanOrEqual(128);
        expect(verifier).not.toContain('+');
        expect(verifier).not.toContain('/');
        expect(verifier).not.toContain('=');
      });
    });

    describe('generateState', () => {
      it('should generate OAuth state parameter', async () => {
        const state = await cryptoModule.generateState();
        
        expect(typeof state).toBe('string');
        expect(state.length).toBeGreaterThan(0);
        expect(state).not.toContain('+');
        expect(state).not.toContain('/');
        expect(state).not.toContain('=');
      });
    });

    describe('createCodeChallenge', () => {
      it('should create PKCE code challenge from verifier', async () => {
        const verifier = 'test-code-verifier';
        const challenge = await cryptoModule.createCodeChallenge(verifier);
        
        expect(typeof challenge).toBe('string');
        expect(challenge.length).toBeGreaterThan(0);
        expect(challenge).not.toContain('+');
        expect(challenge).not.toContain('/');
        expect(challenge).not.toContain('=');
      });
    });
  });

  describe('Cross-platform Compatibility', () => {
    it('should produce consistent base64url encoding across environments', async () => {
      const testBytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

      // Test in browser environment
      createBrowserEnvironment();
      vi.resetModules();
      const browserCrypto = await import('../../src/utils/crypto');
      const browserResult = browserCrypto.base64UrlEncode(testBytes);

      // Test in Node.js environment
      createNodeEnvironment();
      vi.resetModules();
      const nodeCrypto = await import('../../src/utils/crypto');
      const nodeResult = nodeCrypto.base64UrlEncode(testBytes);

      expect(browserResult).toBe(nodeResult);
    });

    it('should produce consistent base64url decoding across environments', async () => {
      const testString = 'SGVsbG8'; // "Hello" in base64url

      // Test in browser environment
      createBrowserEnvironment();
      vi.resetModules();
      const browserCrypto = await import('../../src/utils/crypto');
      const browserResult = browserCrypto.base64UrlDecode(testString);

      // Test in Node.js environment
      createNodeEnvironment();
      vi.resetModules();
      const nodeCrypto = await import('../../src/utils/crypto');
      const nodeResult = nodeCrypto.base64UrlDecode(testString);

      expect(Array.from(browserResult)).toEqual(Array.from(nodeResult));
    });
  });
});

// Final cleanup
afterAll(() => {
  restoreEnvironment();
});
