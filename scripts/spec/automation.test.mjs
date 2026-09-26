import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertOwned, decide, MARKER } from './automation.mjs';

test('unchanged and repeated candidates are idempotent', () => {
  assert.equal(decide({ a: 1 }, { a: 1 }), 'unchanged');
  assert.equal(decide({ a: 1 }, { a: 2 }), 'update');
  assert.equal(decide({ a: 1 }, { a: 2 }, { a: 2 }), 'repeat');
});
test('human changes and unexpected paths stop automation', () => {
  const bot = { author: '41898282+github-actions[bot]@users.noreply.github.com', subject: `${MARKER} update` };
  assert.doesNotThrow(() => assertOwned([bot], ['spec/provenance.json']));
  assert.throws(() => assertOwned([{ ...bot, author: 'person@example.com' }], []));
  assert.throws(() => assertOwned([bot], ['src/client.ts']));
});
test('hosted workflows preserve cost, concurrency and identity boundaries', async () => {
  for (const name of ['spec-update', 'spec-candidate']) {
    const workflow = await readFile(`.github/workflows/${name}.yml`, 'utf8');
    assert.match(workflow, /runs-on: ubuntu-latest/);
    assert.match(workflow, /repository.private == false/);
    assert.doesNotMatch(workflow, /upload-artifact|actions\/cache|self-hosted|TYPESAFE|OPENAI|ANTHROPIC/);
  }
  const update = await readFile('.github/workflows/spec-update.yml', 'utf8');
  assert.match(update, /0 8 \* \* 1/);
  assert.match(update, /cancel-in-progress: false/);
  const candidate = await readFile('.github/workflows/spec-candidate.yml', 'utf8');
  assert.match(candidate, /ref: master/);
  assert.match(candidate, /node scripts\/spec\/validate-candidate.mjs/);
  assert.match(candidate, /persist-credentials: false/);
});
