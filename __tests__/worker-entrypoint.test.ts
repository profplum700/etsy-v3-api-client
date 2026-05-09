import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const workerBundlePath = path.join(repoRoot, 'dist/worker.esm.js');
const workerTypesPath = path.join(repoRoot, 'dist/worker.d.ts');
const workerFixturePath = path.join(__dirname, 'fixtures/worker-entrypoint-smoke.mjs');

describe('Worker entrypoint', () => {
  it('publishes a Worker ESM bundle without Node/browser-only runtime assumptions', () => {
    const workerArtifacts = [
      fs.readFileSync(workerBundlePath, 'utf8'),
      fs.readFileSync(workerTypesPath, 'utf8')
    ].join('\n');
    const forbiddenPatterns = [
      /typeof\s+process/,
      /process\./,
      /\bBuffer\./,
      /\bBuffer\(/,
      /typeof\s+window/,
      /window\./,
      /from\s+['"]fs['"]/,
      /import\(['"]fs['"]\)/,
      /from\s+['"]crypto['"]/,
      /import\(['"]crypto['"]\)/,
      /node:/
    ];

    const violations = forbiddenPatterns
      .map((pattern) => pattern.exec(workerArtifacts)?.[0])
      .filter((match): match is string => Boolean(match));

    expect(violations).toEqual([]);
  });

  it('imports and constructs the client in Miniflare', async () => {
    const mf = new Miniflare({
      modules: true,
      scriptPath: workerFixturePath,
      modulesRules: [
        { type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }
      ]
    });

    try {
      const response = await mf.dispatchFetch('https://worker.test/');
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        client: 'EtsyClient',
        apiError: 'function',
        rateLimiter: 'function',
        process: 'undefined',
        buffer: 'undefined',
        window: 'undefined'
      });
    } finally {
      await mf.dispose();
    }
  });
});
