# Angular + kbar-lit

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @kbar-lit/example-angular dev
```

Open http://127.0.0.1:4203. To serve the already built production app, use `pnpm --filter @kbar-lit/example-angular preview`.

The standalone Angular component includes `CUSTOM_ELEMENTS_SCHEMA`, binds `[store]` to our Lit provider, and handles `(kbar-select)` as a native event. Command callbacks update Angular signals. `ngOnDestroy` removes dynamic registrations and destroys the owned store. Registration happens once in `main.ts` before Angular bootstraps.

All six command-menu components come from `kbar-lit`. Angular renders only the surrounding example and binds to the web components. The shared `@kbar-lit/example-actions` package contains demonstration actions and CSS only.

This app uses Angular's production AOT compiler and strict template checking. Its TypeScript version follows Angular's supported compiler range, independently of the library's compiler version.

See [Angular CUSTOM_ELEMENTS_SCHEMA](https://angular.dev/api/core/CUSTOM_ELEMENTS_SCHEMA) and `tests/examples/integration.spec.ts` for integration coverage.
