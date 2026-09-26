import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { compare, download, generate, normalized, markdown } from './core.mjs';

export const BRANCH = 'automation/etsy-openapi';
export const MARKER = '[etsy-openapi-maintenance]';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
export function assertOwned(commits, paths) {
  if (commits.some(c => c.author !== '41898282+github-actions[bot]@users.noreply.github.com' || !c.subject.startsWith(MARKER))) throw new Error('Human/unrecognized commits on automation branch; refusing to overwrite');
  const allowed = ['spec/etsy-openapi.json', 'spec/provenance.json', 'spec/generated/schema.d.ts', 'spec/report.json', 'spec/report.md'];
  if (paths.some(path => !allowed.includes(path))) throw new Error('Unexpected files on automation branch; refusing to overwrite');
}
export function decide(baseline, candidate, existing) {
  if (normalized(baseline) === normalized(candidate)) return 'unchanged';
  return existing && normalized(existing) === normalized(candidate) ? 'repeat' : 'update';
}

export async function run({ fetchSpec = download, request = fetch, branch = BRANCH } = {}) {
  if (![BRANCH, `${BRANCH}-rehearsal`].includes(branch)) throw new Error('Unexpected maintenance branch');
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo !== 'profplum700/etsy-v3-api-client' || process.env.GITHUB_EVENT_NAME === 'pull_request') throw new Error('Trusted repository event required');
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('Workflow token is required');
  async function api(path, method = 'GET', body) {
    const response = await request(`https://api.github.com/repos/${repo}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`GitHub API ${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  if ((await api('')).private) throw new Error('Public repository required for free runners');
  // Validate and generate before touching the automation branch or any remote state.
  const { bytes, document, provenance } = await fetchSpec();
  const generated = await generate(document);
  git('fetch', 'origin', 'master');
  const base = git('rev-parse', 'origin/master');
  const baseline = JSON.parse(git('show', `${base}:spec/etsy-openapi.json`));
  const refs = await api(`git/matching-refs/heads/${branch}`);
  const ref = refs.find(r => r.ref === `refs/heads/${branch}`);
  let existing;
  let existingBase;
  if (ref) {
    git('fetch', 'origin', branch);
    const head = git('rev-parse', 'FETCH_HEAD');
    if (head !== ref.object.sha) throw new Error('Automation branch changed during inspection');
    const commits = git('log', `${base}..${head}`, '--format=%ae%x09%s').split('\n').filter(Boolean).map(line => { const [author, ...subject] = line.split('\t'); return { author, subject: subject.join('\t') }; });
    const paths = git('diff', '--name-only', `${git('merge-base', base, head)}..${head}`).split('\n').filter(Boolean);
    assertOwned(commits, paths);
    existing = JSON.parse(git('show', `${head}:spec/etsy-openapi.json`));
    existingBase = git('rev-parse', `${head}^`);
  }
  const action = decide(baseline, document, existingBase === base ? existing : undefined);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Specification result: ${action}\n`);
  if (action === 'unchanged') return;
  const pulls = await api(`pulls?state=open&head=profplum700:${branch}&base=master`);
  if (pulls.length > 1) throw new Error('Multiple maintenance PRs found');
  if (pulls[0] && !pulls[0].draft) throw new Error('PR is no longer draft; maintainer has taken ownership');
  let headSha = ref?.object.sha;
  const report = compare(baseline, document, JSON.parse(await readFile('spec/sdk-mapping.json', 'utf8')));
  if (action === 'update') {
    git('checkout', '--detach', base);
    await mkdir('spec/generated', { recursive: true });
    await writeFile('spec/etsy-openapi.json', bytes);
    await writeFile('spec/provenance.json', JSON.stringify(provenance, null, 2) + '\n');
    await writeFile('spec/generated/schema.d.ts', generated);
    await writeFile('spec/report.json', JSON.stringify(report, null, 2) + '\n');
    await writeFile('spec/report.md', markdown(report));
    git('add', '--', 'spec/etsy-openapi.json', 'spec/provenance.json', 'spec/generated/schema.d.ts', 'spec/report.json', 'spec/report.md');
    git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', '-c', 'commit.gpgsign=false', 'commit', '-m', `${MARKER} update pinned Etsy specification`);
    headSha = git('rev-parse', 'HEAD');
    git('push', `--force-with-lease=refs/heads/${branch}:${ref?.object.sha ?? ''}`, 'origin', `HEAD:refs/heads/${branch}`);
  }
  const rehearsal = branch.endsWith('-rehearsal');
  const body = `${rehearsal ? 'SYNTHETIC REHEARSAL ONLY. Do not merge. This is not an Etsy upstream update.' : 'Automated specification proposal. Review required; no SDK runtime changes.'}\n\nBaseline: ${base}\nCandidate: ${headSha}\n\n${report.changes.length} differences. Full verbatim report: [spec/report.md](https://github.com/${repo}/blob/${headSha}/spec/report.md). Generated types remain internal.\n\nCandidate validation is explicitly dispatched for this exact commit. No AI services or paid infrastructure are used.\n\nTracked by #55.`;
  if (pulls[0]) {
    if (!pulls[0].draft) throw new Error('PR is no longer draft; maintainer has taken ownership');
    await api(`pulls/${pulls[0].number}`, 'PATCH', { body });
  } else await api('pulls', 'POST', { title: rehearsal ? '[REHEARSAL — DO NOT MERGE] specification maintenance' : 'chore: review Etsy OpenAPI update', head: branch, base: 'master', body, draft: true });
  await api('actions/workflows/spec-candidate.yml/dispatches', 'POST', { ref: 'master', inputs: { candidate_sha: headSha, candidate_branch: branch } });
  return headSha;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/automation.mjs')) await run();
