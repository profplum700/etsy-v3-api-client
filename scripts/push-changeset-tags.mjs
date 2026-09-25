import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const inputPath = process.argv[2];
if (!inputPath || !existsSync(inputPath)) {
  throw new Error('Pass the changed package versions JSON file.');
}

const changed = JSON.parse(readFileSync(inputPath, 'utf8'));
for (const entry of changed.packages) {
  if (entry.private) continue;
  const tag = entry.name + '@' + entry.version;
  const ref = 'refs/tags/' + tag;
  const exists = spawnSync('git', ['show-ref', '--verify', '--quiet', ref]).status === 0;
  if (!exists) continue;
  execFileSync('git', ['push', 'origin', ref], { stdio: 'inherit' });
}
