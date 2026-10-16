import { beforeEach, describe, it, expect, vi } from 'vitest';
import { VisualState, KBarStore, KBarHistory, history } from '../src/core.js';

beforeEach(() => history.reset());

describe('action store', () => {
  it('supports unordered trees, scoped deep search and back navigation', async () => {
    const store = new KBarStore([
      { id: 'dark', name: 'Dark theme', parent: 'theme', keywords: 'night' },
      { id: 'theme', name: 'Theme' },
      { id: 'home', name: 'Dashboard' },
    ]);
    expect(store.matches.map((a) => a.id)).toEqual(['theme', 'home']);
    store.setSearch('night');
    expect(store.matches[0].id).toBe('dark');
    await store.select('theme');
    expect(store.state.rootId).toBe('theme');
    store.setSearch('dashboard');
    expect(store.matches).toHaveLength(0);
    store.back();
    expect(store.state.rootId).toBeNull();
  });
  it('rejects invalid registrations atomically', () => {
    const store = new KBarStore([{ id: 'a', name: 'A' }]);
    store.registerActions([{ id: 'a', name: 'B' }]);
    expect(store.getAction('a')!.name).toBe('B');
    expect(() => store.setActions([{ id: 'b', name: 'B', parent: 'c' }])).toThrow('Unknown parent');
    expect(() =>
      store.setActions([
        { id: 'b', name: 'B', parent: 'c' },
        { id: 'c', name: 'C', parent: 'b' },
      ]),
    ).toThrow('Cyclic');
    expect(store.matches[0].id).toBe('a');
  });
  it('cleans up independent registrations and descendants', () => {
    const store = new KBarStore();
    const removeA = store.registerActions([{ id: 'a', name: 'A' }]);
    const removeB = store.registerActions([{ id: 'b', name: 'B' }]);
    store.registerActions([{ id: 'child', name: 'Child', parent: 'a' }]);
    removeA();
    removeA();
    expect(store.actions.map((a) => a.id)).toEqual(['b']);
    removeB();
    expect(store.actions).toHaveLength(0);
  });
  it('groups by section priority and ranks actions', () => {
    const store = new KBarStore([
      { id: 'a', name: 'A', section: 'Other' },
      { id: 'b', name: 'B', section: { name: 'Important', priority: 2 } },
      { id: 'c', name: 'C', section: 'Other', priority: 10 },
    ]);
    expect(store.matches.map((a) => a.id)).toEqual(['b', 'c', 'a']);
    store.move(-1);
    expect(store.state.activeIndex).toBe(1);
    store.move(20);
    expect(store.state.activeIndex).toBe(4);
  });
  it('supports multi-field queries and diacritics', () => {
    const store = new KBarStore([{ id: 'c', name: 'Café', keywords: 'social', section: 'Places' }]);
    store.setSearch('social cafe');
    expect(store.matches).toHaveLength(1);
    store.setSearch('places');
    expect(store.matches).toHaveLength(1);
  });
  it('shares default history and replaces the repeated command history entry', async () => {
    let value = 0;
    const store = new KBarStore(
      [
        {
          id: 'inc',
          name: 'Increment',
          perform: () => {
            value++;
            return () => {
              value--;
            };
          },
        },
      ],
      { enableHistory: true },
    );
    await store.select('inc');
    await store.select('inc');
    expect(value).toBe(2);
    await store.history.undo();
    expect(value).toBe(1);
    await store.history.redo();
    expect(value).toBe(2);
    await store.history.undo();
    await store.select('inc');
    expect(store.history.canRedo).toBe(false);
    expect(new KBarStore().history.canUndo).toBe(true);
    expect(new KBarStore([], { historyManager: new KBarHistory() }).history.canUndo).toBe(false);
  });
  it('keeps failed actions open, reports errors, and prevents concurrent execution', async () => {
    let finish!: () => void;
    const perform = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const store = new KBarStore([{ id: 'a', name: 'A', perform }]);
    const first = store.select('a');
    await store.select('a');
    expect(perform).toHaveBeenCalledTimes(1);
    finish();
    await first;
    expect(store.state.busy).toBe(false);
    store.setActions([
      {
        id: 'b',
        name: 'B',
        perform: () => {
          throw new Error('Oops');
        },
      },
    ]);
    store.show();
    await expect(store.select('b')).rejects.toThrow('Oops');
    expect(store.state.open).toBe(true);
    expect(store.state.error).toBeInstanceOf(Error);
  });
  it('notifies subscribers and honors disabled state', () => {
    const store = new KBarStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.show();
    expect(listener).toHaveBeenCalled();
    off();
    listener.mockClear();
    store.hide();
    expect(listener).not.toHaveBeenCalled();
    store.disable();
    store.show();
    expect(store.state.open).toBe(false);
  });
});

describe('kbar compatibility', () => {
  it('completes and interrupts visual transitions without stale timers', () => {
    vi.useFakeTimers();
    const onOpen = vi.fn(),
      onClose = vi.fn();
    const store = new KBarStore([], {
      animations: { enterMs: 100, exitMs: 50 },
      callbacks: { onOpen, onClose },
    });
    store.show();
    expect(store.state.visualState).toBe(VisualState.animatingIn);
    store.hide();
    vi.advanceTimersByTime(50);
    expect(store.state.visualState).toBe(VisualState.hidden);
    store.show();
    vi.advanceTimersByTime(100);
    expect(store.state.visualState).toBe(VisualState.showing);
    store.hide();
    store.show();
    vi.advanceTimersByTime(100);
    expect(store.state.open).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onClose).toHaveBeenCalledTimes(2);
    store.destroy();
    vi.useRealTimers();
  });
  it('exposes action relationships, commands, and targeted history', async () => {
    let value = 0;
    const store = new KBarStore(
      [
        { id: 'parent', name: 'Parent' },
        {
          id: 'a',
          name: 'A',
          parent: 'parent',
          perform: (action) => {
            expect(action.ancestors[0].id).toBe('parent');
            value++;
            return () => {
              value--;
            };
          },
        },
        {
          id: 'b',
          name: 'B',
          perform: () => {
            value += 10;
            return () => {
              value -= 10;
            };
          },
        },
      ],
      { enableHistory: true },
    );
    const a = store.getAction('a')!;
    expect(store.getAction('parent')!.children).toEqual([a]);
    await store.select('a');
    await store.select('b');
    await a.command!.history!.undo();
    expect(value).toBe(10);
    await a.command!.history!.redo();
    expect(value).toBe(11);
  });
  it('keeps failed undo operations retryable', async () => {
    let fail = true;
    const store = new KBarStore(
      [
        {
          id: 'a',
          name: 'A',
          perform: () => () => {
            if (fail) throw new Error('retry');
          },
        },
      ],
      { enableHistory: true },
    );
    await store.select('a');
    await expect(store.history.undo()).rejects.toThrow('retry');
    expect(store.history.canUndo).toBe(true);
    fail = false;
    await store.history.undo();
    expect(store.history.canRedo).toBe(true);
  });
});
