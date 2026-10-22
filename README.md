# kbar-lit monorepo

A **Lit / Web Components rewrite of [timc1/kbar](https://github.com/timc1/kbar)**, the original command-menu project by Tim Chang. This project adapts kbar to Lit and provides framework integration examples. All examples consume the **same `kbar-lit` workspace package**. They do not use React kbar or reimplement the command menu.

The repository uses **pnpm and Turborepo** for dependency management, builds, development, and validation. The library implements the feature set of the pinned upstream kbar reference with Lit components and controllers. The [parity audit](./PARITY.md) maps each feature to its implementation and validation, and documents the framework adaptations.

## Workspace

| Path                       | Purpose                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `packages/kbar-lit`        | Published-package layout: Lit components, controllers, headless store, unit tests       |
| `packages/example-actions` | Shared demonstration actions and CSS; no command-menu implementation                    |
| `apps/lit`                 | Original demo, custom rendering, async commands and 10,000 actions                      |
| `apps/nextjs`              | Next.js App Router, client-only registration, React state and native events             |
| `apps/angular`             | Standalone Angular application, schema/property bindings, signals and lifecycle cleanup |
| `apps/vue`                 | Vue SFC application, custom-element compiler configuration, property binding and refs   |
| `tests/browser`            | Library browser behavior and accessibility checks                                       |
| `tests/examples`           | Production framework integration checks                                                 |

## Start

Use Node 24+ and pnpm 12.11.2 (pinned in `packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

`pnpm dev` runs the library watch builds and all examples through Turborepo. To run only one example after building the workspace:

```sh
pnpm --filter @kbar-lit/example-lit dev      # http://127.0.0.1:5173
pnpm --filter @kbar-lit/example-nextjs dev   # http://127.0.0.1:4201
pnpm --filter @kbar-lit/example-vue dev      # http://127.0.0.1:4202
pnpm --filter @kbar-lit/example-angular dev  # http://127.0.0.1:4203
```

The framework apps demonstrate composition of provider → portal → positioner → animator → search/results, nested actions, asynchronous commands, dynamic registration, undo/redo, and native selection events updating framework state.

## Library API

See the [library guide](./packages/kbar-lit/README.md) for the component API, Lit templates, actions, shortcuts, custom rendering, styling, controllers, history, and headless integration.

```ts
import 'kbar-lit/register';
import { KBarStore } from 'kbar-lit';

const store = new KBarStore([
  { id: 'home', name: 'Home', shortcut: ['g', 'h'], perform: () => location.assign('/') },
]);
document.querySelector('kbar-provider')!.store = store;
```

```html
<kbar-provider>
  <kbar-portal>
    <kbar-positioner>
      <kbar-animator>
        <kbar-search></kbar-search>
        <kbar-results></kbar-results>
      </kbar-animator>
    </kbar-positioner>
  </kbar-portal>
</kbar-provider>
```

Framework-specific explanations: [Next.js](./apps/nextjs/README.md), [Angular](./apps/angular/README.md), [Vue](./apps/vue/README.md).

## Validate

```sh
pnpm exec playwright install chromium webkit
pnpm check
pnpm format:check
pnpm --filter kbar-lit pack --out /tmp/kbar-lit.tgz
```

`pnpm check` runs workspace type checks, unit tests, production builds, library browser tests, production integration tests for all three frameworks, direct comparisons against a pinned test-only upstream fixture, and installation/type checks of the packed library in an isolated consumer. The browser suites run in Chromium and WebKit and include axe accessibility scans. Each framework integration test checks that the registered Lit element is mounted, executes actions, verifies state/event updates, and exercises undo/redo and dynamic actions.

Turborepo caches package builds and type checks in dependency order. Browser tests are always executed against running apps, not cached results. `pnpm test:examples` expects `pnpm build` to have completed first.

A [GitHub Actions template](./ci/github-actions.yml) is included. Enabling it requires moving it to `.github/workflows/ci.yml` with a GitHub login that can create workflows; the repository's current login can push code but lacks that permission.

## License

MIT. The original kbar notice is retained in [LICENSE](./LICENSE). This project is independent of upstream kbar.

## Deploy all examples as one site

```sh
pnpm build:site
pnpm preview:site
```

Open http://127.0.0.1:4300 for the contents page. The deployment contains
`/angular/`, `/react/` (Next.js static export), `/vue/`, and `/lit/`.
Turborepo builds each app and its shared dependencies, then the assembly script
copies the results and landing page into `dist/site`.

Vercel configuration is included in `vercel.json`. Import this repository into
Vercel and use the repository root as the Root Directory. The configuration
uses `pnpm build:site`, publishes `dist/site`, and routes Angular and Vue deep
links to their respective entry pages. The framework preset is set to Other
(`framework: null`) because this deployment combines multiple frameworks.
For another static host, upload the contents of `dist/site`, serve directory
`index.html` files, and configure Angular and Vue deep links to fall back to
`/angular/index.html` and `/vue/index.html` respectively (after checking for real
files). Next.js exports its own route HTML. The React deployment is static;
server-only Next.js features require a different hosting setup.

Edit `site/index.html` to update the contents page. The regular `pnpm build`
and individual development commands continue to use the apps' root URLs.
Run the appropriate build again when switching between standalone previews and
the combined site, since their app build directories are shared.
