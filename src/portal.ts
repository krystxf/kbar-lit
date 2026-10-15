import { LitElement, html, css } from 'lit';
import { ContextProvider } from '@lit/context';
import { kbarContext } from './controller.js';
import { KBarController } from './controller.js';
import type { KBarAnimator } from './animator.js';
import { VisualState } from './types.js';

const locks = new WeakMap<Document, { count: number; overflow: string; padding: string }>();
function lock(doc: Document, compensate: boolean) {
  const existing = locks.get(doc);
  if (existing) existing.count++;
  else {
    locks.set(doc, {
      count: 1,
      overflow: doc.body.style.overflow,
      padding: doc.body.style.paddingRight,
    });
    const width = doc.defaultView!.innerWidth - doc.documentElement.clientWidth;
    if (compensate && width > 0)
      doc.body.style.paddingRight = `${parseFloat(doc.defaultView!.getComputedStyle(doc.body).paddingRight) + width}px`;
    doc.body.style.overflow = 'hidden';
  }
  return () => {
    const state = locks.get(doc);
    if (state && --state.count === 0) {
      doc.body.style.overflow = state.overflow;
      doc.body.style.paddingRight = state.padding;
      locks.delete(doc);
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
  static properties = {
    container: { attribute: false },
    label: {},
    modal: { type: Boolean },
    disableCloseOnOuterClick: { type: Boolean, attribute: 'disable-close-on-outer-click' },
  };
  static styles = css`
    :host {
      display: contents;
    }
    dialog {
      border: 0;
      padding: 0;
      margin: 0;
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      background: transparent;
      color: inherit;
      overflow: auto;
    }
    dialog::backdrop {
      background: var(--kbar-backdrop, rgb(10 15 25 / 0.4));
      backdrop-filter: blur(4px);
    }
    dialog:not([open]) {
      display: none;
    }
  `;
  /** Optional DOM target. The owning portal retains context and cleans up the projection. */
  container?: HTMLElement;
  label = 'Command menu';
  modal = true;
  disableCloseOnOuterClick = false;
  private kbar = new KBarController(this);
  private release?: () => void;
  private previousFocus?: HTMLElement;
  private mount?: HTMLElement;
  private mountedIn?: HTMLElement;
  private projectionContext?: ContextProvider<typeof kbarContext>;
  private projected: { node: Node; anchor: Comment }[] = [];
  private get dialog() {
    return (this.mount?.shadowRoot ?? this.renderRoot).querySelector('dialog')!;
  }
  private get panel(): KBarAnimator | null {
    return (this.mount ?? this).querySelector('kbar-animator');
  }
  private project() {
    if (this.container === this.mountedIn) return;
    this.close();
    this.restore();
    if (!this.container) return;
    if (this.container === this || this.contains(this.container))
      throw new Error('Portal container must be outside the portal.');
    const mount = this.ownerDocument.createElement('div');
    mount.setAttribute('data-kbar-portal', '');
    const shadow = mount.attachShadow({ mode: 'open' });
    const style = this.ownerDocument.createElement('style');
    style.textContent = KBarPortal.styles.cssText;
    const dialog = this.ownerDocument.createElement('dialog');
    dialog.setAttribute('aria-label', this.label);
    dialog.append(this.ownerDocument.createElement('slot'));
    shadow.append(style, dialog);
    dialog.addEventListener('pointerdown', (event) => this.outside(event));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.kbar.store?.hide();
    });
    dialog.addEventListener('close', () => {
      if (this.kbar.state?.open) this.kbar.store?.hide();
    });
    for (const type of ['kbar-select', 'kbar-error'])
      mount.addEventListener(type, (event) => {
        event.stopPropagation();
        this.dispatchEvent(
          new CustomEvent(type, {
            detail: (event as CustomEvent).detail,
            bubbles: true,
            composed: true,
          }),
        );
      });
    this.projectionContext = new ContextProvider(mount, {
      context: kbarContext,
      initialValue: this.kbar.store,
    });
    this.container.append(mount);
    this.projectionContext.hostConnected();
    for (const node of [...this.childNodes]) {
      const anchor = this.ownerDocument.createComment('kbar portal projection');
      node.parentNode!.replaceChild(anchor, node);
      this.projected.push({ node, anchor });
      mount.append(node);
    }
    this.mount = mount;
    this.mountedIn = this.container;
  }
  private restore() {
    for (const { node, anchor } of this.projected) anchor.replaceWith(node);
    this.projected = [];
    this.mount?.remove();
    this.mount = undefined;
    this.mountedIn = undefined;
    this.projectionContext = undefined;
  }
  protected updated() {
    this.project();
    if (this.kbar.store) this.projectionContext?.setValue(this.kbar.store);
    const dialog = this.dialog;
    const visible = this.kbar.state && this.kbar.state.visualState !== VisualState.hidden;
    if (visible && !dialog.open) {
      this.previousFocus = focused(this.ownerDocument) as HTMLElement | undefined;
      if (this.modal) dialog.showModal();
      else dialog.show();
      if (!this.kbar.options?.disableDocumentLock)
        this.release = lock(this.ownerDocument, !this.kbar.options?.disableScrollbarManagement);
      void this.updateComplete.then(() =>
        this.kbar.query?.getInput()?.focus({ preventScroll: true }),
      );
    } else if (!visible && dialog.open) this.close();
  }
  private close() {
    this.dialog?.close();
    this.release?.();
    this.release = undefined;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = undefined;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.close();
    this.restore();
  }
  private outside(event: PointerEvent) {
    if (this.disableCloseOnOuterClick || this.panel?.disableCloseOnOuterClick) return;
    const path = event.composedPath();
    if (
      path.some(
        (target) =>
          target instanceof Element &&
          (target.localName === 'kbar-animator' || target.hasAttribute('data-kbar-panel')),
      )
    )
      return;
    this.kbar.store?.hide();
  }
  protected render() {
    return html`<dialog
      part="dialog"
      aria-label=${this.label}
      @pointerdown=${this.outside}
      @cancel=${(event: Event) => {
        event.preventDefault();
        this.kbar.store?.hide();
      }}
      @close=${() => {
        if (this.kbar.state?.open) this.kbar.store?.hide();
      }}
    >
      <slot></slot>
    </dialog>`;
  }
}
