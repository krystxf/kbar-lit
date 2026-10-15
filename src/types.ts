/** Return an inverse operation from perform() to participate in history. */
export type Undo = () => void | Promise<void>;
export interface Action {
  id: string;
  name: string;
  subtitle?: string;
  keywords?: string;
  /** Each entry is an alternative shortcut; spaces describe a key sequence. */
  shortcut?: string[];
  section?: string | { name: string; priority: number };
  parent?: string;
  priority?: number;
  /** Text, a Lit TemplateResult, or another value accepted by a Lit child binding. */
  icon?: unknown;
  perform?: (action: Action) => void | Undo | Promise<void | Undo>;
}
export interface KBarOptions {
  enableHistory?: boolean;
  toggleShortcut?: string;
}
export interface KBarState {
  readonly open: boolean;
  readonly search: string;
  readonly rootId: string | null;
  readonly activeIndex: number;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly error: unknown;
}
export interface ActionGroup { name: string; actions: readonly Action[] }
export interface HistoryItem { perform: () => void | Undo | Promise<void | Undo>; undo: Undo }
