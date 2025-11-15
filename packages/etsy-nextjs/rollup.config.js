import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

// Common external dependencies
const commonExternal = [
  'react',
  'react-dom',
  'next',
  'next/server',
  'next/headers',
  '@profplum700/etsy-v3-api-client'
];

// Common plugins configuration
const createPlugins = () => [
  resolve(),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.build.json',
    outputToFilesystem: false,
  }),
];

// Helper function to create build configs
const createBuildConfig = (input, outputName) => ({
  input,
  output: [
    {
      file: `dist/${outputName}.esm.js`,
      format: 'esm',
      sourcemap: true,
    },
    {
      file: `dist/${outputName}.cjs`,
      format: 'cjs',
      sourcemap: true,
    },
  ],
  external: commonExternal,
  plugins: createPlugins(),
});

// Helper function to create type definition configs
const createDtsConfig = (input, outputName) => ({
  input,
  output: {
    file: `dist/${outputName}.d.ts`,
    format: 'esm',
  },
  external: commonExternal,
  plugins: [dts()],
});

export default [
  // Main entry point (backward compatible)
  createBuildConfig('src/index.ts', 'index'),
  createDtsConfig('src/index.ts', 'index'),

  // Client-only entry point
  createBuildConfig('src/client.ts', 'client'),
  createDtsConfig('src/client.ts', 'client'),

  // Server-only entry point
  createBuildConfig('src/server.ts', 'server'),
  createDtsConfig('src/server.ts', 'server'),
];
