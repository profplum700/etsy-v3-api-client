import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';
import preserveShebang from 'rollup-plugin-preserve-shebang';

export default [
  // CLI executable
  {
    input: 'src/cli.ts',
    output: {
      file: 'dist/cli.js',
      format: 'esm',
      sourcemap: true,
    },
    external: [
      'commander',
      'chalk',
      'ora',
      'inquirer',
      'table',
      '@profplum700/etsy-v3-api-client',
      'fs',
      'fs/promises',
      'os',
      'path',
    ],
    plugins: [
      preserveShebang(),
      resolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        outputToFilesystem: true,
      }),
    ],
  },
  // Library exports
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    external: [
      'commander',
      'chalk',
      'ora',
      'inquirer',
      'table',
      '@profplum700/etsy-v3-api-client',
      'fs',
      'fs/promises',
      'os',
      'path',
    ],
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        outputToFilesystem: true,
      }),
    ],
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external: [
      'commander',
      'chalk',
      'ora',
      'inquirer',
      'table',
      '@profplum700/etsy-v3-api-client',
      'fs',
      'fs/promises',
      'os',
      'path',
    ],
    plugins: [dts()],
  },
];
