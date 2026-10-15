import type { Action, HistoryItem, Undo } from './types.js';
import type { KBarHistory } from './history.js';

export class Command {
  private item?: HistoryItem;
  readonly history?: { undo: () => Promise<void>; redo: () => Promise<void> };
  constructor(private execute: () => void | Undo | Promise<void | Undo>, private stack?: KBarHistory) {
    if (stack) this.history = {
      undo: () => this.item ? stack.undo(this.item) : Promise.resolve(),
      redo: () => this.item ? stack.redo(this.item) : Promise.resolve(),
    };
  }
  async perform() {
    const undo = await this.execute();
    if (typeof undo === 'function' && this.stack) this.item = this.stack.add({ perform: this.execute, undo });
  }
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
  constructor(action: Action, private lookup: () => ReadonlyMap<string, ActionImpl>, history?: KBarHistory) {
    this.id = action.id; this.name = action.name; this.subtitle = action.subtitle;
    this.keywords = action.keywords; this.shortcut = action.shortcut ? [...action.shortcut] : undefined;
    this.section = typeof action.section === 'object' ? { ...action.section } : action.section;
    this.parent = action.parent; this.priority = action.priority ?? 0; this.icon = action.icon;
    if (action.perform) {
      this.command = new Command(() => action.perform!(this), history);
      this.perform = () => this.command!.perform();
    }
  }
  get children() { return [...this.lookup().values()].filter(action => action.parent === this.id); }
  get parentActionImpl(): ActionImpl | undefined { return this.parent ? this.lookup().get(this.parent) : undefined; }
  get ancestors(): ActionImpl[] {
    const result: ActionImpl[] = [];
    let parent = this.parentActionImpl;
    while (parent) { result.unshift(parent); parent = parent.parentActionImpl; }
    return result;
  }
}

export const Priority = { HIGH: 1, NORMAL: 0, LOW: -1 } as const;
export function createAction(action: Omit<Action, 'id'>): Action {
  return { ...action, id: globalThis.crypto.randomUUID() };
}
