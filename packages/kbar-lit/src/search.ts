import { LitElement, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { KBarController } from './controller.js';

/** Light DOM keeps aria-controls/activedescendant in the results' tree scope. */
export class KBarSearch extends LitElement {
  static properties = {
    placeholder: {},
    label: {},
    inputAttributes: { attribute: false },
    inputProperties: { attribute: false },
    defaultPlaceholder: { attribute: 'default-placeholder' },
  };
  placeholder = '';
  defaultPlaceholder = 'Type a command or search…';
  label = 'Search commands';
  /** Native input customization; palette-owned value and ARIA wiring stay managed. */
  inputAttributes: Record<string, string | boolean | null | undefined> = {};
  inputProperties: Partial<HTMLInputElement> = {};
  private originalAttributes = new Map<string, string | null>();
  private originalProperties = new Map<string, unknown>();
  private syncInputOptions() {
    const input = this.input;
    if (!input) return;
    const managed = new Set([
      'value',
      'role',
      'autocomplete',
      'spellcheck',
      'placeholder',
      'aria-expanded',
      'aria-controls',
      'aria-activedescendant',
      'aria-busy',
      'aria-autocomplete',
    ]);
    for (const [name, value] of this.originalAttributes) {
      if (!(name in this.inputAttributes)) {
        if (value === null) input.removeAttribute(name);
        else input.setAttribute(name, value);
        this.originalAttributes.delete(name);
      }
    }
    for (const [name, value] of Object.entries(this.inputAttributes)) {
      if (managed.has(name.toLowerCase())) continue;
      if (!this.originalAttributes.has(name))
        this.originalAttributes.set(name, input.getAttribute(name));
      if (value === null || value === undefined || value === false) input.removeAttribute(name);
      else input.setAttribute(name, value === true ? '' : value);
    }
    const properties = input as unknown as Record<string, unknown>;
    for (const [name, value] of this.originalProperties) {
      if (!(name in this.inputProperties)) {
        // The browser exposes -1 for absent length limits but rejects assigning it.
        if ((name === 'maxLength' || name === 'minLength') && value === -1)
          input.removeAttribute(name.toLowerCase());
        else properties[name] = value;
        this.originalProperties.delete(name);
      }
    }
    for (const [name, value] of Object.entries(this.inputProperties)) {
      if (managed.has(name.toLowerCase()) || name.startsWith('aria')) continue;
      if (!this.originalProperties.has(name)) this.originalProperties.set(name, properties[name]);
      properties[name] = value;
    }
  }
  private kbar = new KBarController(this);
  private previousRoot?: string | null;
  private composing = false;
  private wasOpen = false;
  protected createRenderRoot() {
    return this;
  }
  get input() {
    return this.querySelector('input') ?? undefined;
  }
  protected updated() {
    this.syncInputOptions();
    const store = this.kbar.store;
    if (!store) return;
    store.query.inputRefSetter(this.input);
    if (store.state.open && (this.previousRoot !== store.state.rootId || !this.wasOpen))
      this.input?.focus({ preventScroll: true });
    this.previousRoot = store.state.rootId;
    this.wasOpen = store.state.open;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.kbar.query?.getInput() === this.input) this.kbar.query?.inputRefSetter(undefined);
  }
  protected render() {
    const store = this.kbar.store;
    const state = store?.state;
    const placeholder =
      this.placeholder ||
      (state?.rootId ? store?.getAction(state.rootId)?.name : this.defaultPlaceholder);
    return html`
      <style>
        kbar-search {
          display: block;
        }
        kbar-search input {
          box-sizing: border-box;
          width: 100%;
          padding: 22px 24px;
          border: 0;
          border-bottom: 1px solid var(--kbar-border, #e8e9ed);
          outline: none;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 17px;
        }
        kbar-search input:focus-visible {
          box-shadow: inset 0 -2px var(--kbar-accent, #635bff);
        }
        kbar-search input::placeholder {
          color: var(--kbar-muted, #707586);
        }
      </style>
      <input
        part="input"
        aria-label=${this.label}
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded=${state?.open ? 'true' : 'false'}
        aria-controls=${store ? `${store.uid}-listbox` : nothing}
        aria-activedescendant=${store?.matches.length ? `${store.uid}-option-${state!.activeIndex}` : nothing}
        aria-busy=${state?.busy ? 'true' : 'false'}
        .value=${live(state?.search ?? '')}
        placeholder=${placeholder ?? ''}
        @compositionstart=${() => {
          this.composing = true;
        }}
        @compositionend=${(event: Event) => {
          this.composing = false;
          store?.setSearch((event.target as HTMLInputElement).value);
        }}
        @input=${(event: Event) => {
          if (!this.composing) store?.setSearch((event.target as HTMLInputElement).value);
        }}
        @keydown=${(event: KeyboardEvent) => {
          if (event.isComposing || this.composing) return;
          if (event.key === 'Backspace' && !this.input?.value && state?.rootId) {
            event.preventDefault();
            store?.back();
          }
        }}
      />
    `;
  }
}
