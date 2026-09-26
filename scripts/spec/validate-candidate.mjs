import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const candidate = process.env.CANDIDATE;
const branch = process.env.CANDIDATE_BRANCH ?? 'automation/etsy-openapi';
if (!['automation/etsy-openapi', 'automation/etsy-openapi-rehearsal'].includes(branch)) throw new Error('Invalid candidate branch');
if (!/^[0-9a-f]{40}$/.test(candidate ?? '')) throw new Error('Invalid candidate SHA');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
const base = git('rev-parse', 'HEAD');
git('fetch', 'origin', branch);
if (git('rev-parse', 'FETCH_HEAD') !== candidate) throw new Error('Candidate is no longer current');
if (git('rev-parse', `${candidate}^`) !== base) throw new Error('Candidate must be refreshed on current master');
const allowed = ['spec/etsy-openapi.json', 'spec/provenance.json', 'spec/generated/schema.d.ts', 'spec/report.json', 'spec/report.md'];
const changed = git('diff', '--name-only', base, candidate).split('\n').filter(Boolean);
if (changed.some(path => !allowed.includes(path))) throw new Error('Candidate changes executable or unexpected files');
// Execute trusted master tooling only. Overlay bounded regular-file data blobs.
for (const path of allowed) {
  if (!git('ls-tree', candidate, '--', path).startsWith('100644 blob ')) throw new Error(`Expected regular file: ${path}`);
  const bytes = execFileSync('git', ['show', `${candidate}:${path}`], { maxBuffer: 20 * 1024 * 1024 });
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Candidate file exceeds limit');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
console.log(`Trusted tooling ${base}; candidate data ${candidate}`);
