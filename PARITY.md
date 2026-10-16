# kbar feature parity

Reference: [timc1/kbar at 26ec0f4](https://github.com/timc1/kbar/tree/26ec0f49f92ab34fa6ab59392782d56020f28098), inspected October 15, 2026. The target is the same feature set and compositional approach in Lit, rather than React API compatibility.

| Upstream                                           | Lit counterpart                                                            | Verification                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `KBarProvider`                                     | `kbar-provider`, `KBarStore`, Lit context                                  | Composed UI, runtime actions/options, reconnect tests                            |
| `KBarPortal` / `container`                         | `kbar-portal`, native top-layer dialog, `.container` projection            | Custom container, context, cleanup and focus tests                               |
| `KBarPositioner`                                   | `kbar-positioner`                                                          | Desktop/mobile visual inspection; host/CSS overrides                             |
| `KBarAnimator`                                     | `kbar-animator`                                                            | Visual-state tests; appearance, height and nested animations; reduced motion     |
| `KBarSearch`                                       | `kbar-search`                                                              | Query, placeholder, nested Backspace, IME, focus tests                           |
| `KBarResults` / `items` / `onRender` / `maxHeight` | `kbar-results`                                                             | 10,000 items, custom variable-height row measurement, keyboard/pointer selection |
| `useKBar`                                          | `KBarController`, store subscriptions/query facade                         | Store subscriptions and browser context consumers                                |
| `useMatches` / `useDeepMatches`                    | `controller.results`, `store.groups` / `matches`                           | Fuzzy multi-word, diacritic, section and descendant search tests                 |
| `useRegisterActions`                               | `KBarActionsController`, `registerActions` disposer                        | Dynamic registration/disposal and reconnect behavior                             |
| Action schema, `createAction`, `Priority`          | Matching fields and exported helpers                                       | Tree, priority, grouping, registration tests                                     |
| `ActionImpl` and `Command`                         | Resolved actions with relationships and command/history APIs               | Tree and targeted undo/redo tests                                                |
| `VisualState`                                      | Same four enum values and configurable transitions                         | Fake-timer interruption/completion tests                                         |
| Keyboard shortcuts                                 | `$mod+k`, custom chords and sequences                                      | Chromium and WebKit; typing guard, punctuation, nested group shortcut            |
| Keyboard navigation                                | Arrows, Ctrl+N/P, Enter, Escape, Backspace                                 | Both browsers; IME suppression and section skipping                              |
| History                                            | Store history and per-command history; keyboard undo/redo                  | Shared default history, repeated-command replacement and targeted undo/redo      |
| Document locking                                   | Restored overflow and scrollbar compensation                               | Focus containment, dismissal, runtime options and detach cleanup                 |
| Callbacks                                          | Same `onOpen`, `onClose`, `onQueryChange`, `onSelectAction` names          | Core and browser behavior; extra composed DOM events                             |
| Accessibility                                      | Combobox/listbox, live status, focus and dialog semantics                  | Axe scans in both browsers for composed and convenience APIs                     |
| Styling / icons                                    | CSS variables, parts, host styles, light-DOM selectors, Lit icon templates | Custom rendering and desktop/mobile inspection                                   |

## Deliberate adaptations

- React hooks are replaced by Lit reactive controllers. There is no React dependency, JSX adapter, or hook shim.
- The default portal uses the browser top layer. It does not need to move content to `document.body` to escape clipping. An explicit container projects content into that target.
- Search/results use light DOM to preserve ARIA ID relationships. Other components use Shadow DOM and slots. Custom compositions must keep search and results in the same tree scope.
- `activeIndex` indexes the mixed results array, including section strings, as upstream does. Keyboard navigation skips section rows.
- `store.matches` is a flat action list; `store.groups` is grouped; `controller.results` is the upstream-style mixed `(ActionImpl | string)[]` presentation.
- Registrations replace existing IDs as upstream does. Store registrations validate invalid trees atomically and allow parents after children within a batch.
- History uses a shared singleton by default, replaces the previous entry for repeated execution of a command, and preserves unrelated redo entries, matching upstream. An explicit `historyManager` can isolate stores; failed undo/redo remains retryable.
- Commands support asynchronous execution and surface errors rather than immediately dismissing the palette. Ctrl+Home/End navigation and DOM events are additions.
- `subscribe(selector, callback)` uses structural equality as upstream does. A custom equality function is also supported.
- `getInput()` returns `undefined` before the search input connects, rather than throwing. Native input properties can be set through `kbarSearch.input`.
- The deprecated hook alias and React-specific ref/portal APIs are replaced by the documented controller/element APIs. Internal React implementation classes are not replicated as compatibility shims.

Passing these tests verifies the covered behaviors; it is not a claim of byte-for-byte ranking, rendering, or undocumented upstream bug compatibility. Browser automation is supplemented by visual inspection; assistive-technology testing with real screen readers remains separate from axe scans.

## Direct comparison status

`pnpm test:parity` runs the pinned React source and Lit implementation in separate pages in Chromium and WebKit. It compares grouped indices, weighted fuzzy ranking (including a generated 90-action dataset), duplicate registration, object subscriptions, command history, imperative registries and tree attachment/removal, callbacks, and shortcut precedence for parents with both commands and children. The reference is test-only: all four example applications use `kbar-lit`. `pnpm verify:parity` checks fixture hashes and transitive workspace dependency isolation.

The full parity audit remains in progress. Passing comparisons establish their covered behaviors, not completion of the entire API and interaction audit. Imperative tree mutation, native input customization, and controller lifecycle are now covered. Remaining audit areas include focus recovery after input blur, final package/export checks, and the complete option/interaction matrix.

The pinned React implementation can retain a stale active element when search results change: searching “night” and pressing Enter selected “light” in the comparison fixture. Lit selects the currently displayed “dark” result. Callback comparisons use pointer selection to avoid treating that upstream bug as a target behavior.
