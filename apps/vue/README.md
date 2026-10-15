# Vue + kbar-lit

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @kbar-lit/example-vue dev
```

Open http://127.0.0.1:4202. For the built production app, use `pnpm --filter @kbar-lit/example-vue preview`.

The Vite Vue plugin treats `kbar-*` tags as native custom elements using `compilerOptions.isCustomElement`. `:store.prop` explicitly binds the store property, and `@kbar-select` subscribes to the native event. Callbacks update Vue refs; the store remains unproxied. `onBeforeUnmount` removes temporary registrations and destroys the owned store.

All command-menu UI comes from `kbar-lit`, registered in `main.ts`. Vue renders the surrounding application and handles its state. The shared package supplies demonstration action data and CSS, not another menu implementation.

See the [Vue Web Components guide](https://vuejs.org/guide/extras/web-components.html) and `tests/examples/integration.spec.ts` for executable integration coverage.
