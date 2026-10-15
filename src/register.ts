import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  KBarPalette,
} from './index.js';

export function registerKBar(registry: CustomElementRegistry = customElements) {
  const elements = {
    'kbar-provider': KBarProvider,
    'kbar-portal': KBarPortal,
    'kbar-positioner': KBarPositioner,
    'kbar-animator': KBarAnimator,
    'kbar-search': KBarSearch,
    'kbar-results': KBarResults,
    'kbar-palette': KBarPalette,
  };
  for (const [name, element] of Object.entries(elements))
    if (!registry.get(name)) registry.define(name, element);
}
if (typeof customElements !== 'undefined') registerKBar();
declare global {
  interface HTMLElementTagNameMap {
    'kbar-provider': KBarProvider;
    'kbar-portal': KBarPortal;
    'kbar-positioner': KBarPositioner;
    'kbar-animator': KBarAnimator;
    'kbar-search': KBarSearch;
    'kbar-results': KBarResults;
    'kbar-palette': KBarPalette;
  }
}
