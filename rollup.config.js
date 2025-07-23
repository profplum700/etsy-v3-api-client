import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import dts from 'rollup-plugin-dts';
import pkg from './package.json' with { type: 'json' };

// External dependencies for Node.js builds
const nodeExternal = [
  ...Object.keys(pkg.peerDependencies || {}),
  // Node.js built-ins for Node.js builds only
  'fs',
  'crypto',
  'buffer',
  'url'
];

// No externals for browser builds - we bundle everything except Node.js built-ins
const browserExternal = [];

// Node.js build plugins
const nodePlugins = [
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

// Browser build plugins
const browserPlugins = [
  replace({
    preventAssignment: true,
    values: {
      // Replace Node.js environment checks with false for browser builds
      'typeof process !== \'undefined\'': 'false',
      'process.versions?.node': 'undefined',
      // Replace isNode checks
      '!!process.versions?.node': 'false'
    },
    delimiters: ['', '']
  }),
  replace({
    preventAssignment: true,
    values: {
      // Replace fs import patterns in helper methods
      'const fs = await import(\'fs\');': 'const fs = { promises: { writeFile: () => {}, readFile: () => {}, unlink: () => {} } };',
      'await fs.promises.writeFile(filePath, data, \'utf8\');': '/* writeFile not available in browser */',
      'return await fs.promises.readFile(filePath, \'utf8\');': 'throw new Error(\'readFile not available in browser\');',
      'await fs.promises.unlink(filePath);': '/* unlink not available in browser */'
    },
    delimiters: ['', '']
  }),
  resolve({
    preferBuiltins: false,
    browser: true,
    // Ignore Node.js built-ins that can't be resolved
    skip: ['fs', 'crypto', 'buffer', 'util']
  }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    declarationMap: false,
    compilerOptions: {
      skipLibCheck: true,
      target: 'ES2020',
      useDefineForClassFields: false,
      lib: ['ES2022', 'DOM']
    }
  })
];

// Suppress expected warnings
const onwarn = (warning, warn) => {
  // Suppress node-fetch peer dependency warnings (expected)
  if (warning.code === 'UNRESOLVED_IMPORT' && warning.id?.includes('node-fetch')) {
    return;
  }
  // Suppress Node.js built-in warnings for browser builds
  if (warning.code === 'UNRESOLVED_IMPORT' && ['fs', 'crypto', 'buffer', 'util'].includes(warning.source)) {
    return;
  }
  // Suppress other expected warnings
  if (warning.code === 'MISSING_GLOBAL_NAME' && ['crypto', 'fs'].includes(warning.name)) {
    return;
  }
  // Show all other warnings
  warn(warning);
};

export default [
  // Node.js ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/node.esm.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
    },
    external: nodeExternal,
    plugins: nodePlugins,
    onwarn
  },
  
  // Node.js CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/node.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true
    },
    external: nodeExternal,
    plugins: nodePlugins,
    onwarn
  },
  
  // Browser ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/browser.esm.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
    },
    external: browserExternal,
    plugins: browserPlugins,
    onwarn
  },
  
  // Browser UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/browser.umd.js',
      format: 'umd',
      name: 'EtsyApiClient',
      sourcemap: true,
      inlineDynamicImports: true,
      exports: 'named'
    },
    external: browserExternal,
    plugins: [...browserPlugins, terser()],
    onwarn
  },
  
  // Default ESM build (Node.js compatible)
  {
    input: 'src/index.ts',
    output: {
      file: pkg.module,
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
    },
    external: nodeExternal,
    plugins: nodePlugins,
    onwarn
  },
  
  // Default CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true
    },
    external: nodeExternal,
    plugins: nodePlugins,
    onwarn
  },
  
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: pkg.types,
      format: 'esm'
    },
    external: nodeExternal,
    plugins: [dts()],
    onwarn
  }
];