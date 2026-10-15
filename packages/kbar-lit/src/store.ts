import Fuse from 'fuse.js';
import { ActionImpl } from './action.js';
import { VisualState } from './types.js';
import { KBarHistory } from './history.js';
import type { Action, ActionGroup, KBarOptions, KBarState } from './types.js';

const sectionName = (action: Action) =>
  typeof action.section === 'string' ? action.section : (action.section?.name ?? '');

export class KBarStore {
  readonly history = new KBarHistory();
  private configuration: Readonly<KBarOptions>;
  get options() {
    return this.configuration;
  }
  setOptions(options: KBarOptions) {
    this.configuration = Object.freeze({
      toggleShortcut: '$mod+k',
      animations: { enterMs: 200, exitMs: 100 },
      ...options,
    });
    this.patch({});
  }
  private animationTimer?: ReturnType<typeof setTimeout>;
  private input?: HTMLInputElement;
  readonly uid = `kbar-${globalThis.crypto.randomUUID()}`;
  readonly query = {
    setSearch: (search: string) => this.setSearch(search),
    setCurrentRootAction: (id?: string | null) => this.setRoot(id ?? null),
    setVisualState: (value: VisualState | ((state: VisualState) => VisualState)) =>
      this.setVisualState(typeof value === 'function' ? value(this.state.visualState) : value),
    setActiveIndex: (value: number | ((index: number) => number)) =>
      this.setActiveIndex(typeof value === 'function' ? value(this.state.activeIndex) : value),
    registerActions: (actions: readonly Action[]) => this.registerActions(actions),
    toggle: () => this.toggle(),
    disable: (disabled: boolean) => this.disable(disabled),
    inputRefSetter: (input?: HTMLInputElement) => {
      this.input = input;
    },
    getInput: () => this.input,
  };
  getState() {
    return {
      ...this.state,
      searchQuery: this.state.search,
      currentRootActionId: this.state.rootId,
      actions: Object.fromEntries(this.registry),
    };
  }
  private registry = new Map<string, ActionImpl>();
  private listeners = new Set<() => void>();
  private snapshot: KBarState = Object.freeze({
    open: false,
    visualState: VisualState.hidden,
    search: '',
    rootId: null,
    activeIndex: 0,
    disabled: false,
    busy: false,
    error: null,
  });
  private index?: Fuse<ActionImpl>;
  private cachedGroups?: readonly ActionGroup[];
  private cachedMatches?: readonly ActionImpl[];

  constructor(actions: readonly Action[] = [], options: KBarOptions = {}) {
    this.configuration = Object.freeze({
      toggleShortcut: '$mod+k',
      animations: { enterMs: 200, exitMs: 100 },
      ...options,
    });
    this.setActions(actions);
  }
  get state() {
    return this.snapshot;
  }
  get actions(): readonly ActionImpl[] {
    return [...this.registry.values()];
  }
  getAction(id: string) {
    return this.registry.get(id);
  }
  get children(): readonly ActionImpl[] {
    return this.actions.filter((a) => (a.parent ?? null) === this.state.rootId);
  }
  get ancestors(): readonly ActionImpl[] {
    const result: ActionImpl[] = [];
    let action = this.state.rootId ? this.getAction(this.state.rootId) : undefined;
    while (action) {
      result.unshift(action);
      action = action.parent ? this.getAction(action.parent) : undefined;
    }
    return result;
  }
  subscribe(listener: () => void): () => void;
  subscribe<T>(
    selector: (state: ReturnType<KBarStore['getState']>) => T,
    listener: (value: T) => void,
    equals?: (a: T, b: T) => boolean,
  ): () => void;
  subscribe<T>(
    selector: (() => void) | ((state: ReturnType<KBarStore['getState']>) => T),
    onChange?: (value: T) => void,
    equals = Object.is,
  ) {
    let previous = onChange ? (selector(this.getState()) as T) : undefined;
    const listener = onChange
      ? () => {
          const next = selector(this.getState()) as T;
          if (!equals(previous, next)) {
            previous = next;
            onChange(next);
          }
        }
      : (selector as () => void);
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private patch(patch: Partial<KBarState>, invalidate = false) {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    if (invalidate) {
      this.cachedGroups = undefined;
      this.cachedMatches = undefined;
    }
    this.listeners.forEach((listener) => listener());
  }
  private validated(actions: readonly Action[]) {
    const registry = new Map<string, ActionImpl>();
    for (const action of actions) {
      if (!action.id || !action.name) throw new Error('Actions require a non-empty id and name.');
      if (registry.has(action.id)) throw new Error(`Duplicate action: ${action.id}`);
      registry.set(
        action.id,
        action instanceof ActionImpl && this.registry.get(action.id) === action
          ? action
          : new ActionImpl(
              action,
              () => this.registry,
              () => (this.options.enableHistory ? this.history : undefined),
            ),
      );
    }
    for (const action of registry.values()) {
      const seen = new Set([action.id]);
      let parent = action.parent;
      while (parent) {
        if (!registry.has(parent)) throw new Error(`Unknown parent: ${parent}`);
        if (seen.has(parent)) throw new Error(`Cyclic action tree: ${action.id}`);
        seen.add(parent);
        parent = registry.get(parent)!.parent;
      }
    }
    return registry;
  }
  /** Replace atomically. Invalid trees never change the existing registry. */
  setActions(actions: readonly Action[]) {
    this.registry = this.validated(actions);
    this.index = undefined;
    this.patch(
      {
        rootId:
          this.state.rootId && this.registry.has(this.state.rootId) ? this.state.rootId : null,
        activeIndex: 0,
      },
      true,
    );
  }
  /** Returns an idempotent disposer. Disposing a parent also removes descendants. */
  registerActions(actions: readonly Action[]) {
    const next = this.validated([...this.actions, ...actions]);
    for (const [id, action] of this.registry) next.set(id, action);
    this.registry = next;
    this.index = undefined;
    this.patch({ activeIndex: 0 }, true);
    const registered = actions.map((a) => this.registry.get(a.id)!);
    return () => {
      const removed = new Set(
        registered.filter((a) => this.registry.get(a.id) === a).map((a) => a.id),
      );
      if (!removed.size) return;
      let changed = true;
      while (changed) {
        changed = false;
        for (const action of this.registry.values()) {
          if (action.parent && removed.has(action.parent) && !removed.has(action.id)) {
            removed.add(action.id);
            changed = true;
          }
        }
      }
      // Keep identities for other registrations so their disposers stay valid.
      for (const id of removed) this.registry.delete(id);
      this.index = undefined;
      this.patch(
        {
          rootId: this.state.rootId && removed.has(this.state.rootId) ? null : this.state.rootId,
          activeIndex: 0,
        },
        true,
      );
    };
  }
  private transition(visualState: VisualState) {
    clearTimeout(this.animationTimer);
    this.patch({ visualState });
    const duration =
      visualState === VisualState.animatingIn
        ? this.options.animations?.enterMs
        : this.options.animations?.exitMs;
    if (visualState === VisualState.animatingIn || visualState === VisualState.animatingOut) {
      const complete = () => {
        if (visualState === VisualState.animatingIn)
          this.patch({ visualState: VisualState.showing });
        else
          this.patch(
            { visualState: VisualState.hidden, search: '', rootId: null, activeIndex: 0 },
            true,
          );
      };
      if (duration) this.animationTimer = setTimeout(complete, duration);
      else complete();
    }
  }
  show() {
    if (this.state.disabled || this.state.open) return;
    this.patch({ open: true, error: null });
    this.transition(VisualState.animatingIn);
    this.options.callbacks?.onOpen?.();
  }
  hide() {
    if (!this.state.open) return;
    this.patch({ open: false });
    this.transition(VisualState.animatingOut);
    this.options.callbacks?.onClose?.();
  }
  setVisualState(state: VisualState) {
    if (state === VisualState.animatingIn) this.show();
    else if (state === VisualState.animatingOut) this.hide();
    else {
      clearTimeout(this.animationTimer);
      this.patch(
        {
          visualState: state,
          open: state === VisualState.showing,
          ...(state === VisualState.hidden ? { search: '', rootId: null, activeIndex: 0 } : {}),
        },
        true,
      );
    }
  }
  toggle() {
    this.state.open ? this.hide() : this.show();
  }
  disable(disabled = true) {
    this.patch({ disabled });
    if (disabled) this.hide();
  }
  setSearch(search: string) {
    if (search === this.state.search) return;
    this.patch({ search, activeIndex: 0, error: null }, true);
    this.options.callbacks?.onQueryChange?.(search);
  }
  destroy() {
    clearTimeout(this.animationTimer);
    this.listeners.clear();
    this.input = undefined;
  }
  setRoot(rootId: string | null) {
    if (rootId !== null && !this.registry.has(rootId)) throw new Error(`Unknown action: ${rootId}`);
    this.patch({ rootId, search: '', activeIndex: 0, error: null }, true);
  }
  back() {
    this.setRoot(this.state.rootId ? (this.registry.get(this.state.rootId)?.parent ?? null) : null);
  }
  setActiveIndex(index: number) {
    const length = this.matches.length;
    this.patch({
      activeIndex: length
        ? Math.max(0, Math.min(length - 1, Number.isFinite(index) ? Math.trunc(index) : 0))
        : 0,
    });
  }
  move(delta: number) {
    const length = this.matches.length;
    if (length) this.setActiveIndex(this.state.activeIndex + delta);
  }
  get groups(): readonly ActionGroup[] {
    if (this.cachedGroups) return this.cachedGroups;
    const query = this.state.search.trim();
    let ranked: { action: ActionImpl; score: number }[];
    if (!query) ranked = this.children.map((action) => ({ action, score: 0 }));
    else {
      this.index ??= new Fuse(this.actions, {
        keys: [
          { name: 'name', weight: 0.5 },
          { name: 'keywords', weight: 0.3 },
          { name: 'subtitle', weight: 0.2 },
          { name: 'section', getFn: sectionName, weight: 0.1 },
        ],
        threshold: 0.2,
        ignoreLocation: true,
        ignoreDiacritics: true,
        includeScore: true,
        useTokenSearch: true,
        tokenMatch: 'all',
      });
      ranked = this.index
        .search(query)
        .filter(({ item }) => {
          if (!this.state.rootId) return true;
          let parent = item.parent;
          while (parent) {
            if (parent === this.state.rootId) return true;
            parent = this.registry.get(parent)?.parent;
          }
          return false;
        })
        .map(({ item, score }) => ({ action: item, score: 1 - (score ?? 0) }));
    }
    ranked.sort(
      (a, b) => (b.action.priority ?? 0) + b.score - ((a.action.priority ?? 0) + a.score),
    );
    const groups = new Map<string, { name: string; priority: number; actions: ActionImpl[] }>();
    for (const { action } of ranked) {
      const name = sectionName(action);
      const priority = typeof action.section === 'object' ? action.section.priority : 0;
      if (!groups.has(name)) groups.set(name, { name, priority, actions: [] });
      const group = groups.get(name)!;
      group.priority = Math.max(group.priority, priority);
      group.actions.push(action);
    }
    this.cachedGroups = [...groups.values()].sort((a, b) => b.priority - a.priority);
    return this.cachedGroups;
  }
  get matches(): readonly ActionImpl[] {
    return (this.cachedMatches ??= this.groups.flatMap((group) => group.actions));
  }
  async select(id = this.matches[this.state.activeIndex]?.id): Promise<ActionImpl | undefined> {
    if (!id || this.state.disabled || this.state.busy) return;
    const action = this.registry.get(id);
    if (!action) return;
    if (!action.perform) {
      if (this.actions.some((a) => a.parent === id)) {
        this.setRoot(id);
        this.show();
      }
      this.options.callbacks?.onSelectAction?.(action);
      return action;
    }
    this.patch({ busy: true, error: null });
    try {
      await action.command!.perform();
      this.hide();
      this.options.callbacks?.onSelectAction?.(action);
      return action;
    } catch (error) {
      this.patch({ error });
      throw error;
    } finally {
      this.patch({ busy: false });
    }
  }
}
