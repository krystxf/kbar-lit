import type { HistoryItem } from './types.js';

/** History belongs to one store. Failed operations leave both stacks intact. */
export class KBarHistory {
  private past: HistoryItem[] = [];
  private future: HistoryItem[] = [];
  private running = false;
  get undoStack(): readonly HistoryItem[] { return this.past; }
  get redoStack(): readonly HistoryItem[] { return this.future; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  add(item: HistoryItem) { this.past.push(item); this.future = []; return item; }
  remove(item: HistoryItem) {
    this.past = this.past.filter(entry => entry !== item);
    this.future = this.future.filter(entry => entry !== item);
  }
  reset() { this.past = []; this.future = []; }
  async undo(item = this.past.at(-1)) {
    if (this.running || !item || !this.past.includes(item)) return;
    this.running = true;
    try {
      await item.undo();
      this.past = this.past.filter(entry => entry !== item);
      this.future.push(item);
    } finally { this.running = false; }
  }
  async redo(item = this.future.at(-1)) {
    if (this.running || !item || !this.future.includes(item)) return;
    this.running = true;
    try {
      const inverse = await item.perform();
      if (typeof inverse === 'function') item.undo = inverse;
      this.future = this.future.filter(entry => entry !== item);
      this.past.push(item);
    } finally { this.running = false; }
  }
}
