import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../packages/parity-oracle/', import.meta.url);
const digests = JSON.parse(await readFile(new URL('UPSTREAM-SHA256.json', root), 'utf8'));
for (const [path, expected] of Object.entries(digests)) {
  const actual = createHash('sha256')
    .update(await readFile(new URL(path, root)))
    .digest('hex');
  assert.equal(actual, expected, `Upstream fixture changed: ${path}`);
}
async function files(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory())
      result.push(...(await files(new URL(entry.name + '/', dir), path + '/')));
    else result.push(path);
  }
  return result;
}
assert.deepEqual(
  (await files(new URL('upstream/', root), 'upstream/')).sort(),
  Object.keys(digests).sort(),
);
// Walk workspace dependencies, including transitive shared packages. Only the
// differential harness may depend on the upstream oracle.
const manifests = new Map();
for (const dir of ['apps', 'packages']) {
  const base = new URL(`../${dir}/`, import.meta.url);
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = JSON.parse(
      await readFile(new URL(`${entry.name}/package.json`, base), 'utf8'),
    );
    manifests.set(manifest.name, manifest);
  }
}
function check(name, visited = new Set()) {
  assert.notEqual(
    name,
    '@kbar-lit/parity-oracle',
    'Published library/examples must not use the React oracle',
  );
  assert.notEqual(name, 'kbar', 'Examples must use kbar-lit');
  if (visited.has(name)) return;
  visited.add(name);
  const manifest = manifests.get(name);
  for (const dependency of Object.keys(manifest?.dependencies ?? {})) check(dependency, visited);
}
for (const name of manifests.keys()) {
  if (name.includes('parity')) continue;
  check(name);
}
console.log(
  `Verified ${Object.keys(digests).length} upstream fixture hashes and library/example dependency isolation.`,
);
