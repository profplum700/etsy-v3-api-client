import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [baseRef, headRef] = process.argv.slice(2);
if (!baseRef || !headRef) {
  throw new Error('Usage: node scripts/changed-package-versions.mjs <base-sha> <head-sha>');
}

function readJsonAt(ref, filePath) {
  try {
    return JSON.parse(execFileSync('git', ['show', ref + ':' + filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch {
    return null;
  }
}

const packageFiles = ['package.json'];
const trackedPackageFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', headRef, '--', 'packages'], {
  encoding: 'utf8',
}).split(/\r?\n/).filter((filePath) => /^packages\/[^/]+\/package\.json$/.test(filePath));
packageFiles.push(...trackedPackageFiles);

const mcpPackageAtHead = readJsonAt(headRef, 'packages/etsy-mcp-server/package.json');
if (mcpPackageAtHead?.private !== true && /^0\./.test(mcpPackageAtHead?.version ?? '')) {
  throw new Error('Keep the Etsy MCP package private until its first stable release version is set to 1.0.0 or later.');
}

const changedPackages = [];
for (const filePath of packageFiles) {
  const before = readJsonAt(baseRef, filePath);
  const after = readJsonAt(headRef, filePath);
  if (!before || !after || typeof before.version !== 'string' || typeof after.version !== 'string') continue;
  const versionChanged = before.version !== after.version;
  const becamePublishable = before.private === true && after.private !== true;
  if (versionChanged || becamePublishable) {
    changedPackages.push({
      name: after.name,
      from: before.version,
      version: after.version,
      becamePublishable,
      private: after.private === true,
    });
  }
}

const result = {
  base: baseRef,
  head: headRef,
  packages: changedPackages,
  mcpChanged: changedPackages.some((entry) => entry.name === '@profplum700/etsy-mcp-server' && !entry.private),
};
const serialized = JSON.stringify(result);
console.log(serialized);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, 'changed_packages=' + JSON.stringify(changedPackages) + '\n');
  appendFileSync(process.env.GITHUB_OUTPUT, 'mcp_changed=' + String(result.mcpChanged) + '\n');
}
