import type { HistoryItem, Undo } from './types.js';

export class HistoryItemImpl implements HistoryItem {
  perform: HistoryItem['perform'];
  negate: Undo;
  constructor(item: HistoryItem | { perform: HistoryItem['perform']; undo: Undo }) {
    this.perform = item.perform;
    this.negate = 'negate' in item ? item.negate : item.undo;
  }
  /** Convenience alias; negate is kbar's public history-item field. */
  get undo() {
    return this.negate;
  }
  static create(item: HistoryItem) {
    return new HistoryItemImpl(item);
  }
}

/** Upstream history semantics, with asynchronous and retryable operations supported. */
export class KBarHistory {
  readonly undoStack: HistoryItemImpl[] = [];
  readonly redoStack: HistoryItemImpl[] = [];
  private running = false;
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  add(item: HistoryItem | { perform: HistoryItem['perform']; undo: Undo }) {
    const entry = new HistoryItemImpl(item);
    this.undoStack.push(entry);
    return entry;
  }
  remove(item: HistoryItem) {
    const past = this.undoStack.indexOf(item as HistoryItemImpl);
    if (past !== -1) this.undoStack.splice(past, 1);
    const future = this.redoStack.indexOf(item as HistoryItemImpl);
    if (future !== -1) this.redoStack.splice(future, 1);
  }
  reset() {
    this.undoStack.splice(0);
    this.redoStack.splice(0);
  }
  async undo(item: HistoryItem | undefined = this.undoStack.at(-1)) {
    const index = this.undoStack.indexOf(item as HistoryItemImpl);
    if (this.running || !item || index === -1) return;
    this.running = true;
    try {
      const result = item.negate();
      if (result instanceof Promise) await result;
      this.undoStack.splice(index, 1);
      this.redoStack.push(item as HistoryItemImpl);
      return item;
    } finally {
      this.running = false;
    }
  }
  async redo(item: HistoryItem | undefined = this.redoStack.at(-1)) {
    const index = this.redoStack.indexOf(item as HistoryItemImpl);
    if (this.running || !item || index === -1) return;
    this.running = true;
    try {
      const result = item.perform();
      if (result instanceof Promise) await result;
      this.redoStack.splice(index, 1);
      this.undoStack.push(item as HistoryItemImpl);
      return item;
    } finally {
      this.running = false;
    }
  }
}

/** Shared across providers, as in kbar. Pass historyManager to opt into isolation. */
export const history = new KBarHistory();
