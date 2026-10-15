import { LitElement, html, css } from 'lit';
import { KBarController } from './controller.js';
import { VisualState } from './types.js';
export class KBarAnimator extends LitElement {
  static properties = { disableCloseOnOuterClick: { type: Boolean, attribute: 'disable-close-on-outer-click' } };
  static styles = css`
    :host { display: block; width: var(--kbar-width, 640px); max-width: 100%; color: var(--kbar-color, #202331); background: var(--kbar-background, white); border-radius: var(--kbar-radius, 16px); box-shadow: 0 24px 80px rgb(0 0 0 / .2); overflow: hidden; }
  `;
  disableCloseOnOuterClick = false;
  private kbar = new KBarController(this);
  private visual?: VisualState;
  private root?: string | null;
  private observer?: ResizeObserver;
  private height?: number;
  private appearance?: Animation;
  private resize?: Animation;
  private outside = (event: PointerEvent) => {
    if (this.kbar.state?.open && !this.disableCloseOnOuterClick && !event.composedPath().includes(this)) this.kbar.store?.hide();
  };
  connectedCallback() { super.connectedCallback(); this.ownerDocument.addEventListener('pointerdown', this.outside); }
  disconnectedCallback() {
    super.disconnectedCallback(); this.ownerDocument.removeEventListener('pointerdown', this.outside);
    this.observer?.disconnect(); this.observer = undefined; this.appearance?.cancel(); this.resize?.cancel();
  }
  protected updated() {
    const state = this.kbar.state;
    if (!state) return;
    const reduced = this.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const enter = reduced ? 0 : this.kbar.options?.animations?.enterMs ?? 0;
    const exit = reduced ? 0 : this.kbar.options?.animations?.exitMs ?? 0;
    if (this.visual !== state.visualState) {
      this.appearance?.cancel();
      if (state.visualState === VisualState.animatingIn || state.visualState === VisualState.animatingOut) {
        this.appearance = this.animate([{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'scale(1)' }], {
          duration: state.visualState === VisualState.animatingIn ? enter : exit,
          direction: state.visualState === VisualState.animatingOut ? 'reverse' : 'normal', fill: 'both', easing: 'ease-out',
        });
      }
      this.visual = state.visualState;
    }
    if (this.root !== undefined && this.root !== state.rootId && state.open && enter) this.animate([{ transform: 'scale(1)' }, { transform: 'scale(.98)' }, { transform: 'scale(1)' }], { duration: enter });
    this.root = state.rootId;
    if (!this.observer) {
      this.observer = new ResizeObserver(entries => {
        const height = entries[0].contentRect.height;
        if (this.height && height && this.kbar.state?.open && enter) {
          this.resize?.cancel(); this.resize = this.animate([{ height: `${this.height}px` }, { height: `${height}px` }], { duration: enter / 2, easing: 'ease-out' });
        }
        this.height = height;
      });
      this.observer.observe(this.renderRoot.querySelector('div')!);
    }
  }
  protected render() { return html`<div part="content"><slot></slot></div>`; }
}
