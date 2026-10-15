import { describe, it, expect, vi } from 'vitest';
import { KBarStore } from '../src/core.js';

describe('action store', () => {
  it('supports unordered trees, scoped deep search and back navigation', async () => {
    const store = new KBarStore([
      { id: 'dark', name: 'Dark theme', parent: 'theme', keywords: 'night' },
      { id: 'theme', name: 'Theme' }, { id: 'home', name: 'Dashboard' },
    ]);
    expect(store.matches.map(a => a.id)).toEqual(['theme', 'home']);
    store.setSearch('night'); expect(store.matches[0].id).toBe('dark');
    await store.select('theme'); expect(store.state.rootId).toBe('theme');
    store.setSearch('dashboard'); expect(store.matches).toHaveLength(0);
    store.back(); expect(store.state.rootId).toBeNull();
  });
  it('rejects invalid registrations atomically', () => {
    const store = new KBarStore([{ id: 'a', name: 'A' }]);
    expect(() => store.registerActions([{ id: 'a', name: 'B' }])).toThrow('Duplicate');
    expect(() => store.setActions([{ id: 'b', name: 'B', parent: 'c' }])).toThrow('Unknown parent');
    expect(() => store.setActions([{ id: 'b', name: 'B', parent: 'c' }, { id: 'c', name: 'C', parent: 'b' }])).toThrow('Cyclic');
    expect(store.matches[0].id).toBe('a');
  });
  it('cleans up independent registrations and descendants', () => {
    const store = new KBarStore();
    const removeA = store.registerActions([{ id: 'a', name: 'A' }]);
    const removeB = store.registerActions([{ id: 'b', name: 'B' }]);
    store.registerActions([{ id: 'child', name: 'Child', parent: 'a' }]);
    removeA(); removeA(); expect(store.actions.map(a => a.id)).toEqual(['b']);
    removeB(); expect(store.actions).toHaveLength(0);
  });
  it('groups by section priority and ranks actions', () => {
    const store = new KBarStore([
      { id: 'a', name: 'A', section: 'Other' },
      { id: 'b', name: 'B', section: { name: 'Important', priority: 2 } },
      { id: 'c', name: 'C', section: 'Other', priority: 10 },
    ]);
    expect(store.matches.map(a => a.id)).toEqual(['b', 'c', 'a']);
    store.move(-1); expect(store.state.activeIndex).toBe(2);
  });
  it('supports multi-field queries and diacritics', () => {
    const store = new KBarStore([{ id: 'c', name: 'Café', keywords: 'social', section: 'Places' }]);
    store.setSearch('social cafe'); expect(store.matches).toHaveLength(1);
    store.setSearch('places'); expect(store.matches).toHaveLength(1);
  });
  it('isolates history and clears redo after a new action', async () => {
    let value = 0;
    const store = new KBarStore([{ id: 'inc', name: 'Increment', perform: () => { value++; return () => { value--; }; } }], { enableHistory: true });
    await store.select('inc'); await store.select('inc'); expect(value).toBe(2);
    await store.history.undo(); expect(value).toBe(1);
    await store.history.redo(); expect(value).toBe(2);
    await store.history.undo(); await store.select('inc'); expect(store.history.canRedo).toBe(false);
    expect(new KBarStore().history.canUndo).toBe(false);
  });
  it('keeps failed actions open, reports errors, and prevents concurrent execution', async () => {
    let finish!: () => void;
    const perform = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const store = new KBarStore([{ id: 'a', name: 'A', perform }]);
    const first = store.select('a'); await store.select('a'); expect(perform).toHaveBeenCalledTimes(1);
    finish(); await first; expect(store.state.busy).toBe(false);
    store.setActions([{ id: 'b', name: 'B', perform: () => { throw new Error('Oops'); } }]);
    store.show(); await expect(store.select('b')).rejects.toThrow('Oops');
    expect(store.state.open).toBe(true); expect(store.state.error).toBeInstanceOf(Error);
  });
  it('notifies subscribers and honors disabled state', () => {
    const store = new KBarStore(); const listener = vi.fn(); const off = store.subscribe(listener);
    store.show(); expect(listener).toHaveBeenCalledTimes(1); off(); store.hide();
    expect(listener).toHaveBeenCalledTimes(1); store.disable(); store.show(); expect(store.state.open).toBe(false);
  });
});
