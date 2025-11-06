// Shared global type definitions for Jest tests.

 
import 'jest';

declare global {
  // Mocked fetch injected in tests.
  // Using jest.Mock ensures proper typing without resorting to `any`.
  // The generic <Return, Args> is left as unknown for flexibility.
  var fetch: jest.Mock<any, any>;
}

export {};
