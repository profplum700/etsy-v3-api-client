import { defineWorkspace } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'root',
    },
  },
  {
    test: {
      name: 'etsy-react',
      root: './packages/etsy-react',
      globals: true,
      environment: 'jsdom',
      include: ['__tests__/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
    },
  },
  {
    test: {
      name: 'etsy-admin-ui',
      root: './packages/etsy-admin-ui',
      globals: true,
      environment: 'jsdom',
      include: ['__tests__/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
      setupFiles: ['./vitest.setup.ts'],
    },
  },
  {
    test: {
      name: 'etsy-nextjs',
      root: './packages/etsy-nextjs',
      globals: true,
      environment: 'node',
      include: ['__tests__/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
    },
  },
  {
    resolve: {
      alias: {
        chalk: path.resolve(__dirname, 'packages/etsy-cli/__mocks__/chalk.js'),
        table: path.resolve(__dirname, 'packages/etsy-cli/__mocks__/table.js'),
      },
    },
    test: {
      name: 'etsy-cli',
      root: './packages/etsy-cli',
      globals: true,
      environment: 'node',
      include: ['__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    },
  },
]);
