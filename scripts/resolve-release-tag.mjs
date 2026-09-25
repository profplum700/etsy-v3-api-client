import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageNamePattern = /^@[^/]+\/[^@]+$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readManifest(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function resolvePackageReleaseTag(tag, root = repositoryRoot) {
  const separator = tag.lastIndexOf('@');
  if (separator <= 0) throw new Error('Release tag must have the form @scope/package@version.');

  const packageName = tag.slice(0, separator);
  const version = tag.slice(separator + 1);
  if (!packageNamePattern.test(packageName) || !versionPattern.test(version)) {
    throw new Error('Release tag must have the form @scope/package@version using a valid package version.');
  }

  const candidateDirectories = [
    { directory: '.', manifest: join(root, 'package.json') },
    ...readdirSync(join(root, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ directory: `packages/${entry.name}`, manifest: join(root, 'packages', entry.name, 'package.json') })),
  ];

  for (const candidate of candidateDirectories) {
    const manifest = readManifest(candidate.manifest);
    if (manifest?.name !== packageName) continue;
    if (manifest.private === true) throw new Error(`Cannot release private package ${packageName}.`);
    if (manifest.version !== version) {
      throw new Error(`Release tag version ${version} does not match ${packageName} version ${manifest.version}.`);
    }
    if (packageName === '@profplum700/etsy-mcp-server' && version.startsWith('0.')) {
      throw new Error('The public Etsy MCP server must be at version 1.0.0 or later.');
    }
    return { packageName, version, directory: candidate.directory };
  }

  throw new Error(`No public workspace package named ${packageName} exists.`);
}

function main() {
  const tag = process.argv[2];
  if (!tag) throw new Error('Pass a package release tag such as @scope/package@1.2.3.');
  const release = resolvePackageReleaseTag(tag);
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(output, `package_name=${release.packageName}\n`);
    appendFileSync(output, `package_version=${release.version}\n`);
    appendFileSync(output, `package_directory=${release.directory}\n`);
    appendFileSync(output, `mcp_changed=${String(release.packageName === '@profplum700/etsy-mcp-server')}\n`);
  }
  console.log(JSON.stringify(release));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not validate package release tag.');
    process.exitCode = 1;
  }
}
