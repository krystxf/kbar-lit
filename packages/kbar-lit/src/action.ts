import type { Action, ActionStore, HistoryItem, Undo } from './types.js';
import type { KBarHistory } from './history.js';

export class Command {
  private item?: HistoryItem;
  private execute: () => void | Undo | Promise<void | Undo>;
  private getHistory: () => KBarHistory | undefined;
  constructor(
    command:
      | (() => void | Undo | Promise<void | Undo>)
      | { perform: () => void | Undo | Promise<void | Undo> },
    options: (() => KBarHistory | undefined) | { history?: KBarHistory } = {},
  ) {
    this.execute = typeof command === 'function' ? command : command.perform;
    this.getHistory = typeof options === 'function' ? options : () => options.history;
  }
  get history() {
    const stack = this.getHistory();
    return stack && this.item
      ? {
          undo: () => (this.item ? stack.undo(this.item) : Promise.resolve()),
          redo: () => (this.item ? stack.redo(this.item) : Promise.resolve()),
        }
      : undefined;
  }
  async perform() {
    const result = this.execute();
    const undo = result instanceof Promise ? await result : result;
    const stack = this.getHistory();
    if (typeof undo === 'function' && stack) {
      if (this.item) stack.remove(this.item);
      this.item = stack.add({ perform: this.execute, negate: undo });
    }
  }
}

export interface ActionImplOptions {
  store: ActionStore;
  history?: KBarHistory;
  ancestors?: ActionImpl[];
}

/** Resolved action with tree relationships and an executable command. */
export class ActionImpl implements Action {
  readonly id: string;
  readonly name: string;
  readonly subtitle?: string;
  readonly keywords?: string;
  readonly shortcut?: string[];
  readonly section?: Action['section'];
  readonly parent?: string;
  readonly priority: number;
  readonly icon?: unknown;
  readonly command?: Command;
  readonly perform?: () => Promise<void>;
  private attachedChildren?: ActionImpl[];
  private attachedAncestors?: ActionImpl[];
  private lookup: () => ReadonlyMap<string, ActionImpl>;
  constructor(
    action: Action,
    options: (() => ReadonlyMap<string, ActionImpl>) | ActionImplOptions,
    history?: () => KBarHistory | undefined,
  ) {
    this.lookup =
      typeof options === 'function' ? options : () => new Map(Object.entries(options.store));
    if (typeof options !== 'function') history = () => options.history;
    this.id = action.id;
    this.name = action.name;
    this.subtitle = action.subtitle;
    this.keywords =
      `${action.keywords ?? ''} ${typeof action.section === 'string' ? action.section : (action.section?.name ?? '')}`.trim();
    this.shortcut = action.shortcut ? [...action.shortcut] : undefined;
    this.section = typeof action.section === 'object' ? { ...action.section } : action.section;
    this.parent = action.parent;
    this.priority = action.priority ?? 0;
    this.icon = action.icon;
    // Imperatively constructed actions own their relationships, including children
    // that have not been inserted into the caller's dictionary yet.
    if (typeof options !== 'function') {
      this.attachedChildren = [];
      this.attachedAncestors = [];
      if (action.parent) {
        const parent = options.store[action.parent];
        if (!parent) throw new Error(`Unknown parent: ${action.parent}`);
        parent.addChild(this);
      }
    }
    if (action.perform) {
      this.command = new Command(() => action.perform!(this), history);
      this.perform = () => this.command!.perform();
    }
  }
  addChild(child: ActionImpl) {
    this.attachedChildren ??= this.children;
    child.attachedAncestors ??= child.ancestors;
    child.attachedAncestors.unshift(...this.ancestors, this);
    this.attachedChildren.push(child);
  }
  removeChild(child: ActionImpl) {
    this.attachedChildren ??= this.children;
    const index = this.attachedChildren.indexOf(child);
    if (index !== -1) this.attachedChildren.splice(index, 1);
    for (const descendant of child.children) this.removeChild(descendant);
  }
  static create(action: Action, options: ActionImplOptions) {
    return new ActionImpl(action, options);
  }
  get children(): ActionImpl[] {
    if (this.attachedChildren) return this.attachedChildren;
    return [...this.lookup().values()].filter((action) => action.parent === this.id);
  }
  get parentActionImpl(): ActionImpl | undefined {
    if (this.attachedAncestors) return this.attachedAncestors.at(-1);
    return this.parent ? this.lookup().get(this.parent) : undefined;
  }
  get ancestors(): ActionImpl[] {
    if (this.attachedAncestors) return this.attachedAncestors;
    const result: ActionImpl[] = [];
    let parent = this.parentActionImpl;
    while (parent) {
      result.unshift(parent);
      parent = parent.parentActionImpl;
    }
    return result;
  }
}

export type Priority = number;
export const Priority = { HIGH: 1, NORMAL: 0, LOW: -1 } as const;
export function createAction(action: Omit<Action, 'id'>): Action {
  return { ...action, id: globalThis.crypto.randomUUID() };
}
