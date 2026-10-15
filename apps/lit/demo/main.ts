import 'kbar-lit/register';
import { KBarStore } from 'kbar-lit';
import type { Action } from 'kbar-lit';

const activity = document.querySelector<HTMLElement>('#activity')!;
const announce = (message: string) => {
  activity.textContent = message;
};
const theme = (value: string) => {
  const previous = document.documentElement.dataset.theme ?? 'light';
  document.documentElement.dataset.theme = value;
  announce(`Switched to ${value} mode.`);
  return () => {
    document.documentElement.dataset.theme = previous;
    announce(`Restored ${previous} mode.`);
  };
};
const actions: Action[] = [
  {
    id: 'home',
    name: 'Go to home',
    subtitle: 'A fresh start',
    section: 'Navigation',
    icon: '⌂',
    shortcut: ['g', 'h'],
    perform: () => {
      announce('You are home.');
    },
  },
  {
    id: 'projects',
    name: 'Browse projects',
    subtitle: 'Pick up where you left off',
    section: 'Navigation',
    icon: '▧',
    shortcut: ['g', 'p'],
    perform: () => {
      announce('Projects opened.');
    },
  },
  {
    id: 'theme',
    name: 'Change theme',
    subtitle: 'Make yourself comfortable',
    section: 'Preferences',
    icon: '◐',
    shortcut: ['t'],
  },
  {
    id: 'light',
    name: 'Light mode',
    parent: 'theme',
    keywords: 'bright daylight',
    icon: '☼',
    perform: () => theme('light'),
  },
  {
    id: 'dark',
    name: 'Dark mode',
    parent: 'theme',
    keywords: 'night dim',
    icon: '☾',
    perform: () => theme('dark'),
  },
  {
    id: 'docs',
    name: 'Read documentation',
    subtitle: 'How the pieces fit together',
    section: 'Resources',
    icon: '↗',
    shortcut: ['?'],
    perform: () => {
      announce('See README.md for the API and composition guide.');
    },
  },
  {
    id: 'async',
    name: 'Run async command',
    subtitle: 'Loading and error handling are built in',
    section: 'Resources',
    icon: '↻',
    perform: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      announce('Async command finished.');
    },
  },
];
const store = new KBarStore(actions, {
  enableHistory: true,
  animations: { enterMs: 140, exitMs: 100 },
});
const provider = document.querySelector('kbar-provider')!;
provider.store = store;
document.querySelector('#open')!.addEventListener('click', (event) => {
  (event.currentTarget as HTMLElement).focus();
  store.show();
});
document.querySelector('#undo')!.addEventListener('click', () => {
  void store.history.undo();
});
document.querySelector('#redo')!.addEventListener('click', () => {
  void store.history.redo();
});
let unload: (() => void) | undefined;
document.querySelector('#load')!.addEventListener('click', () => {
  unload?.();
  unload = store.registerActions(
    Array.from({ length: 10_000 }, (_, index) => ({
      id: `large-${index}`,
      name: `Project ${String(index + 1).padStart(5, '0')}`,
      section: 'Projects',
      perform: () => {
        announce(`Opened project ${index + 1}.`);
      },
    })),
  );
  announce('10,000 actions loaded. Search for a project.');
  store.show();
});
// Expose the same public API used by integrations for the demo's browser tests.
Object.assign(window, { demo: { store, actions, announce } });
