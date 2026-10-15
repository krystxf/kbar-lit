import { LitElement, html, css } from 'lit';
import { KBarStore } from './store.js';
import type { Action, KBarOptions } from './types.js';
import type { RenderParams } from './results.js';
import type { KBarProvider } from './provider.js';

/** Convenience composition; use the individual elements for a custom layout. */
export class KBarPalette extends LitElement {
  static properties = { store: { attribute: false }, actions: { attribute: false }, options: { attribute: false }, onRender: { attribute: false }, placeholder: {} };
  static styles = css`:host { font-family: var(--kbar-font, system-ui, sans-serif); font-size: 14px; } footer { border-top: 1px solid var(--kbar-border, #e8e9ed); padding: 12px 22px; font-size: 11px; color: var(--kbar-muted, #707586); }`;
  store = new KBarStore();
  actions?: readonly Action[];
  options?: KBarOptions;
  onRender?: (params: RenderParams) => unknown;
  placeholder = 'Type a command or search…';
  show() { this.currentStore.show(); }
  hide() { this.currentStore.hide(); }
  toggle() { this.currentStore.toggle(); }
  get currentStore() { return this.renderRoot.querySelector<KBarProvider>('kbar-provider')?.store ?? this.store; }
  protected render() {
    return html`<kbar-provider .store=${this.store} .actions=${this.actions} .options=${this.options}>
      <kbar-portal><kbar-positioner><kbar-animator>
        <slot name="header"></slot>
        <kbar-search .defaultPlaceholder=${this.placeholder}></kbar-search>
        <kbar-results .onRender=${this.onRender}></kbar-results>
        <slot name="footer"><footer>↑ ↓ Navigate &nbsp; ↵ Select &nbsp; Esc Close</footer></slot>
      </kbar-animator></kbar-positioner></kbar-portal>
    </kbar-provider>`;
  }
}
