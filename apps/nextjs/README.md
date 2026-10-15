# Next.js + kbar-lit

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @kbar-lit/example-nextjs dev
```

Open http://127.0.0.1:4201. For the production app, use `pnpm --filter @kbar-lit/example-nextjs start` after building.

This is a real Next.js App Router application. The server prerenders the page. A client component imports `kbar-lit/register` in an effect before rendering the custom elements, so custom-element registration does not execute during SSR. React 19 assigns the `store` property to `kbar-provider`; a typed element ref subscribes to its native `kbar-select` event. Cleanup unregisters dynamic actions and destroys the owned store.

All UI inside the command menu is rendered by our Lit elements. React manages only example application state and surrounding controls. `custom-elements.d.ts` supplies JSX types without a wrapper library.

The shared `@kbar-lit/example-actions` package contains only demonstration action data and CSS. There is no dependency on React kbar.

See the [Next.js App Router documentation](https://nextjs.org/docs/app) and the repository's `tests/examples/integration.spec.ts` for executable integration coverage.
