import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, download, generate, validate, markdown } from './core.mjs';

const spec = () => ({ openapi: '3.0.2', info: { title: 'Fixture', version: '1' }, paths: { '/shop': { get: { operationId: 'getShop', description: 'A shop', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } } } } } } });
test('object order is ignored; array order is preserved', () => {
  assert.equal(compare({ a: 1, b: 2 }, { b: 2, a: 1 }).changes.length, 0);
  assert.equal(compare({ a: [1, 2] }, { a: [2, 1] }).changes.length, 2);
});
test('prose, removals, structural changes and mapping remain visible', () => {
  const before = spec(); const after = spec();
  after.paths['/shop'].get.description = 'Different behavior';
  after.paths['/shop'].get.security = [];
  const report = compare(before, after, { getShop: 'getShop' });
  assert.deepEqual(report.changes.map(c => c.category), ['prose', 'authentication']);
  assert.ok(report.changes.every(c => c.sdkMethod === 'getShop'));
  assert.equal(compare(after, { ...after, paths: {} }).changes[0].kind, 'removed');
  assert.equal(compare(after, { ...after, paths: {} }).changes[0].operationId, 'getShop');
  assert.equal(compare(before, after).unmappedOperations.length, 1);
  assert.match(markdown(report), /Different behavior/);
});
test('unknown differences and pointer escapes are retained', () => {
  assert.equal(compare({ 'a/b~': 1 }, { 'a/b~': 2 }).changes[0].pointer, '/a~1b~0');
  for (const [key, category] of [['required', 'required-fields'], ['enum', 'enum'], ['nullable', 'nullability'], ['type', 'type']]) {
    assert.equal(compare({ [key]: 1 }, { [key]: 2 }).changes[0].category, category);
  }
});
test('invalid documents and unresolved/external references fail closed', async () => {
  await assert.rejects(validate({}));
  const invalid = spec(); invalid.paths['/shop'].get.responses = {};
  await assert.rejects(validate(invalid));
  const ref = spec(); ref.components = { schemas: { Bad: { $ref: '#/components/schemas/Missing' } } };
  await assert.rejects(validate(ref));
  ref.components.schemas.Bad.$ref = 'https://example.com/private';
  await assert.rejects(validate(ref), /External/);
});
test('downloads validate before returning any candidate', async () => {
  await assert.rejects(download(async () => new Response('error', { status: 503 })), /503/);
  await assert.rejects(download(async () => new Response('not json')));
  await assert.rejects(download(async () => { throw new Error('network'); }), /network/);
  const result = await download(async () => new Response(JSON.stringify(spec())));
  assert.equal(result.provenance.sha256.length, 64);
});
test('generation is reproducible and prose cannot inject HTML', async () => {
  assert.equal(await generate(spec()), await generate(spec()));
  const report = compare({ description: '' }, { description: '</pre><script>@user</script>' });
  assert.ok(!markdown(report).includes('<script>'));
  report.changes[0].operationId = '\n![x](https://example.com)\n<script>';
  assert.ok(!markdown(report).includes('<script>'));
  assert.ok(markdown(report).includes('\\n![x]'));
});
