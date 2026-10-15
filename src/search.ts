import { LitElement, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { KBarController } from './controller.js';

/** Light DOM keeps aria-controls/activedescendant in the results' tree scope. */
export class KBarSearch extends LitElement {
  static properties = { placeholder: {}, label: {}, defaultPlaceholder: { attribute: 'default-placeholder' } };
  placeholder = '';
  defaultPlaceholder = 'Type a command or search…';
  label = 'Search commands';
  private kbar = new KBarController(this);
  private previousRoot?: string | null;
  private composing = false;
  protected createRenderRoot() { return this; }
  get input() { return this.querySelector('input') ?? undefined; }
  protected updated() {
    const store = this.kbar.store;
    if (!store) return;
    store.query.inputRefSetter(this.input);
    if (store.state.open && this.previousRoot !== store.state.rootId) this.input?.focus({ preventScroll: true });
    this.previousRoot = store.state.rootId;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.kbar.query?.getInput() === this.input) this.kbar.query?.inputRefSetter(undefined);
  }
  protected render() {
    const store = this.kbar.store;
    const state = store?.state;
    const placeholder = this.placeholder || (state?.rootId ? store?.getAction(state.rootId)?.name : this.defaultPlaceholder);
    return html`
      <style>
        kbar-search { display: block; }
        kbar-search input { box-sizing: border-box; width: 100%; padding: 22px 24px; border: 0; border-bottom: 1px solid var(--kbar-border, #e8e9ed); outline: none; background: transparent; color: inherit; font: inherit; font-size: 17px; }
        kbar-search input:focus-visible { box-shadow: inset 0 -2px var(--kbar-accent, #635bff); }
        kbar-search input::placeholder { color: var(--kbar-muted, #707586); }
      </style>
      <input part="input" aria-label=${this.label} role="combobox" autocomplete="off" spellcheck="false"
        aria-autocomplete="list" aria-expanded=${state?.open ? 'true' : 'false'}
        aria-controls=${store ? `${store.uid}-listbox` : nothing}
        aria-activedescendant=${store?.matches.length ? `${store.uid}-option-${state!.activeIndex}` : nothing}
        aria-busy=${state?.busy ? 'true' : 'false'}
        .value=${live(state?.search ?? '')} placeholder=${placeholder ?? ''}
        @compositionstart=${() => { this.composing = true; }}
        @compositionend=${(event: Event) => { this.composing = false; store?.setSearch((event.target as HTMLInputElement).value); }}
        @input=${(event: Event) => { if (!this.composing) store?.setSearch((event.target as HTMLInputElement).value); }}
        @keydown=${(event: KeyboardEvent) => {
          if (event.isComposing || this.composing) return;
          if (event.key === 'Backspace' && !this.input?.value && state?.rootId) { event.preventDefault(); store?.back(); }
        }}>
    `;
  }
}
