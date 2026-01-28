import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts', 'src/index.ts'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
