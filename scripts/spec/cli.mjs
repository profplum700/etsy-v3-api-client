import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, download, generate, markdown, digest, validate } from './core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const [command, ...args] = process.argv.slice(2);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function save(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); }
const stringify = value => JSON.stringify(value, null, 2) + '\n';

if (command === 'fetch') {
  const target = args[0] ?? '.cache/spec-candidate';
  const { bytes, provenance } = await download();
  await save(`${target}/etsy-openapi.json`, bytes);
  await save(`${target}/provenance.json`, stringify(provenance));
} else if (command === 'diff') {
  const [baseline = 'spec/etsy-openapi.json', candidate = '.cache/spec-candidate/etsy-openapi.json', output = '.cache/spec-report'] = args;
  const before = await validate(await json(baseline));
  const after = await validate(await json(candidate));
  const report = compare(before, after, await json('spec/sdk-mapping.json'));
  await save(`${output}/report.json`, stringify(report));
  await save(`${output}/report.md`, markdown(report));
  console.log(`${report.changes.length} specification differences`);
} else if (command === 'generate') {
  const [input = 'spec/etsy-openapi.json', output = 'spec/generated/schema.d.ts'] = args;
  await save(output, await generate(await json(input)));
} else if (command === 'check') {
  const bytes = await readFile('spec/etsy-openapi.json');
  const provenance = await json('spec/provenance.json');
  if (digest(bytes) !== provenance.sha256) throw new Error('Snapshot digest mismatch');
  const document = JSON.parse(bytes);
  const first = await generate(document);
  const second = await generate(document);
  if (first !== second || first !== await readFile('spec/generated/schema.d.ts', 'utf8')) throw new Error('Generated types differ; regenerate from pinned input');
  console.log('Pinned specification digest and deterministic generated output verified');
} else throw new Error('Expected fetch, diff, generate or check');
