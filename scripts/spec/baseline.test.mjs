import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicBaseline } from './baseline.mjs';

test('SDK exports, selected signatures, MCP tools and distribution contract remain unchanged', async () => {
  const baseline = JSON.parse(await readFile('spec/public-baseline.json', 'utf8'));
  assert.deepEqual(await publicBaseline(), baseline);
});
