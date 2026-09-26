import ts from 'typescript';
import { readFile } from 'node:fs/promises';

export async function publicBaseline() {
  const index = (await readFile('src/index.ts', 'utf8')).replaceAll('\r\n', '\n');
  const client = await readFile('src/client.ts', 'utf8');
  const tree = ts.createSourceFile('client.ts', client, ts.ScriptTarget.Latest, true);
  const names = ['getShop', 'getShopByOwnerUserId', 'findAllActiveListingsByShop', 'getListingInventory', 'updateListing'];
  const methods = {};
  function visit(node) {
    if (ts.isMethodDeclaration(node) && names.includes(node.name.getText(tree))) methods[node.name.getText(tree)] = node.getText(tree).slice(0, node.body.getStart(tree) - node.getStart(tree)).trim().replace(/\s+/g, ' ');
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const tools = await readFile('packages/etsy-mcp-server/src/tools.ts', 'utf8');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const mcp = JSON.parse(await readFile('packages/etsy-mcp-server/package.json', 'utf8'));
  return { index, methods, mcpTools: [...tools.matchAll(/server\.registerTool\("([^"]+)"/g)].map(match => match[1]), runtimeDependencies: pkg.dependencies, mcpRuntimeDependencies: mcp.dependencies, packageFiles: pkg.files, mcpPackageFiles: mcp.files };
}
