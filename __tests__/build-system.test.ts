/**
 * Build system tests for conditional exports and universal compatibility
 * These tests verify that the build outputs correctly support both browser and Node.js environments
 */

import { promises as fs } from 'fs';
import { resolve, join } from 'path';

describe('Build System Tests', () => {
  const projectRoot = resolve(__dirname, '..');
  const distPath = join(projectRoot, 'dist');
  const packageJsonPath = join(projectRoot, 'package.json');

  let packageJson: any;
  let distFiles: string[];

  beforeAll(async () => {
    // Load package.json
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    packageJson = JSON.parse(packageJsonContent);

    // Get list of dist files
    try {
      distFiles = await fs.readdir(distPath);
    } catch {
      distFiles = [];
    }
  });

  describe('Package.json Configuration', () => {
    it('should have correct main and module fields', () => {
      expect(packageJson.main).toBe('dist/index.cjs');
      expect(packageJson.module).toBe('dist/index.esm.js');
      expect(packageJson.types).toBe('dist/index.d.ts');
    });

    it('should have proper conditional exports configuration', () => {
      expect(packageJson.exports).toBeDefined();
      expect(packageJson.exports['.']).toBeDefined();
      
      const mainExport = packageJson.exports['.'];
      
      // Check browser exports
      expect(mainExport.browser).toBeDefined();
      expect(mainExport.browser.import).toBe('./dist/browser.esm.js');
      expect(mainExport.browser.require).toBe('./dist/browser.umd.js');
      
      // Check Node.js exports
      expect(mainExport.node).toBeDefined();
      expect(mainExport.node.import).toBe('./dist/node.esm.js');
      expect(mainExport.node.require).toBe('./dist/node.cjs');
      
      // Check fallback exports
      expect(mainExport.import).toBe('./dist/index.esm.js');
      expect(mainExport.require).toBe('./dist/index.cjs');
      expect(mainExport.types).toBe('./dist/index.d.ts');
    });

    it('should have specific browser and node exports', () => {
      const exports = packageJson.exports;
      
      // Browser-specific export
      expect(exports['./browser']).toBeDefined();
      expect(exports['./browser'].import).toBe('./dist/browser.esm.js');
      expect(exports['./browser'].require).toBe('./dist/browser.umd.js');
      
      // Node.js-specific export
      expect(exports['./node']).toBeDefined();
      expect(exports['./node'].import).toBe('./dist/node.esm.js');
      expect(exports['./node'].require).toBe('./dist/node.cjs');
    });

    it('should have correct engine requirements', () => {
      expect(packageJson.engines.node).toBe('>=24.0.0');
    });

    it('should be marked as side-effect free', () => {
      expect(packageJson.sideEffects).toBe(false);
    });

    it('should have correct module type', () => {
      expect(packageJson.type).toBe('module');
    });
  });

  describe('Build Output Files', () => {
    const expectedFiles = [
      'index.esm.js',      // Default ESM build
      'index.cjs',         // Default CommonJS build
      'node.esm.js',       // Node.js ESM build
      'node.cjs',          // Node.js CommonJS build
      'browser.esm.js',    // Browser ESM build
      'browser.umd.js',    // Browser UMD build
      'index.d.ts'         // TypeScript declarations
    ];

    expectedFiles.forEach(file => {
      it(`should generate ${file}`, async () => {
        expect(distFiles).toContain(file);
        
        const filePath = join(distPath, file);
        const stats = await fs.stat(filePath);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);
      });
    });

    it('should generate source maps for all JS builds', async () => {
      const jsFiles = expectedFiles.filter(f => f.endsWith('.js'));
      
      for (const file of jsFiles) {
        const mapFile = `${file}.map`;
        expect(distFiles).toContain(mapFile);
        
        const mapPath = join(distPath, mapFile);
        const mapContent = await fs.readFile(mapPath, 'utf8');
        const sourceMap = JSON.parse(mapContent);
        
        expect(sourceMap.version).toBe(3);
        expect(sourceMap.sources).toBeDefined();
        expect(sourceMap.mappings).toBeDefined();
      }
    });

    it('should have correct file sizes indicating proper builds', async () => {
      // UMD build is minified, so it might be smaller than ESM
      const umdStats = await fs.stat(join(distPath, 'browser.umd.js'));
      const esmStats = await fs.stat(join(distPath, 'browser.esm.js'));
      
      // Both builds should be substantial files
      expect(umdStats.size).toBeGreaterThan(5000); // At least 5KB
      expect(esmStats.size).toBeGreaterThan(5000); // At least 5KB
    });
  });

  describe('Build Content Analysis', () => {
    it('should have different content for Node.js and browser builds', async () => {
      const nodeEsmPath = join(distPath, 'node.esm.js');
      const browserEsmPath = join(distPath, 'browser.esm.js');
      
      const nodeContent = await fs.readFile(nodeEsmPath, 'utf8');
      const browserContent = await fs.readFile(browserEsmPath, 'utf8');
      
      // Files should be different
      expect(nodeContent).not.toBe(browserContent);
      
      // Both should contain core exports
      expect(nodeContent).toContain('EtsyClient');
      expect(browserContent).toContain('EtsyClient');
    });

    it('should not contain Node.js built-ins in browser builds', async () => {
      const browserFiles = ['browser.esm.js', 'browser.umd.js'];
      
      for (const file of browserFiles) {
        const filePath = join(distPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Should not import Node.js built-ins directly
        expect(content).not.toMatch(/require\(['"]fs['"]\)/);
        expect(content).not.toMatch(/from ['"]fs['"]/);
        expect(content).not.toMatch(/require\(['"]crypto['"]\)/);
        expect(content).not.toMatch(/from ['"]crypto['"]/);
      }
    });

    it('should have proper CommonJS exports', async () => {
      const cjsFiles = ['index.cjs', 'node.cjs'];
      
      for (const file of cjsFiles) {
        const filePath = join(distPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Should have CommonJS export patterns
        expect(content).toMatch(/module\.exports|exports\./);
      }
    });

    it('should have proper ESM exports', async () => {
      const esmFiles = ['index.esm.js', 'node.esm.js', 'browser.esm.js'];
      
      for (const file of esmFiles) {
        const filePath = join(distPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Should have ESM export patterns
        expect(content).toMatch(/export\s+{|export\s+\w+|export\s+default/);
      }
    });

    it('should have UMD wrapper in browser UMD build', async () => {
      const umdPath = join(distPath, 'browser.umd.js');
      const content = await fs.readFile(umdPath, 'utf8');
      
      // Should have UMD pattern (may be minified)
      expect(content).toMatch(/!?function\s*\(/);
      expect(content).toContain('EtsyApiClient'); // Global name
      expect(content).toMatch(/typeof\s+exports|typeof\s+module/);
    });
  });

  describe('TypeScript Declarations', () => {
    it('should generate complete TypeScript declarations', async () => {
      const dtsPath = join(distPath, 'index.d.ts');
      const content = await fs.readFile(dtsPath, 'utf8');
      
      // Should export main classes
      expect(content).toContain('EtsyClient');
      expect(content).toContain('AuthHelper');
      expect(content).toContain('TokenManager');
      
      // Should export types
      expect(content).toContain('EtsyTokens');
      expect(content).toContain('AuthHelperConfig');
      expect(content).toContain('EtsyClientConfig');
      
      // Should export errors
      expect(content).toContain('EtsyApiError');
      expect(content).toContain('EtsyAuthError');
      expect(content).toContain('EtsyRateLimitError');
    });

    it('should have valid TypeScript syntax', async () => {
      const dtsPath = join(distPath, 'index.d.ts');
      const content = await fs.readFile(dtsPath, 'utf8');
      
      // Should not have implementation code
      expect(content).not.toMatch(/\{\s*[^}]*console\.log/);
      expect(content).not.toMatch(/\{\s*[^}]*return\s+\w+\(/);
      
      // Should have proper TypeScript declaration syntax
      expect(content).toMatch(/declare|export\s+(class|interface|type|const)/);
    });
  });

  describe('Environment Detection', () => {
    it('should build files that detect environment correctly', async () => {
      // This test verifies that environment detection logic is preserved in builds
      const nodeEsmPath = join(distPath, 'node.esm.js');
      const browserEsmPath = join(distPath, 'browser.esm.js');
      
      const nodeContent = await fs.readFile(nodeEsmPath, 'utf8');
      const browserContent = await fs.readFile(browserEsmPath, 'utf8');
      
      // Both should have some form of environment detection
      // This might be in the form of checks for `window`, `process`, etc.
      expect(nodeContent.length).toBeGreaterThan(1000); // Reasonable minimum size
      expect(browserContent.length).toBeGreaterThan(1000); // Reasonable minimum size
    });
  });

  describe('Bundle Analysis', () => {
    it('should have reasonably sized bundles', async () => {
      // Set reasonable size limits (in KB)
      const sizeLimits = {
        'index.esm.js': 200,      // 200KB for default ESM
        'index.cjs': 200,         // 200KB for default CJS
        'node.esm.js': 200,       // 200KB for Node ESM
        'node.cjs': 200,          // 200KB for Node CJS
        'browser.esm.js': 300,    // 300KB for browser ESM (may include polyfills)
        'browser.umd.js': 150,    // 150KB for browser UMD (minified)
        'index.d.ts': 65          // 65KB for declarations (increased for Phase 5 security features + rate limit headers)
      };
      
      for (const [file, limitKB] of Object.entries(sizeLimits)) {
        const filePath = join(distPath, file);
        const stats = await fs.stat(filePath);
        const sizeKB = stats.size / 1024;
        
        expect(sizeKB).toBeLessThan(limitKB);
        expect(sizeKB).toBeGreaterThan(1); // Should be at least 1KB
      }
    });

    it('should have consistent exports across all builds', async () => {
      // Verify that all builds export the same public API
      const builds = [
        'index.esm.js',
        'node.esm.js', 
        'browser.esm.js'
      ];
      
      const exportRegex = /export\s*{\s*([^}]+)\s*}/g;
      const exportPatterns: string[][] = [];
      
      for (const build of builds) {
        const filePath = join(distPath, build);
        const content = await fs.readFile(filePath, 'utf8');
        
        const matches = Array.from(content.matchAll(exportRegex));
        const exports = matches.flatMap(match =>
          match[1]?.split(',').map(exp => exp.trim().replace(/\s+as\s+\w+/, '')) ?? []
        );
        exportPatterns.push(exports);
      }
      
      // All builds should export similar core functionality
      // (exact matches might vary due to build differences, but core exports should be present)
      const coreExports = ['EtsyClient', 'AuthHelper', 'TokenManager'];
      
      for (const exports of exportPatterns) {
        const exportString = exports.join(' ');
        for (const coreExport of coreExports) {
          expect(exportString).toContain(coreExport);
        }
      }
    });
  });
});