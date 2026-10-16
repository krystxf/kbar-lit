import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), 'kbar-lit-package-'));
const run = (command, args, cwd = dir) =>
  execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
try {
  run('pnpm', ['--filter', 'kbar-lit', 'pack', '--out', join(dir, 'kbar-lit.tgz')], root);
  const entries = run('tar', ['-tzf', join(dir, 'kbar-lit.tgz')])
    .trim()
    .split('\n');
  for (const path of [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/core.js',
    'dist/register.js',
    'LICENSE',
    'README.md',
  ]) {
    assert(entries.includes(`package/${path}`), `Missing published file: ${path}`);
  }
  assert(
    entries.every((path) => !/node_modules|upstream|tests\//.test(path)),
    'Package contains test fixtures or dependencies',
  );
  const rootManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      packageManager: rootManifest.packageManager,
      dependencies: { 'kbar-lit': 'file:./kbar-lit.tgz' },
    }),
  );
  run('pnpm', ['install', '--ignore-scripts', '--ignore-workspace', '--prefer-offline']);
  const manifest = JSON.parse(
    await readFile(join(dir, 'node_modules/kbar-lit/package.json'), 'utf8'),
  );
  assert(!manifest.dependencies.react && !manifest.dependencies.kbar);
  assert(
    Object.values(manifest.dependencies).every((version) => !version.startsWith('workspace:')),
  );
  await writeFile(
    join(dir, 'smoke.mjs'),
    `
    import assert from 'node:assert/strict';
    import { KBarStore, ActionImpl, KBarController } from 'kbar-lit';
    import { KBarStore as CoreStore } from 'kbar-lit/core';
    import { registerKBar } from 'kbar-lit/register';
    assert.equal(KBarStore, CoreStore);
    assert.equal(typeof KBarController, 'function');
    assert.equal(typeof registerKBar, 'function');
    const store = new KBarStore([{ id: 'home', name: 'Home' }]);
    assert(store.matches[0] instanceof ActionImpl);
    store.destroy();
  `,
  );
  run(process.execPath, ['smoke.mjs']);
  await writeFile(
    join(dir, 'consumer.ts'),
    `
    import { KBarStore, KBarController, KBarActionsController, ActionImpl, ActionInterface, KBarSearch, type Action } from 'kbar-lit';
    import { Command, KBarHistory } from 'kbar-lit/core';
    import { registerKBar } from 'kbar-lit/register';
    const actions: Action[] = [{ id: 'x', name: 'Example', perform: () => () => {} }];
    const store = new KBarStore(actions);
    const search: KBarSearch = document.createElement('kbar-search');
    search.inputProperties = { maxLength: 20, oninput: () => {} };
    search.inputAttributes = { 'data-test': 'value' };
    const registry = new ActionInterface(actions);
    registry.actions.x.addChild(ActionImpl.create({ id: 'y', name: 'Y' }, { store: {} }));
    registerKBar();
    void [store, KBarController, KBarActionsController, Command, KBarHistory];
  `,
  );
  run(resolve(root, 'node_modules/.bin/tsc'), [
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    'consumer.ts',
  ]);
  console.log(
    `Verified ${entries.length} packed files, isolated pnpm installation, SSR-safe exports and consumer declarations.`,
  );
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  await rm(dir, { recursive: true, force: true });
}
