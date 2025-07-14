// Setup file for Jest
// This file is executed before each test file

// Mock console.log and console.error for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock fetch if not available (for Node.js environments)
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Set up common test environment variables
process.env.NODE_ENV = 'test';