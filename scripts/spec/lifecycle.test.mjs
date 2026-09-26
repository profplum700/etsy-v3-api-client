import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { run, BRANCH } from './automation.mjs';
import { digest } from './core.mjs';

test('real Git lifecycle with isolated origin and simulated GitHub API: changed, repeat, new base, failed download, ownership', async () => {
  const original = process.cwd();
  const environment = { ...process.env };
  const dir = await mkdtemp(join(tmpdir(), 'etsy-spec-lifecycle-'));
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const baseline = { openapi: '3.0.2', info: { title: 'Fixture', version: '1' }, paths: {} };
  let candidate = baseline;
  let fail = false;
  const prs = [];
  const dispatches = [];
  const request = async (url, options) => {
    assert.ok(!url.endsWith('/'), 'GitHub repository metadata URL must not have a trailing slash');
    const path = url.replace('https://api.github.com/repos/profplum700/etsy-v3-api-client', '').replace(/^\//, '');
    const body = options.body ? JSON.parse(options.body) : undefined;
    let result;
    if (path === '') result = { private: false };
    else if (path.startsWith('git/matching-refs/')) {
      const refs = git('ls-remote', 'origin', `refs/heads/${BRANCH}`);
      result = refs ? [{ ref: `refs/heads/${BRANCH}`, object: { sha: refs.split('\t')[0] } }] : [];
    } else if (path.startsWith('pulls?')) result = prs;
    else if (path === 'pulls' && options.method === 'POST') { prs.push({ ...body, number: 1 }); result = prs[0]; }
    else if (path === 'pulls/1') { Object.assign(prs[0], body); result = prs[0]; }
    else if (path.endsWith('/dispatches')) { dispatches.push(body.inputs.candidate_sha); return new Response(null, { status: 204 }); }
    else throw new Error(`Unexpected API path ${path}`);
    return new Response(JSON.stringify(result));
  };
  const fetchSpec = async () => {
    if (fail) throw new Error('Synthetic download failure');
    const bytes = Buffer.from(JSON.stringify(candidate));
    return { bytes, document: candidate, provenance: { source: 'synthetic fixture', sha256: digest(bytes), retrievedAt: '2026-01-01T00:00:00Z' } };
  };
  try {
    process.chdir(dir);
    git('init', '--bare', 'origin.git');
    git('init', '-b', 'master', 'working');
    process.chdir(join(dir, 'working'));
    git('remote', 'add', 'origin', join(dir, 'origin.git'));
    await mkdir('spec');
    await writeFile('spec/etsy-openapi.json', JSON.stringify(baseline));
    await writeFile('spec/sdk-mapping.json', '{}');
    git('add', '.'); git('commit', '-m', 'fixture baseline'); git('push', 'origin', 'master');
    process.env.GITHUB_REPOSITORY = 'profplum700/etsy-v3-api-client';
    process.env.GH_TOKEN = 'synthetic-test-token';
    process.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
    delete process.env.GITHUB_STEP_SUMMARY;
    await run({ fetchSpec, request }); assert.equal(prs.length, 0);
    candidate = structuredClone(baseline); candidate.info.description = 'Synthetic changed description';
    await run({ fetchSpec, request }); assert.equal(prs.length, 1); assert.equal(prs[0].draft, true);
    const first = dispatches.at(-1);
    await run({ fetchSpec, request }); assert.equal(prs.length, 1); assert.equal(dispatches.at(-1), first);
    git('checkout', 'master'); await writeFile('unrelated.txt', 'new base'); git('add', '.'); git('commit', '-m', 'advance master'); git('push', 'origin', 'master');
    await run({ fetchSpec, request }); assert.notEqual(dispatches.at(-1), first);
    const stable = git('ls-remote', 'origin', `refs/heads/${BRANCH}`);
    fail = true; await assert.rejects(run({ fetchSpec, request }), /Synthetic/); fail = false;
    assert.equal(git('ls-remote', 'origin', `refs/heads/${BRANCH}`), stable);
    git('fetch', 'origin', BRANCH); git('checkout', '--detach', 'FETCH_HEAD');
    await writeFile('spec/report.md', 'human edit'); git('add', '.'); git('commit', '-m', 'human intervention'); git('push', 'origin', `HEAD:refs/heads/${BRANCH}`);
    await assert.rejects(run({ fetchSpec, request }), /Human/);
  } finally {
    process.chdir(original);
    for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
    Object.assign(process.env, environment);
    // Keep isolated fixture directory for failure diagnostics; OS temp cleanup owns removal.
  }
});
