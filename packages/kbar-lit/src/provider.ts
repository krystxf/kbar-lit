import { LitElement, html } from 'lit';
import type { PropertyValues } from 'lit';
import { ContextProvider } from '@lit/context';
import { tinykeys } from 'tinykeys';
import type { KeybindingsMap } from 'tinykeys';
import { kbarContext } from './controller.js';
import { KBarStore } from './store.js';
import type { Action, KBarOptions } from './types.js';

function editable(event: KeyboardEvent) {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof HTMLElement &&
        (target.matches('input, textarea, select, [role="textbox"]') || target.isContentEditable),
    );
}

export class KBarProvider extends LitElement {
  static properties = {
    store: { attribute: false },
    actions: { attribute: false },
    options: { attribute: false },
  };
  store = new KBarStore();
  actions?: readonly Action[];
  options?: KBarOptions;
  private context = new ContextProvider(this, { context: kbarContext, initialValue: this.store });
  private unsubscribe?: () => void;
  private removeKeys?: () => void;
  private boundStore?: KBarStore;
  private boundActions: readonly Action[] = [];
  private wasOpen = false;
  private search = '';
  private boundOptions?: Readonly<KBarOptions>;
  connectedCallback() {
    super.connectedCallback();
    this.bind();
    this.ownerDocument.defaultView?.addEventListener('keydown', this.recoverFocus, true);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.removeKeys?.();
    this.ownerDocument.defaultView?.removeEventListener('keydown', this.recoverFocus, true);
    this.boundStore = undefined;
  }
  private recoverFocus = (event: KeyboardEvent) => {
    if (!this.store.state.open || event.isComposing) return;
    const input = this.store.query.getInput();
    if (input && !event.composedPath().includes(input)) input.focus({ preventScroll: true });
  };
  protected willUpdate(changed: PropertyValues) {
    if (changed.has('options') && this.options) this.store.setOptions(this.options);
    if (changed.has('actions') && this.actions) this.store.setActions(this.actions);
    this.context.setValue(this.store);
    this.bind();
  }
  private bind() {
    if (this.boundStore === this.store) return;
    this.unsubscribe?.();
    this.boundStore = this.store;
    this.wasOpen = this.store.state.open;
    this.search = this.store.state.search;
    this.unsubscribe = this.store.subscribe(() => {
      this.bindKeys();
      const state = this.store.state;
      if (state.open !== this.wasOpen) {
        this.wasOpen = state.open;
        this.dispatchEvent(
          new CustomEvent(state.open ? 'kbar-open' : 'kbar-close', {
            bubbles: true,
            composed: true,
          }),
        );
      }
      if (state.search !== this.search) {
        this.search = state.search;
        this.dispatchEvent(
          new CustomEvent('kbar-query-change', {
            detail: { search: state.search },
            bubbles: true,
            composed: true,
          }),
        );
      }
    });
    this.boundActions = [];
    this.bindKeys(true);
  }
  private bindKeys(force = false) {
    const actions = this.store.actions;
    if (
      !force &&
      this.boundOptions === this.store.options &&
      actions.length === this.boundActions.length &&
      actions.every((action, i) => action === this.boundActions[i])
    )
      return;
    this.boundOptions = this.store.options;
    this.boundActions = actions;
    this.removeKeys?.();
    const win = this.ownerDocument.defaultView!;
    const ignore = (event: KeyboardEvent) =>
      event.defaultPrevented || event.isComposing || event.repeat || this.store.state.disabled;
    const toggle = tinykeys(
      win,
      {
        [this.store.options.toggleShortcut ?? '$mod+k']: (event) => {
          event.preventDefault();
          this.store.toggle();
        },
        Escape: (event) => {
          if (this.store.state.open) {
            event.preventDefault();
            this.store.hide();
          }
        },
      },
      { ignore },
    );
    const map: KeybindingsMap = {};
    for (const action of [...actions].sort(
      (a, b) => (b.shortcut?.length ?? 0) - (a.shortcut?.length ?? 0),
    )) {
      if (action.shortcut?.length)
        map[
          action.shortcut
            .map((key) => (/^[^a-z0-9]$/i.test(key) ? `[Shift]+${key}` : key))
            .join(' ')
        ] = (event) => {
          event.preventDefault();
          // Global shortcuts open child groups even when the parent also has a
          // command. Selecting that same row in results executes its command.
          if (action.children.length) {
            this.store.setRoot(action.id);
            this.store.show();
          } else {
            void this.execute(action.id);
          }
        };
    }
    if (this.store.options.enableHistory) {
      map['$mod+z'] = (event) => {
        if (this.store.history.canUndo) {
          event.preventDefault();
          void this.store.history.undo().catch((error) => this.reportError(error));
        }
      };
      map['$mod+Shift+z'] = (event) => {
        if (this.store.history.canRedo) {
          event.preventDefault();
          void this.store.history.redo().catch((error) => this.reportError(error));
        }
      };
    }
    const shortcuts = tinykeys(win, map, {
      timeout: 400,
      ignore: (event) => ignore(event) || this.store.state.open || editable(event),
    });
    this.removeKeys = () => {
      toggle();
      shortcuts();
    };
  }
  private reportError(error: unknown) {
    this.dispatchEvent(
      new CustomEvent('kbar-error', { detail: { error }, bubbles: true, composed: true }),
    );
  }
  async execute(id?: string) {
    try {
      const action = await this.store.select(id);
      if (action)
        this.dispatchEvent(
          new CustomEvent('kbar-select', { detail: { action }, bubbles: true, composed: true }),
        );
    } catch (error) {
      this.reportError(error);
    }
  }
  protected render() {
    return html`<slot></slot>`;
  }
}
