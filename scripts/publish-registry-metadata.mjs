import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).filter((key) => key !== '$schema').sort().map((key) => [key, stable(value[key])]));
}

export function selectRegistryPublishAction(status, responseBody, expectedServer) {
  if (status === 404) return 'publish';
  if (status !== 200) throw new Error(`MCP Registry version lookup failed with HTTP ${status}.`);
  const existing = responseBody?.server && typeof responseBody.server === 'object' ? responseBody.server : responseBody;
  if (JSON.stringify(stable(existing)) !== JSON.stringify(stable(expectedServer))) {
    throw new Error('The MCP Registry server version already exists with different metadata; refusing to treat it as published.');
  }
  return 'skip-identical-publication';
}

export async function publishRegistryMetadata(metadataPath, fetchImpl = fetch) {
  const expected = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const endpoint = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(expected.name)}/versions/${encodeURIComponent(expected.version)}`;
  const response = await fetchImpl(endpoint, { headers: { accept: 'application/json' } });
  let body;
  try {
    body = await response.json();
  } catch {
    if (response.status !== 404) throw new Error('MCP Registry returned an invalid version lookup response.');
  }
  const action = selectRegistryPublishAction(response.status, body, expected);
  if (action === 'skip-identical-publication') {
    console.log(`${expected.name}@${expected.version} already exists in the MCP Registry with matching metadata; continuing safely.`);
    return;
  }

  const publisher = process.platform === 'win32' ? 'mcp-publisher.exe' : './mcp-publisher';
  const result = spawnSync(publisher, ['publish', metadataPath], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`MCP Registry publication failed with exit code ${result.status ?? 'unknown'}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const path = process.argv[2] ?? 'server.json';
    await publishRegistryMetadata(path);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'MCP Registry publication failed.');
    process.exitCode = 1;
  }
}
