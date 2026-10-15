import type { KBarStore } from './store.js';
export async function executeAction(host: HTMLElement, store: KBarStore, id?: string) {
  try {
    const action = await store.select(id);
    if (action) host.dispatchEvent(new CustomEvent('kbar-select', { detail: { action }, bubbles: true, composed: true }));
  } catch (error) {
    host.dispatchEvent(new CustomEvent('kbar-error', { detail: { error }, bubbles: true, composed: true }));
  }
}
