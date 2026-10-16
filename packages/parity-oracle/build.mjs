import { build } from 'esbuild';
await build({
  entryPoints: ['entry.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  packages: 'external',
  sourcemap: true,
});
