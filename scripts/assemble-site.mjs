import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const destination = new URL('dist/site/', root);
const apps = {
  angular: 'apps/angular/dist/browser/',
  react: 'apps/nextjs/out/',
  vue: 'apps/vue/dist/',
  lit: 'apps/lit/dist/',
};
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const [path, source] of Object.entries(apps)) {
  await cp(new URL(source, root), new URL(`${path}/`, destination), { recursive: true });
}
await cp(new URL('site/', root), destination, { recursive: true });
console.log(`Site ready: ${fileURLToPath(destination)}`);
