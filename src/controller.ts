import { ContextConsumer, createContext } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { KBarStore } from './store.js';
import type { Action } from './types.js';

export const kbarContext = createContext<KBarStore>(Symbol.for('kbar-lit.store'));
/** Lit counterpart of useKBar: subscribes on connect and cleans up on disconnect. */
export class KBarController implements ReactiveController {
  store?: KBarStore;
  private unsubscribe?: () => void;
  constructor(private host: ReactiveControllerHost & HTMLElement, store?: KBarStore) {
    host.addController(this);
    if (store) this.store = store;
    else new ContextConsumer(host, {
      context: kbarContext, subscribe: true,
      callback: value => { this.unsubscribe?.(); this.store = value; this.listen(); },
    });
  }
  private listen() {
    this.unsubscribe?.();
    this.unsubscribe = this.store?.subscribe(() => this.host.requestUpdate());
    this.host.requestUpdate();
  }
  hostConnected() { if (this.store) this.listen(); }
  hostDisconnected() { this.unsubscribe?.(); }
  get state() { return this.store?.state; }
  get query() { return this.store?.query; }
  get options() { return this.store?.options; }
  get matches() { return this.store?.matches ?? []; }
  get results() { return this.store?.groups.flatMap(group => group.name ? [group.name, ...group.actions] : [...group.actions]) ?? []; }
}
/** Lifecycle-managed counterpart of useRegisterActions. */
export class KBarActionsController implements ReactiveController {
  private unregister?: () => void;
  private connected = false;
  constructor(host: ReactiveControllerHost, private store: KBarStore, private actions: readonly Action[]) { host.addController(this); }
  hostConnected() { this.connected = true; this.unregister = this.store.registerActions(this.actions); }
  hostDisconnected() { this.connected = false; this.unregister?.(); this.unregister = undefined; }
  setActions(actions: readonly Action[]) {
    this.unregister?.(); this.actions = actions;
    if (this.connected) this.unregister = this.store.registerActions(actions);
  }
}
