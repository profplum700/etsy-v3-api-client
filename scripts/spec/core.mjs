import SwaggerParser from '@apidevtools/swagger-parser';
import openapiTS, { astToString } from 'openapi-typescript';
import { createHash } from 'node:crypto';

export const SOURCE = 'https://www.etsy.com/openapi/generated/oas/3.0.0.json';
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const normalized = value => JSON.stringify(canonical(value));

export async function validate(document) {
  if (!document || !/^3\.0\./.test(document.openapi ?? '')) throw new Error('Expected OpenAPI 3.0.x');
  let nodes = 0;
  const visit = (value, depth = 0) => {
    if (++nodes > 200_000 || depth > 100) throw new Error('Specification complexity limit exceeded');
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string' && !value.$ref.startsWith('#/')) throw new Error('External references are not allowed');
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(document);
  await SwaggerParser.validate(structuredClone(document), { resolve: { external: false } });
  const ids = new Set();
  for (const { operationId } of operations(document)) {
    if (!operationId || ids.has(operationId)) throw new Error('Missing or duplicate operationId');
    ids.add(operationId);
  }
  return document;
}

export function operations(document) {
  return Object.entries(document.paths ?? {}).flatMap(([path, item]) => Object.entries(item)
    .filter(([method]) => ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'].includes(method))
    .map(([method, operation]) => ({ path, method, operationId: operation.operationId })));
}

const escapePointer = value => value.replaceAll('~', '~0').replaceAll('/', '~1');
export function compare(before, after, mapping = {}) {
  const changes = [];
  function walk(oldValue, newValue, parts = []) {
    if (normalized(oldValue) === normalized(newValue)) return;
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (Array.isArray(oldValue) && Array.isArray(newValue) && oldValue.length === newValue.length) {
      oldValue.forEach((value, index) => walk(value, newValue[index], [...parts, String(index)]));
      return;
    }
    // Descend added/removed path items so each endpoint retains operation context.
    if (parts.length === 2 && parts[0] === 'paths') {
      for (const key of [...new Set([...Object.keys(oldValue ?? {}), ...Object.keys(newValue ?? {})])].sort()) walk(oldValue?.[key], newValue?.[key], [...parts, key]);
      return;
    }
    if (object(oldValue) && object(newValue)) {
      for (const key of [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort()) walk(oldValue[key], newValue[key], [...parts, key]);
      return;
    }
    const operation = parts[0] === 'paths' ? after.paths?.[parts[1]]?.[parts[2]] ?? before.paths?.[parts[1]]?.[parts[2]] : null;
    const operationId = operation?.operationId ?? null;
    const prose = ['description', 'summary'].includes(parts.at(-1));
    const category = prose ? 'prose' : parts.includes('security') ? 'authentication' : parts.includes('required') ? 'required-fields' : parts.includes('enum') ? 'enum' : parts.includes('nullable') ? 'nullability' : parts.includes('type') ? 'type' : parts.includes('content') ? 'encoding-or-content' : 'structural';
    changes.push({ pointer: '/' + parts.map(escapePointer).join('/'), kind: oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'changed', category, operationId, sdkMethod: mapping[operationId] ?? null, before: oldValue ?? null, after: newValue ?? null });
  }
  walk(before, after);
  return { schemaVersion: 1, beforeSha256: digest(normalized(before)), afterSha256: digest(normalized(after)), changes, unmappedOperations: operations(after).filter(op => !mapping[op.operationId]) };
}

export function markdown(report) {
  // HTML escaping also prevents specification text from injecting rendered HTML or mentions.
  const safe = value => JSON.stringify(value, null, 2).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('@', '&#64;');
  return '# Etsy specification change report\n\n' + `${report.changes.length} differences. All require review; categories are advisory.\n\n` + report.changes.map(change => `## ${change.kind}\n\n<pre>${safe({ pointer: change.pointer, category: change.category, operation: change.operationId, sdkMethod: change.sdkMethod })}</pre>\n\nBefore:\n<pre>${safe(change.before)}</pre>\n\nAfter:\n<pre>${safe(change.after)}</pre>\n`).join('\n') + '\n## Unmapped operations\n\n<pre>' + safe(report.unmappedOperations) + '</pre>\n';
}

export async function generate(document) {
  await validate(document);
  return astToString(await openapiTS(structuredClone(document), { alphabetize: true }));
}

export async function download(fetcher = fetch) {
  const response = await fetcher(SOURCE, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Specification download failed: HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) throw new Error('Specification exceeds 10 MiB');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const document = await validate(JSON.parse(bytes.toString('utf8')));
  return { bytes, document, provenance: { source: SOURCE, retrievedAt: new Date().toISOString(), sha256: digest(bytes) } };
}
