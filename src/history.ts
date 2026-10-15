import type { HistoryItem } from './types.js';

/** History belongs to one store. Failed operations leave both stacks intact. */
export class KBarHistory {
  private past: HistoryItem[] = [];
  private future: HistoryItem[] = [];
  private running = false;
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  add(item: HistoryItem) { this.past.push(item); this.future = []; }
  reset() { this.past = []; this.future = []; }
  async undo() {
    if (this.running || !this.canUndo) return;
    this.running = true;
    const item = this.past.at(-1)!;
    try { await item.undo(); this.past.pop(); this.future.push(item); }
    finally { this.running = false; }
  }
  async redo() {
    if (this.running || !this.canRedo) return;
    this.running = true;
    const item = this.future.at(-1)!;
    try {
      const inverse = await item.perform();
      if (typeof inverse === 'function') item.undo = inverse;
      this.future.pop(); this.past.push(item);
    } finally { this.running = false; }
  }
}
