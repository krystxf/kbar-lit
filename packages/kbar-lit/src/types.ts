import type { KBarHistory } from './history.js';
import type { ActionImpl } from './action.js';

/** Return an inverse operation from perform() to participate in history. */
export type Undo = () => void | Promise<void>;
export interface Action {
  id: string;
  name: string;
  subtitle?: string;
  keywords?: string;
  /** A sequence, as in kbar: ['g', 'h'] means press g, then h. */
  shortcut?: string[];
  section?: string | { name: string; priority: number };
  parent?: string;
  priority?: number;
  /** Text, a Lit TemplateResult, or another value accepted by a Lit child binding. */
  icon?: unknown;
  perform?: (action: ActionImpl) => void | Undo | Promise<void | Undo>;
}
export enum VisualState {
  animatingIn = 'animating-in',
  showing = 'showing',
  animatingOut = 'animating-out',
  hidden = 'hidden',
}
export interface KBarOptions {
  enableHistory?: boolean;
  /** Optional isolated history; the default is the upstream-compatible shared history. */
  historyManager?: KBarHistory;
  toggleShortcut?: string;
  animations?: { enterMs?: number; exitMs?: number };
  disableDocumentLock?: boolean;
  disableScrollbarManagement?: boolean;
  callbacks?: {
    onOpen?: () => void;
    onClose?: () => void;
    onQueryChange?: (search: string) => void;
    onSelectAction?: (action: ActionImpl) => void;
  };
}
export interface KBarState {
  readonly open: boolean;
  readonly visualState: VisualState;
  readonly search: string;
  readonly rootId: string | null;
  /** Index in the mixed results array, including section headings (as in kbar). */
  readonly activeIndex: number;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly error: unknown;
}
export interface ActionGroup {
  name: string;
  actions: readonly ActionImpl[];
}
export interface HistoryItem {
  perform: () => void | Undo | Promise<void | Undo>;
  negate: Undo;
}

export type ActionId = string;
export type ActionSection = NonNullable<Action['section']>;
export type ActionStore = Record<ActionId, ActionImpl>;
export type ActionTree = ActionStore;
export type History = KBarHistory;
