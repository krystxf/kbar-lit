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
| History                                            | Store history and per-command history; keyboard undo/redo                  | Independent stores, redo invalidation and retryable errors                       |
| Document locking                                   | Restored overflow and scrollbar compensation                               | Focus containment, dismissal, runtime options and detach cleanup                 |
| Callbacks                                          | Same `onOpen`, `onClose`, `onQueryChange`, `onSelectAction` names          | Core and browser behavior; extra composed DOM events                             |
| Accessibility                                      | Combobox/listbox, live status, focus and dialog semantics                  | Axe scans in both browsers for composed and convenience APIs                     |
| Styling / icons                                    | CSS variables, parts, host styles, light-DOM selectors, Lit icon templates | Custom rendering and desktop/mobile inspection                                   |

## Deliberate adaptations

- React hooks are replaced by Lit reactive controllers. There is no React dependency, JSX adapter, or hook shim.
- The default portal uses the browser top layer. It does not need to move content to `document.body` to escape clipping. An explicit container projects content into that target.
- Search/results use light DOM to preserve ARIA ID relationships. Other components use Shadow DOM and slots. Custom compositions must keep search and results in the same tree scope.
- `activeIndex` indexes selectable actions, excluding section strings. This avoids the upstream need for consumers to skip headings themselves.
- `store.matches` is a flat action list; `store.groups` is grouped; `controller.results` is the upstream-style mixed `(ActionImpl | string)[]` presentation.
- Registrations reject duplicate IDs and invalid trees atomically. Parents can occur after children within the same batch. This intentionally avoids upstream's silent overwrites and parent-order requirement.
- History belongs to a store instead of a shared global singleton. Repeated executions are separate undo steps. A fresh command invalidates redo, and a failed undo/redo remains retryable.
- Commands support asynchronous execution and surface errors rather than immediately dismissing the palette. Ctrl+Home/End navigation and DOM events are additions.
- `subscribe(selector, callback)` uses `Object.is` unless a custom equality function is provided. Return a stable primitive or supply equality when selecting a new object each time.
- `getInput()` returns `undefined` before the search input connects, rather than throwing. Native input properties can be set through `kbarSearch.input`.
- The deprecated hook alias and React-specific ref/portal APIs are replaced by the documented controller/element APIs. Internal React implementation classes are not replicated as compatibility shims.

Passing these tests verifies the covered behaviors; it is not a claim of byte-for-byte ranking, rendering, or undocumented upstream bug compatibility. Browser automation is supplemented by visual inspection; assistive-technology testing with real screen readers remains separate from axe scans.
