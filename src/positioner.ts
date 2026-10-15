import { LitElement, html, css } from 'lit';
export class KBarPositioner extends LitElement {
  static styles = css`
    :host { box-sizing: border-box; display: flex; align-items: flex-start; justify-content: center; min-height: 100%; width: 100%; padding: var(--kbar-position-padding, 14vh 16px 16px); }
  `;
  protected render() { return html`<slot></slot>`; }
}
