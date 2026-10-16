import React, { useContext, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  KBarContext,
  useKBar,
  useMatches,
  history as referenceHistory,
  Command as ReferenceCommand,
  ActionInterface as ReferenceActionInterface,
} from '@kbar-lit/parity-oracle';
import {
  KBarStore,
  KBarHistory,
  Command,
  history as litHistory,
  ActionInterface as LitActionInterface,
} from 'kbar-lit';
import 'kbar-lit/register';

const events = [];
let value = 0;
const perform = () => {
  value++;
  return () => {
    value--;
  };
};
const actions = [
  { id: 'home', name: 'Home', section: 'Navigation', shortcut: ['g', 'h'], perform },
  {
    id: 'cafe',
    name: 'Café search',
    keywords: 'social, drinks',
    subtitle: 'Find a coffee shop',
    section: 'Places',
    perform,
  },
  { id: 'theme', name: 'Theme', section: { name: 'Preferences', priority: 2 }, shortcut: ['t'] },
  { id: 'light', name: 'Light appearance', parent: 'theme', keywords: 'day', perform },
  { id: 'dark', name: 'Dark appearance', parent: 'theme', keywords: 'night', perform },
  {
    id: 'urgent',
    name: 'Search settings',
    section: 'Navigation',
    priority: 1,
    subtitle: 'Open search preferences',
    perform,
  },
  { id: 'plain', name: 'Unsectioned action', perform },
];
const options = {
  enableHistory: true,
  animations: { enterMs: 0, exitMs: 0 },
  callbacks: {
    onOpen: () => events.push('open'),
    onClose: () => events.push('close'),
    onQueryChange: (query) => events.push(`query:${query}`),
    onSelectAction: (action) => events.push(`select:${action.id}`),
  },
};
const serialize = (items) =>
  items.map((item) => (typeof item === 'string' ? `section:${item}` : item.id));
const engine = new URLSearchParams(location.search).get('engine') ?? 'lit';
function installAPI(getState, getResults, query, history) {
  window.parity = {
    clearEvents: () => {
      events.length = 0;
    },
    snapshot: () => ({
      results: serialize(getResults()),
      activeIndex: getState().activeIndex,
      root: getState().currentRootActionId ?? null,
      search: getState().searchQuery,
      visualState: getState().visualState,
      events: [...events],
      value,
    }),
    search: (value) => query.setSearch(value),
    root: (value) => query.setCurrentRootAction(value),
    setIndex: (value) => query.setActiveIndex(value),
    register: (values) => {
      window.unregister = query.registerActions(values.map((action) => ({ ...action, perform })));
    },
    unregister: () => window.unregister?.(),
    execute: async (id) => {
      await getState().actions[id].command.perform();
    },
    undo: async () => {
      await history.undo();
    },
    redo: async () => {
      await history.redo();
    },
    history: () => ({ undo: history.undoStack.length, redo: history.redoStack.length, value }),
    subscribeObject: () => {
      let count = 0;
      const dispose = window.parityContext.subscribe(
        (state) => ({ search: state.searchQuery }),
        () => count++,
      );
      window.subscription = { count: () => count, dispose };
    },
  };
  document.querySelector('#open').onclick = () => query.toggle();
}
function Probe() {
  const context = useContext(KBarContext);
  useKBar((state) => state);
  const { results } = useMatches();
  useEffect(() => {
    window.parityContext = context;
    installAPI(context.getState, () => results, context.query, referenceHistory);
  });
  return (
    <KBarPortal>
      <KBarPositioner>
        <KBarAnimator style={{ width: 600, background: 'white' }}>
          <KBarSearch />
          <KBarResults
            items={results}
            onRender={({ item }) => (
              <div style={{ padding: 15 }}>{typeof item === 'string' ? item : item.name}</div>
            )}
          />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}
if (engine === 'react') {
  referenceHistory.reset();
  createRoot(document.querySelector('#root')).render(
    <KBarProvider actions={actions} options={options}>
      <Probe />
    </KBarProvider>,
  );
} else {
  const store = new KBarStore(actions, options);
  document.querySelector('#root').innerHTML =
    '<kbar-provider><kbar-portal><kbar-positioner><kbar-animator><kbar-search></kbar-search><kbar-results></kbar-results></kbar-animator></kbar-positioner></kbar-portal></kbar-provider>';
  document.querySelector('kbar-provider').store = store;
  window.parityContext = store;
  installAPI(
    () => store.getState(),
    () =>
      store.groups.flatMap((group) =>
        group.name ? [group.name, ...group.actions] : group.actions,
      ),
    store.query,
    store.history,
  );
}

window.historyScenario = () => {
  const stack = engine === 'react' ? referenceHistory : litHistory;
  const Constructor = engine === 'react' ? ReferenceCommand : Command;
  stack.reset();
  let value = 0;
  const a = new Constructor(
    {
      perform: () => {
        value += 1;
        return () => {
          value -= 1;
        };
      },
    },
    { history: stack },
  );
  const b = new Constructor(
    {
      perform: () => {
        value += 10;
        return () => {
          value -= 10;
        };
      },
    },
    { history: stack },
  );
  const frames = [];
  const capture = () =>
    frames.push({ value, undo: stack.undoStack.length, redo: stack.redoStack.length });
  a.perform();
  capture();
  b.perform();
  capture();
  stack.undo();
  capture();
  a.perform();
  capture();
  stack.redo();
  capture();
  a.history.undo();
  capture();
  return frames;
};
window.registryScenario = () => {
  const Constructor = engine === 'react' ? ReferenceActionInterface : LitActionInterface;
  const registry = new Constructor([
    { id: 'parent', name: 'Parent', section: 'Section' },
    { id: 'child', name: 'Child', parent: 'parent' },
    { id: 'grandchild', name: 'Grandchild', parent: 'child' },
  ]);
  const metadata = {
    keywords: registry.actions.parent.keywords,
    children: registry.actions.parent.children.map((a) => a.id),
    ancestors: registry.actions.grandchild.ancestors.map((a) => a.id),
  };
  registry.add([{ id: 'child', name: 'Changed child', parent: 'parent' }]);
  const name = registry.actions.child.name;
  registry.remove([{ id: 'parent', name: 'Parent' }]);
  return { metadata, name, remaining: Object.keys(registry.actions) };
};
