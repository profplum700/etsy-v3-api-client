// Shared global type definitions for Vitest tests.

import type { Mock } from 'vitest';

declare global {
  // Mocked fetch injected in tests.
  var fetch: Mock<any>;
}

export {};
