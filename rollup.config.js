import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import pkg from './package.json' with { type: 'json' };

const external = [
  ...Object.keys(pkg.peerDependencies || {}),
  'node:crypto',
  'node:buffer',
  'node:url',
  'crypto',
  'buffer',
  'url'
];

const plugins = [
  resolve({
    preferBuiltins: true,
    browser: false
  }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    declarationMap: false,
    compilerOptions: {
      skipLibCheck: true,
      target: 'ES2020',
      useDefineForClassFields: false
    }
  })
];

// Suppress expected warnings
const onwarn = (warning, warn) => {
  // Suppress node-fetch peer dependency warnings (expected)
  if (warning.code === 'UNRESOLVED_IMPORT' && warning.id?.includes('node-fetch')) {
    return;
  }
  // Suppress other expected warnings
  if (warning.code === 'MISSING_GLOBAL_NAME' && warning.name === 'crypto') {
    return;
  }
  // Show all other warnings
  warn(warning);
};

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: pkg.module,
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
    },
    external,
    plugins,
    onwarn
  },
  
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true
    },
    external,
    plugins,
    onwarn
  },
  
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: pkg.types,
      format: 'esm'
    },
    external,
    plugins: [dts()],
    onwarn
  }
];