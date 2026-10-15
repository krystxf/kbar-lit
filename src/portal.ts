import { LitElement, html, css } from 'lit';
import { KBarController } from './controller.js';
import { VisualState } from './types.js';

const locks = new WeakMap<Document, { count: number; overflow: string; padding: string }>();
function lock(doc: Document, compensate: boolean) {
  const existing = locks.get(doc);
  if (existing) existing.count++;
  else {
    locks.set(doc, { count: 1, overflow: doc.body.style.overflow, padding: doc.body.style.paddingRight });
    const width = doc.defaultView!.innerWidth - doc.documentElement.clientWidth;
    if (compensate && width > 0) doc.body.style.paddingRight = `${parseFloat(doc.defaultView!.getComputedStyle(doc.body).paddingRight) + width}px`;
    doc.body.style.overflow = 'hidden';
  }
  return () => {
    const state = locks.get(doc);
    if (state && --state.count === 0) {
      doc.body.style.overflow = state.overflow; doc.body.style.paddingRight = state.padding; locks.delete(doc);
    }
  };
}
function focused(doc: Document): Element | null {
  let element = doc.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}

/** Uses the browser top layer: escapes clipping/stacking without moving context. */
export class KBarPortal extends LitElement {
  static properties = { label: {}, modal: { type: Boolean }, disableCloseOnOuterClick: { type: Boolean, attribute: 'disable-close-on-outer-click' } };
  static styles = css`
    :host { display: contents; }
    dialog { border: 0; padding: 0; margin: 0; width: 100%; height: 100%; max-width: none; max-height: none; background: transparent; color: inherit; overflow: auto; }
    dialog::backdrop { background: var(--kbar-backdrop, rgb(10 15 25 / .4)); backdrop-filter: blur(4px); }
    dialog:not([open]) { display: none; }
  `;
  label = 'Command menu';
  modal = true;
  disableCloseOnOuterClick = false;
  private kbar = new KBarController(this);
  private release?: () => void;
  private previousFocus?: HTMLElement;
  protected updated() {
    const dialog = this.renderRoot.querySelector('dialog')!;
    const visible = this.kbar.state && this.kbar.state.visualState !== VisualState.hidden;
    if (visible && !dialog.open) {
      this.previousFocus = focused(this.ownerDocument) as HTMLElement | undefined;
      if (this.modal) dialog.showModal(); else dialog.show();
      if (!this.kbar.options?.disableDocumentLock) this.release = lock(this.ownerDocument, !this.kbar.options?.disableScrollbarManagement);
      void this.updateComplete.then(() => this.kbar.query?.getInput()?.focus({ preventScroll: true }));
    } else if (!visible && dialog.open) this.close();
  }
  private close() {
    this.renderRoot.querySelector('dialog')?.close();
    this.release?.(); this.release = undefined;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = undefined;
  }
  disconnectedCallback() { super.disconnectedCallback(); this.close(); }
  private outside(event: PointerEvent) {
    if (this.disableCloseOnOuterClick) return;
    const path = event.composedPath();
    if (path.some(target => target instanceof Element && (target.localName === 'kbar-animator' || target.hasAttribute('data-kbar-panel')))) return;
    this.kbar.store?.hide();
  }
  protected render() {
    return html`<dialog part="dialog" aria-label=${this.label}
      @pointerdown=${this.outside}
      @cancel=${(event: Event) => { event.preventDefault(); this.kbar.store?.hide(); }}
      @close=${() => { if (this.kbar.state?.open) this.kbar.store?.hide(); }}><slot></slot></dialog>`;
  }
}
