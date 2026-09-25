import { readFileSync, writeFileSync } from 'node:fs';

const packagePath = new URL('../packages/etsy-mcp-server/package.json', import.meta.url);
const registryPath = new URL('../server.json', import.meta.url);
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const registryJson = JSON.parse(readFileSync(registryPath, 'utf8'));
const mcpPackage = registryJson.packages.find((entry) => entry.identifier === packageJson.name);

if (!mcpPackage) {
  throw new Error('server.json does not declare the Etsy MCP npm package.');
}

const isSynchronized = registryJson.name === packageJson.mcpName &&
  registryJson.version === packageJson.version && mcpPackage.version === packageJson.version;
const hasValidLaunchArguments = registryJson.packages.length === 1 &&
  registryJson.packages[0]?.runtimeHint === 'npx' &&
  registryJson.packages[0]?.runtimeArguments?.map((argument) => argument.value).join(' ') === '--yes' &&
  registryJson.packages[0]?.packageArguments?.map((argument) => argument.value).join(' ') === 'serve';
if (process.argv.includes('--check')) {
  if (!isSynchronized) {
    throw new Error('server.json name and version fields must match the Etsy MCP package metadata.');
  }
  if (!hasValidLaunchArguments) {
    throw new Error('server.json must pass only `serve` to the package command after selecting the npm package.');
  }
  console.log('MCP Registry name and version match the package metadata.');
} else {
  if (!hasValidLaunchArguments) {
    throw new Error('server.json must pass only `serve` to the package command after selecting the npm package.');
  }
  registryJson.version = packageJson.version;
  registryJson.name = packageJson.mcpName;
  mcpPackage.version = packageJson.version;
  writeFileSync(registryPath, JSON.stringify(registryJson, null, 2) + '\n');
  console.log('Synchronized server.json to Etsy MCP package ' + packageJson.version + '.');
}
