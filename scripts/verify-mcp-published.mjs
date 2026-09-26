import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../packages/etsy-mcp-server/package.json', import.meta.url), 'utf8'));
const registryJson = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
const packageMetadata = registryJson.packages.find((entry) => entry.identifier === packageJson.name);

if (!packageMetadata || packageJson.private === true) {
  throw new Error('The Etsy MCP package is private or missing from server.json.');
}
if (packageJson.mcpName !== registryJson.name) {
  throw new Error('The Etsy MCP npm mcpName must match the MCP Registry server name.');
}
if (registryJson.version !== packageJson.version || packageMetadata.version !== packageJson.version) {
  throw new Error('The Etsy MCP Registry metadata does not match the package version.');
}

const registryUrl = 'https://registry.npmjs.org/' + encodeURIComponent(packageJson.name) + '/' + encodeURIComponent(packageJson.version);
const response = await fetch(registryUrl, { headers: { accept: 'application/json' } });
if (!response.ok) {
  throw new Error('The Etsy MCP package is not available on npm at version ' + packageJson.version + '.');
}

const published = await response.json();
if (published.name !== packageJson.name || published.version !== packageJson.version || published.mcpName !== packageJson.mcpName) {
  throw new Error('npm returned package metadata that does not match the expected Etsy MCP package version.');
}
console.log('Verified @profplum700/etsy-mcp-server@' + packageJson.version + ' is published on npm.');
