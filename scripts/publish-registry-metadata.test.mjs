import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRegistryPublishAction } from './publish-registry-metadata.mjs';

const expected = {
  $schema: 'https://example.invalid/schema.json',
  name: 'io.github.example/server',
  version: '1.0.0',
  packages: [{ registryType: 'npm', identifier: '@example/server', version: '1.0.0' }],
};

test('publishes an MCP Registry version only when the exact version is absent', () => {
  assert.equal(selectRegistryPublishAction(404, undefined, expected), 'publish');
});

test('skips an existing MCP Registry version only when its metadata matches', () => {
  assert.equal(selectRegistryPublishAction(200, {
    server: { ...expected, $schema: 'https://different.invalid/schema.json' },
    _meta: { 'io.modelcontextprotocol.registry/official': { publishedAt: 'now' } },
  }, expected), 'skip-identical-publication');
});

test('fails closed for mismatched metadata and indeterminate Registry responses', () => {
  assert.throws(() => selectRegistryPublishAction(200, { ...expected, description: 'different' }, expected), /different metadata/);
  assert.throws(() => selectRegistryPublishAction(503, {}, expected), /HTTP 503/);
});
