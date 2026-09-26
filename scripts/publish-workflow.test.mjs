import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workflowPath = fileURLToPath(new URL('../.github/workflows/publish.yml', import.meta.url));
const workflow = readFileSync(workflowPath, 'utf8');

test('every release job checks out the immutable event commit', () => {
  const checkoutRefs = [...workflow.matchAll(/uses:\s*actions\/checkout@[^\n]+\n\s+with:\n\s+ref:\s*([^\n]+)/g)]
    .map((match) => match[1].trim());

  assert.equal(checkoutRefs.length, 3, 'expected prepare, npm publish, and Registry publish checkouts');
  assert.deepEqual(checkoutRefs, Array(3).fill('${{ github.sha }}'));
});
