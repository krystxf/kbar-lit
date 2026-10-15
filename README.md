# kbar-lit

A **Lit / Web Components rewrite of [kbar](https://github.com/timc1/kbar)**. The same composable command-menu approach, with a framework-independent action store and native custom elements. No React dependency.

- Fuzzy, multi-word search across names, keywords, subtitles, and sections
- Nested actions, scoped search, and Backspace navigation
- Cmd/Ctrl+K, action shortcut sequences, arrows, Ctrl+N/P, Enter, and Escape
- Measured, virtualized results with custom Lit rendering
- Enter/exit, height, and nested-navigation animations; reduced-motion support
- Modal focus containment, focus restoration, screen-reader announcements, and document locking
- Dynamic action registration and lifecycle cleanup
- Per-store and per-command undo/redo, including asynchronous commands
- Custom portal containers, CSS customization, callbacks, and DOM events

## Run locally

Requires Node 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

The demo includes nested theme commands with undo/redo, shortcuts, async execution, and a 10,000-action stress case. This repository has not been published to npm. To use it in another local project, run `npm pack` here and install the generated tarball there.

## Compose the components

Register the elements once in your application entry point:

```ts
import 'kbar-lit/register';
import { KBarStore } from 'kbar-lit';

const store = new KBarStore(
  [
    {
      id: 'home',
      name: 'Home',
      shortcut: ['g', 'h'], // g, then h — a sequence, not alternatives
      section: 'Navigation',
      perform: () => {
        location.assign('/');
      },
    },
    { id: 'theme', name: 'Change theme', section: 'Preferences' },
    {
      id: 'dark',
      name: 'Dark theme',
      parent: 'theme',
      keywords: 'night, appearance',
      perform: () => {
        const oldTheme = document.documentElement.dataset.theme;
        document.documentElement.dataset.theme = 'dark';
        return () => {
          if (oldTheme === undefined) delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = oldTheme;
        };
      },
    },
  ],
  { enableHistory: true },
);

document.querySelector('kbar-provider')!.store = store;
document.querySelector('#open-menu')!.addEventListener('click', () => store.show());
```

```html
<button id="open-menu">Open command menu</button>
<kbar-provider>
  <kbar-portal label="Command menu">
    <kbar-positioner>
      <kbar-animator>
        <kbar-search default-placeholder="Type a command or search…"></kbar-search>
        <kbar-results max-height="400"></kbar-results>
      </kbar-animator>
    </kbar-positioner>
  </kbar-portal>
</kbar-provider>
```

In a Lit template, use property bindings for objects and functions:

```ts
html`
  <kbar-provider .actions=${actions} .options=${options}>
    <kbar-portal>
      <kbar-positioner>
        <kbar-animator>
          <kbar-search></kbar-search>
          <kbar-results .onRender=${renderResult}></kbar-results>
        </kbar-animator>
      </kbar-positioner>
    </kbar-portal>
  </kbar-provider>
`;
```

Use either an externally owned `.store` or provider-owned `.actions`/`.options`. Assigning `.actions` replaces the registry; use `registerActions()` for temporary additions. Reassign arrays/objects to trigger Lit updates.

## Convenience element

```ts
import 'kbar-lit/register';
const palette = document.createElement('kbar-palette');
palette.actions = actions;
palette.options = { enableHistory: true };
document.body.append(palette);
await palette.updateComplete;
palette.show();
```

`<kbar-palette>` composes all six elements. It exposes `.store`, `.actions`, `.options`, `.onRender`, `.placeholder`, `show()`, `hide()`, and `toggle()`. `currentStore` returns the store used by its internal provider. Named `header` and `footer` slots add content around search/results.

## Component API

| Element           | Responsibility                                                | Properties                                                                      |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `kbar-provider`   | Store, context, global shortcuts, lifecycle events            | `store`, `actions`, `options`                                                   |
| `kbar-portal`     | Top-layer dialog, focus, scroll lock, optional DOM projection | `container`, `label`, `modal` (default `true`), `disableCloseOnOuterClick`      |
| `kbar-positioner` | Full-width centered layout                                    | Standard `style` / `class`                                                      |
| `kbar-animator`   | Appearance, height and nested-navigation animations           | `disableCloseOnOuterClick`, standard `style` / `class`                          |
| `kbar-search`     | Controlled input and nested Backspace navigation              | `placeholder`, `defaultPlaceholder`, `label`; `.input` exposes the native input |
| `kbar-results`    | Virtualized listbox, keyboard/pointer selection               | `items`, `onRender`, `maxHeight`, `emptyText`                                   |

Object/function properties are JavaScript properties, not JSON attributes. Camel-case boolean properties also have kebab-case attributes, such as `disable-close-on-outer-click`.

The portal uses native `<dialog>` in the browser top layer, which escapes ancestor clipping and stacking contexts. Its optional `.container = targetElement` projects the content into another DOM container while forwarding Lit context. Removing the owner cleans up the projection. Keep the target outside the portal. Set `.modal = false` when integrating with an existing modal manager.

Search and results intentionally render into light DOM so `aria-controls` and `aria-activedescendant` resolve in the same tree scope. Keep them in the same DOM/shadow root. The convenience palette handles this automatically. Put custom non-animator panels inside an element with `data-kbar-panel` to define the outside-click boundary.

## Custom result rendering

```ts
import { html } from 'lit';
import type { RenderParams } from 'kbar-lit';

function renderResult({ item, active }: RenderParams) {
  return typeof item === 'string'
    ? html`<div class="section">${item}</div>`
    : html`
        <div class=${active ? 'command selected' : 'command'}>
          ${item.icon}<strong>${item.name}</strong>
          <small>${item.subtitle}</small>
        </div>
      `;
}
```

The wrapper owns selection semantics, pointer handlers, and actual row measurement. Your template can have variable height and does not need a ref. `items` defaults to the store's grouped results. You may supply an array of registered `ActionImpl` objects and section-name strings to reorder/filter the presentation. Section headings are not selectable. Avoid interactive descendants inside listbox options.

Icons accept text or Lit templates. String values are escaped; they are not interpreted as HTML.

## Store and actions

```ts
import { KBarStore, createAction, Priority, VisualState } from 'kbar-lit/core';

const store = new KBarStore([], { enableHistory: true });
const unregister = store.registerActions([
  createAction({ name: 'Save', priority: Priority.HIGH, perform: save }),
]);

store.show();
store.setSearch('save');
store.move(1);
await store.select(); // selects the active result
unregister(); // idempotent, removes descendants too
```

Actions support `id`, `name`, `shortcut`, `keywords`, `section`, `icon`, `subtitle`, `perform`, `parent`, and `priority`. A section is a string or `{ name, priority }`. Larger priorities sort first. Parent registration order does not matter within a batch. Duplicate IDs, missing parents, and cycles are rejected before changing the registry.

Resolved actions expose `children`, `ancestors`, `parentActionImpl`, and `command`. An action with children and no `perform` opens its submenu. Search with an empty query shows direct children; a nonempty query searches all descendants of the current root.

`store.state` is an immutable snapshot containing `open`, `visualState`, `search`, `rootId`, `activeIndex`, `disabled`, `busy`, and `error`. `groups`, `matches`, and `ancestors` are derived views. `getState()` additionally exposes kbar-compatible `searchQuery`, `currentRootActionId`, and an action dictionary.

Other methods: `setActions`, `setOptions`, `getAction`, `hide`, `toggle`, `disable`, `setRoot`, `back`, `setActiveIndex`, `setVisualState`, and `destroy`. Call `destroy()` when disposing an externally owned store permanently. The `query` facade exposes kbar-style `setSearch`, `setCurrentRootAction`, `setVisualState`, `setActiveIndex`, `registerActions`, `toggle`, `disable`, `inputRefSetter`, and `getInput`.

```ts
const unsubscribe = store.subscribe(() => updateUI(store.state));
const stopQuery = store.subscribe(
  (state) => state.searchQuery,
  (query) => searchChanged(query),
);
// Selector subscriptions use Object.is by default; a third argument can supply equality.
```

### Options

```ts
const options = {
  toggleShortcut: '$mod+k',
  animations: { enterMs: 200, exitMs: 100 },
  enableHistory: true,
  disableDocumentLock: false,
  disableScrollbarManagement: false,
  callbacks: {
    onOpen: () => {},
    onClose: () => {},
    onQueryChange: (query: string) => {},
    onSelectAction: (action: ActionImpl) => {},
  },
};
```

These are the upstream option names. Animation defaults are 200/100 ms. History is opt-in. Document locking restores existing inline styles; scrollbar compensation can be disabled separately. Runtime option changes are supported with `store.setOptions(options)` or a new provider `.options` object.

### Shortcuts

`$mod` means Command on macOS and Control elsewhere. `['g', 'h']` is a sequence; `['$mod+s']` is a chord. Single punctuation shortcuts such as `['?']` support Shift. Sequences have a 400 ms timeout. Action shortcuts are suspended while the menu is open and when typing in inputs, selects, textareas, contenteditable elements, or textbox roles, including inside shadow DOM.

Arrows and Ctrl+N/P navigate without wrapping, Enter selects, Escape closes, and empty Backspace navigates to the parent. Ctrl+Home/End jump to the first/last action. Composition events do not trigger commands. Repeated keydown events do not repeatedly toggle the menu.

### History and async commands

Return an undo function from `perform`. With history enabled, use `await store.history.undo()` / `redo()`, or `action.command.history.undo()` / `redo()` for the action's latest execution. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z work outside editable fields while the palette is closed.

Every execution gets its own history entry. New commands clear the redo stack. Failed undo/redo operations remain retryable. History is isolated per store. `undoStack`, `redoStack`, `canUndo`, `canRedo`, `add`, `remove`, and `reset` are available for custom controls.

Async `perform` functions are awaited. The store prevents duplicate execution while busy, keeps failed commands open, and exposes errors for display. Calling `store.select()` directly rejects on failure; the built-in UI catches failures and emits `kbar-error`.

## Lit controllers

`KBarController` replaces `useKBar` / `useMatches`. It subscribes to the nearest provider and requests host updates; `.store`, `.state`, `.query`, `.options`, `.matches`, and `.results` are available. Supply a store as the second constructor argument to use it without context.

```ts
class MyCommandStatus extends LitElement {
  private kbar = new KBarController(this);
  render() {
    return html`${this.kbar.matches.length} commands`;
  }
}
```

`new KBarActionsController(host, store, actions)` replaces `useRegisterActions`: it registers on connect and unregisters on disconnect. Its `setActions(actions)` method replaces that controller's registrations. Import the controllers from `kbar-lit`; the DOM-free store and types are exported from `kbar-lit/core`.

## Events

All events bubble and cross shadow boundaries:

| Event                      | Detail       |
| -------------------------- | ------------ |
| `kbar-open` / `kbar-close` | None         |
| `kbar-query-change`        | `{ search }` |
| `kbar-select`              | `{ action }` |
| `kbar-error`               | `{ error }`  |

Open/close/query events originate at the provider. Selection/error events are emitted by the built-in UI and provider shortcut execution. For direct headless store calls, use subscriptions/callbacks and catch rejected promises.

## Styling

```css
kbar-provider,
kbar-palette {
  --kbar-width: 640px;
  --kbar-background: #20242b;
  --kbar-color: #f5f5f5;
  --kbar-muted: #adb4c0;
  --kbar-border: #3c4350;
  --kbar-active-background: #343d50;
  --kbar-active-color: #fff;
  --kbar-accent: #a6b7ff;
  --kbar-radius: 14px;
  --kbar-backdrop: rgb(0 0 0 / 0.5);
  --kbar-position-padding: 14vh 16px 16px;
}
kbar-search input {
  font-size: 18px;
}
kbar-portal::part(dialog) {
  /* native dialog */
}
kbar-animator::part(content) {
  /* inner animation container */
}
```

Light-DOM search/results can be styled by ordinary selectors in their tree scope. Other elements expose their host, CSS variables, and the parts shown above. Use `.onRender` for complete row markup control. The default palette also supports `--kbar-font`.

## Parity and migration

See [PARITY.md](./PARITY.md) for the upstream mapping, covered behaviors, and intentional Web Components adaptations. This is a feature port, not a drop-in JSX API. React hooks become controllers; React nodes become Lit templates; element properties replace React props.

## Validation

```sh
npx playwright install chromium webkit
npm run check
npm run format:check
npm pack --dry-run
```

Core tests cover the action tree, search, registration, history, failures, callbacks, and animation transitions. Browser tests exercise both composed and convenience APIs in Chromium and WebKit, including axe accessibility scans, focus, shortcuts, 10,000 actions, measured custom rows, async failures, options, and portal cleanup. The [GitHub Actions template](./ci/github-actions.yml) runs the same checks on Linux. Move it to `.github/workflows/ci.yml` using a GitHub login with workflow permission to enable it. The current repository login can push code but cannot create Actions workflows.

Modern browsers with custom elements, Shadow DOM, native dialog, ResizeObserver, and Web Animations are required. The headless `core` entry point is DOM-independent; full server rendering of the UI is not provided.

## License

MIT. Based on the ideas and public behavior of Tim Chang's kbar. Its original MIT notice is retained in [LICENSE](./LICENSE). This project is independent of upstream kbar.
