import { ActionImpl } from './action.js';
import type { Action, ActionStore } from './types.js';
import type { KBarHistory } from './history.js';

/** Public imperative action registry, corresponding to kbar's ActionInterface. */
export class ActionInterface {
  actions: ActionStore = {};
  constructor(
    actions: Action[] = [],
    readonly options: { historyManager?: KBarHistory } = {},
  ) {
    this.add(actions);
  }
  add(actions: Action[]) {
    for (const action of actions) {
      if (action.parent && !this.actions[action.parent])
        throw new Error(
          `Attempted to create action "${action.name}" without registering its parent "${action.parent}" first.`,
        );
      this.actions[action.id] = ActionImpl.create(action, {
        store: this.actions,
        history: this.options.historyManager,
      });
    }
    return { ...this.actions };
  }
  remove(actions: Action[]) {
    const remove = (action: ActionImpl) => {
      for (const child of [...action.children]) remove(child);
      action.parentActionImpl?.removeChild(action);
      delete this.actions[action.id];
    };
    actions.forEach(({ id }) => {
      const action = this.actions[id];
      if (action) remove(action);
    });
    return { ...this.actions };
  }
}
