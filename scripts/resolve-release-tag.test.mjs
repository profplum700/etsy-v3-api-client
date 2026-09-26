import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolvePackageReleaseTag } from './resolve-release-tag.mjs';

async function temporaryWorkspace(packageManifest) {
  const root = await mkdtemp(join(tmpdir(), 'etsy-release-tag-'));
  await mkdir(join(root, 'packages', 'etsy-mcp-server'), { recursive: true });
  await writeFile(join(root, 'packages', 'etsy-mcp-server', 'package.json'), JSON.stringify(packageManifest));
  return root;
}

test('resolves an exact public package and version tag', async () => {
  const root = await temporaryWorkspace({ name: '@profplum700/etsy-mcp-server', version: '1.0.0' });
  try {
    assert.deepEqual(resolvePackageReleaseTag('@profplum700/etsy-mcp-server@1.0.0', root), {
      packageName: '@profplum700/etsy-mcp-server',
      version: '1.0.0',
      directory: 'packages/etsy-mcp-server',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects malformed, unknown, private, and version-mismatched tags', async (t) => {
  const root = await temporaryWorkspace({ name: '@profplum700/etsy-mcp-server', version: '1.0.0' });
  try {
    await t.test('malformed tag', () => assert.throws(() => resolvePackageReleaseTag('etsy-mcp-server@1.0.0', root)));
    await t.test('unknown package', () => assert.throws(() => resolvePackageReleaseTag('@other/package@1.0.0', root), /No public workspace package/));
    await t.test('version mismatch', () => assert.throws(() => resolvePackageReleaseTag('@profplum700/etsy-mcp-server@1.1.0', root), /does not match/));
    await t.test('private package', async () => {
      const privateRoot = await temporaryWorkspace({ name: '@profplum700/etsy-mcp-server', version: '1.0.0', private: true });
      try {
        assert.throws(() => resolvePackageReleaseTag('@profplum700/etsy-mcp-server@1.0.0', privateRoot), /private package/);
      } finally {
        await rm(privateRoot, { recursive: true, force: true });
      }
    });
    await t.test('unstable MCP package', async () => {
      const unstableRoot = await temporaryWorkspace({ name: '@profplum700/etsy-mcp-server', version: '0.9.0' });
      try {
        assert.throws(() => resolvePackageReleaseTag('@profplum700/etsy-mcp-server@0.9.0', unstableRoot), /must be at version 1.0.0 or later/);
      } finally {
        await rm(unstableRoot, { recursive: true, force: true });
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
