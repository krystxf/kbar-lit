import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type {
  KBarStore,
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
} from 'kbar-lit';
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'kbar-provider': DetailedHTMLProps<HTMLAttributes<KBarProvider>, KBarProvider> & {
        store?: KBarStore;
      };
      'kbar-portal': DetailedHTMLProps<HTMLAttributes<KBarPortal>, KBarPortal>;
      'kbar-positioner': DetailedHTMLProps<HTMLAttributes<KBarPositioner>, KBarPositioner>;
      'kbar-animator': DetailedHTMLProps<HTMLAttributes<KBarAnimator>, KBarAnimator>;
      'kbar-search': DetailedHTMLProps<HTMLAttributes<KBarSearch>, KBarSearch>;
      'kbar-results': DetailedHTMLProps<HTMLAttributes<KBarResults>, KBarResults>;
    }
  }
}
