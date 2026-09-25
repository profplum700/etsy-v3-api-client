import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tarExecutable = process.platform === 'win32' ? 'tar.exe' : 'tar';

export function validatePackageManifest(manifest, expectedName, expectedVersion) {
  if (manifest?.name !== expectedName || manifest?.version !== expectedVersion) {
    throw new Error(`Tarball manifest ${manifest?.name ?? '(missing)'}@${manifest?.version ?? '(missing)'} does not match ${expectedName}@${expectedVersion}.`);
  }
}

export function selectPublishAction({ viewStatus, viewOutput = '', publishedIntegrity, localIntegrity }) {
  if (viewStatus === 0) {
    if (!publishedIntegrity) throw new Error('npm returned an empty integrity value for the existing package version.');
    if (publishedIntegrity !== localIntegrity) {
      throw new Error('The npm package version already exists with different tarball integrity; refusing to treat it as published.');
    }
    return 'skip-identical-publication';
  }
  if (/\bE404\b|404 Not Found/i.test(viewOutput)) return 'publish';
  throw new Error(`Could not determine whether the npm package version exists: ${viewOutput.trim() || 'npm view failed without a diagnostic.'}`);
}

export function inspectTarball(tarballPath, expectedName, expectedVersion) {
  const packageJson = execFileSync(tarExecutable, ['-xOf', basename(tarballPath), 'package/package.json'], {
    cwd: dirname(resolve(tarballPath)),
    encoding: 'utf8',
  });
  const manifest = JSON.parse(packageJson);
  validatePackageManifest(manifest, expectedName, expectedVersion);
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarballPath)).digest('base64')}`;
  return { manifest, integrity };
}

export function publishPackage(tarballPath, expectedName, expectedVersion) {
  const { integrity } = inspectTarball(tarballPath, expectedName, expectedVersion);
  const packageSpec = `${expectedName}@${expectedVersion}`;
  const view = spawnSync(npmExecutable, ['view', packageSpec, 'dist.integrity', '--json'], { encoding: 'utf8' });
  if (view.error) throw view.error;
  let publishedIntegrity;
  if (view.status === 0) {
    try {
      publishedIntegrity = JSON.parse(view.stdout.trim());
    } catch {
      publishedIntegrity = view.stdout.trim();
    }
  }
  const action = selectPublishAction({
    viewStatus: view.status,
    viewOutput: `${view.stdout ?? ''}\n${view.stderr ?? ''}`,
    publishedIntegrity,
    localIntegrity: integrity,
  });
  if (action === 'skip-identical-publication') {
    console.log(`${packageSpec} is already published with matching tarball integrity; continuing safely.`);
    return;
  }

  const publish = spawnSync(npmExecutable, ['publish', resolve(tarballPath), '--access', 'public'], { stdio: 'inherit' });
  if (publish.error) throw publish.error;
  if (publish.status !== 0) throw new Error(`npm publish failed with exit code ${publish.status ?? 'unknown'}.`);
}

function main() {
  const [tarballPath, expectedName, expectedVersion] = process.argv.slice(2);
  if (!tarballPath || !expectedName || !expectedVersion) {
    throw new Error('Usage: node scripts/publish-package.mjs <tarball> <package-name> <version>');
  }
  publishPackage(tarballPath, expectedName, expectedVersion);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Package publication failed.');
    process.exitCode = 1;
  }
}
