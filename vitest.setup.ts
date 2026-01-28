import { vi, afterEach } from 'vitest';

// Save the real process so tests that override it don't break Vitest internals
const _realProcess = globalThis.process;

afterEach(() => {
  // Always restore the real process after each test
  if (globalThis.process !== _realProcess) {
    Object.defineProperty(globalThis, 'process', {
      value: _realProcess,
      writable: true,
      configurable: true,
    });
  }
});

// Mock console.log and console.error for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// Mock fetch if not available (for Node.js environments)
if (!global.fetch) {
  global.fetch = vi.fn() as any;
}

// Set up common test environment variables
process.env.NODE_ENV = 'test';
