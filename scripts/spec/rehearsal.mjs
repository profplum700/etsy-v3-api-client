import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { run, BRANCH } from './automation.mjs';
import { digest } from './core.mjs';
import { execFileSync } from 'node:child_process';

// Manual-only hosted integration proof. Never enabled by the weekly schedule.
const branch = `${BRANCH}-rehearsal`;
const repo = process.env.GITHUB_REPOSITORY;
const startedAt = new Date(Date.now() - 1000).toISOString();
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, { method, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Rehearsal API ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const document = JSON.parse(await readFile('spec/etsy-openapi.json', 'utf8'));
document.info.description = `${document.info.description ?? ''}\nSYNTHETIC MAINTENANCE REHEARSAL; NOT AN ETSY UPDATE.`;
const bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n');
const fetchSpec = async () => ({ document, bytes, provenance: { source: 'synthetic rehearsal based on committed Etsy snapshot; not upstream', retrievedAt: new Date().toISOString(), sha256: digest(bytes) } });
const first = await run({ branch, fetchSpec });
const second = await run({ branch, fetchSpec });
assert.equal(first, second, 'Repeated candidate must reuse exact commit');
await assert.rejects(run({ branch, fetchSpec: async () => { throw new Error('Rehearsal download failure'); } }), /Rehearsal download failure/);
assert.equal((await api(`git/ref/heads/${branch}`)).object.sha, first, 'Failure must preserve remote candidate');
const prs = await api(`pulls?state=open&head=profplum700:${branch}&base=master`);
assert.equal(prs.length, 1);
assert.equal(prs[0].draft, true);
await appendFile(process.env.GITHUB_STEP_SUMMARY, `Rehearsal draft PR: ${prs[0].html_url}\nExact candidate: ${first}\nChanged/repeated/failure scenarios passed.\n`);
// Both runs explicitly dispatch validation. Wait for both so cleanup cannot race them.
const deadline = Date.now() + 20 * 60_000;
let complete = false;
while (Date.now() < deadline) {
  const runs = (await api('actions/workflows/spec-candidate.yml/runs?event=workflow_dispatch&per_page=30')).workflow_runs.filter(item => item.created_at >= startedAt);
  // Commit statuses bind validation to the candidate even though dispatch runs are on master.
  const statuses = (await api(`commits/${first}/statuses`)).filter(status => status.context === 'spec-candidate' && status.created_at >= startedAt);
  const successRuns = new Set(statuses.filter(status => status.state === 'success').map(status => status.target_url));
  if (successRuns.size >= 2 && !runs.some(item => item.status !== 'completed')) { complete = true; break; }
  if (statuses.some(status => status.state === 'failure' || status.state === 'error')) throw new Error('Hosted candidate verification failed; draft preserved for diagnosis');
  await new Promise(resolve => setTimeout(resolve, 15_000));
}
assert.ok(complete, 'Timed out waiting for two exact-candidate successes; draft preserved');
const finalPr = await api(`pulls/${prs[0].number}`);
assert.ok(finalPr.draft && finalPr.state === 'open' && finalPr.head.sha === first, 'Human intervention detected; preserving rehearsal');
assert.equal((await api(`git/ref/heads/${branch}`)).object.sha, first, 'Branch moved; preserving rehearsal');
await api(`pulls/${prs[0].number}`, 'PATCH', { state: 'closed' });
execFileSync('git', ['push', `--force-with-lease=refs/heads/${branch}:${first}`, 'origin', `:refs/heads/${branch}`], { stdio: 'inherit' });
await appendFile(process.env.GITHUB_STEP_SUMMARY, 'Both candidate validations passed. Synthetic draft closed and rehearsal branch removed.\n');
