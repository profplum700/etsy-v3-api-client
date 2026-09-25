import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { platform } from 'node:os';
import test from 'node:test';
import { inspectTarball, selectPublishAction, validatePackageManifest } from './publish-package.mjs';

test('checks the manifest inside the exact npm pack tarball', async () => {
  const root = await mkdtemp(join(tmpdir(), 'etsy-tarball-check-'));
  try {
    const packageDirectory = join(root, 'package');
    const tarballPath = join(root, 'fixture.tgz');
    await mkdir(packageDirectory);
    await writeFile(join(packageDirectory, 'package.json'), JSON.stringify({ name: '@example/fixture', version: '1.2.3' }));
    await writeFile(join(packageDirectory, 'index.js'), 'export {};\n');
    execFileSync(platform() === 'win32' ? 'tar.exe' : 'tar', ['-czf', 'fixture.tgz', 'package'], { cwd: root });
    const inspected = inspectTarball(tarballPath, '@example/fixture', '1.2.3');
    assert.equal(inspected.manifest.name, '@example/fixture');
    assert.equal(inspected.manifest.version, '1.2.3');
    assert.match(inspected.integrity, /^sha512-/);
    assert.throws(() => inspectTarball(tarballPath, '@example/other', '1.2.3'), /does not match/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('publishes only when the exact npm version is absent, and verifies repeat runs', () => {
  assert.equal(selectPublishAction({ viewStatus: 1, viewOutput: 'npm error code E404', localIntegrity: 'sha512-a' }), 'publish');
  assert.equal(selectPublishAction({ viewStatus: 0, publishedIntegrity: 'sha512-a', localIntegrity: 'sha512-a' }), 'skip-identical-publication');
  assert.throws(() => selectPublishAction({ viewStatus: 0, publishedIntegrity: 'sha512-b', localIntegrity: 'sha512-a' }), /different tarball integrity/);
  assert.throws(() => selectPublishAction({ viewStatus: 1, viewOutput: 'network unavailable', localIntegrity: 'sha512-a' }), /Could not determine/);
});

test('rejects a tarball manifest whose package version does not match the tag', () => {
  assert.throws(() => validatePackageManifest({ name: '@example/fixture', version: '1.2.2' }, '@example/fixture', '1.2.3'), /does not match/);
});
