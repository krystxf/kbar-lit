import { KBarStore } from 'kbar-lit/core';

/** Shared demonstration data only. All command behavior and UI come from kbar-lit. */
export function createExampleStore(report: (message: string) => void) {
  let count = 0;
  let theme = 'light';
  return new KBarStore(
    [
      {
        id: 'home',
        name: 'Go home',
        section: 'Navigation',
        shortcut: ['g', 'h'],
        perform: () => {
          report('Home selected');
        },
      },
      { id: 'theme', name: 'Change theme', section: 'Appearance', shortcut: ['t'] },
      ...['light', 'dark'].map((value) => ({
        id: value,
        name: `${value === 'light' ? 'Light' : 'Dark'} theme`,
        parent: 'theme',
        keywords: value === 'dark' ? 'night' : 'day',
        perform: () => {
          const previous = theme;
          theme = value;
          report(`Theme: ${theme}`);
          return () => {
            theme = previous;
            report(`Theme: ${theme}`);
          };
        },
      })),
      {
        id: 'increment',
        name: 'Increment counter',
        section: 'Actions',
        subtitle: 'Return an undo function to enable history',
        perform: () => {
          count++;
          report(`Counter: ${count}`);
          return () => {
            count--;
            report(`Counter: ${count}`);
          };
        },
      },
      {
        id: 'async',
        name: 'Run async command',
        section: 'Actions',
        perform: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          report('Async command finished');
        },
      },
    ],
    { enableHistory: true, animations: { enterMs: 120, exitMs: 80 } },
  );
}
