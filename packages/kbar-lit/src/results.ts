import { LitElement, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  Virtualizer,
  observeElementRect,
  observeElementOffset,
  elementScroll,
  defaultRangeExtractor,
  measureElement,
} from '@tanstack/virtual-core';
import { KBarController } from './controller.js';
import type { ActionImpl } from './action.js';
import { executeAction } from './execute.js';

export interface RenderParams {
  item: ActionImpl | string;
  active: boolean;
}
export class KBarResults extends LitElement {
  static properties = {
    items: { attribute: false },
    onRender: { attribute: false },
    maxHeight: { type: Number, attribute: 'max-height' },
    emptyText: { attribute: 'empty-text' },
  };
  items?: readonly (ActionImpl | string)[];
  onRender?: (params: RenderParams) => unknown;
  maxHeight = 400;
  emptyText = 'No results found.';
  private kbar = new KBarController(this);
  private cleanup?: () => void;
  private measuredHeights = new WeakMap<HTMLElement, number>();
  private previousActive = -1;
  private wasOpen = false;
  private previousItems?: readonly (ActionImpl | string)[];
  private cachedGroups?: unknown;
  private cachedItems: readonly (ActionImpl | string)[] = [];
  private virtualizer = new Virtualizer<HTMLElement, HTMLElement>({
    count: 0,
    getScrollElement: () => this.querySelector<HTMLElement>('[data-kbar-scroll]'),
    estimateSize: () => 56,
    useAnimationFrameWithResizeObserver: true,
    measureElement: (element, entry, instance) => {
      // A hidden modal has zero-sized rows; never overwrite useful measurements with zero.
      if (!element.getClientRects().length) {
        return this.measuredHeights.get(element) ?? 56;
      }
      const height = measureElement(element, entry, instance);
      this.measuredHeights.set(element, height);
      return height;
    },
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    overscan: 5,
    onChange: () =>
      queueMicrotask(() => {
        if (this.isConnected) this.requestUpdate();
      }),
  });
  protected createRenderRoot() {
    return this;
  }
  private get rows() {
    if (this.items) return this.items;
    const groups = this.kbar.store?.groups;
    if (groups !== this.cachedGroups) {
      this.cachedGroups = groups;
      this.cachedItems =
        groups?.flatMap((group) =>
          group.name ? [group.name, ...group.actions] : [...group.actions],
        ) ?? [];
    }
    return this.cachedItems;
  }
  private get actions() {
    return this.rows.filter((item): item is ActionImpl => typeof item !== 'string');
  }
  connectedCallback() {
    super.connectedCallback();
    this.cleanup = this.virtualizer._didMount();
    this.ownerDocument.addEventListener('keydown', this.keydown, true);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanup?.();
    this.ownerDocument.removeEventListener('keydown', this.keydown, true);
  }
  private keydown = (event: KeyboardEvent) => {
    const store = this.kbar.store;
    if (
      !store?.state.open ||
      event.isComposing ||
      event.defaultPrevented ||
      (!event.composedPath().includes(store.query.getInput()!) &&
        !event.composedPath().includes(this.querySelector('[data-kbar-scroll]')!))
    )
      return;
    const key = event.key.toLowerCase();
    let index = store.state.activeIndex;
    if (key === 'arrowdown' || (event.ctrlKey && key === 'n')) index++;
    else if (key === 'arrowup' || (event.ctrlKey && key === 'p')) index--;
    else if (key === 'home' && event.ctrlKey) index = 0;
    else if (key === 'end' && event.ctrlKey) index = this.actions.length - 1;
    else if (key === 'enter') {
      event.preventDefault();
      event.stopPropagation();
      const action = this.actions[index];
      if (action) void executeAction(this, store, action.id);
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    store.setActiveIndex(Math.max(0, Math.min(this.actions.length - 1, index)));
  };
  protected willUpdate() {
    const rows = this.rows;
    const active = this.actions[this.kbar.state?.activeIndex ?? 0];
    const activeRow = active ? rows.indexOf(active) : -1;
    this.virtualizer.setOptions({
      ...this.virtualizer.options,
      count: rows.length,
      getItemKey: (index) =>
        typeof rows[index] === 'string'
          ? `section-${index}-${rows[index]}`
          : (rows[index] as ActionImpl).id,
      rangeExtractor: (range) =>
        [...new Set([...defaultRangeExtractor(range), ...(activeRow < 0 ? [] : [activeRow])])].sort(
          (a, b) => a - b,
        ),
    });
  }
  protected updated() {
    this.virtualizer._willUpdate();
    this.querySelectorAll<HTMLElement>('[data-index]').forEach((element) =>
      this.virtualizer.measureElement(element),
    );
    const rows = this.rows;
    const active = this.kbar.state?.activeIndex ?? 0;
    const opening = this.kbar.state?.open && !this.wasOpen;
    this.wasOpen = this.kbar.state?.open ?? false;
    if (this.previousItems !== rows) {
      this.previousItems = rows;
      if (active >= this.actions.length && this.actions.length)
        this.kbar.store?.setActiveIndex(this.actions.length - 1);
      this.virtualizer.scrollToOffset(0);
    }
    if (
      opening ||
      active !== this.previousActive ||
      (this.kbar.state?.open && !this.virtualizer.getVirtualItems().length)
    ) {
      this.previousActive = active;
      const rowIndex = rows.indexOf(this.actions[active]);
      if (active === 0) this.virtualizer.scrollToOffset(0);
      else if (rowIndex >= 0) this.virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }
    // The input and options share a tree scope, including custom items.
    const input = this.kbar.query?.getInput();
    if (input) {
      if (this.actions.length)
        input.setAttribute('aria-activedescendant', `${this.kbar.store!.uid}-option-${active}`);
      else input.removeAttribute('aria-activedescendant');
    }
  }
  private defaultRender({ item }: RenderParams) {
    if (typeof item === 'string') return html`<div class="kbar-section">${item}</div>`;
    return html`<div class="kbar-row">
      ${item.icon ? html`<span class="kbar-icon" aria-hidden="true">${item.icon}</span>` : nothing}
      <span class="kbar-text"
        ><span>${item.name}</span
        >${item.subtitle ? html`<small>${item.subtitle}</small>` : nothing}</span
      >
      ${item.shortcut?.length ? html`<span class="kbar-shortcut" aria-hidden="true">${item.shortcut.map((key) => html`<kbd>${key.replace('$mod', '⌘ / Ctrl')}</kbd>`)}</span>` : nothing}
      ${!item.command && item.children.length ? html`<span aria-hidden="true">›</span>` : nothing}
    </div>`;
  }
  protected render() {
    const store = this.kbar.store;
    const rows = this.rows;
    const actions = this.actions;
    const indexes = new Map(actions.map((action, index) => [action.id, index]));
    return html`
      <style>
        kbar-results {
          display: block;
        }
        kbar-results [data-kbar-scroll] {
          overflow: auto;
          overscroll-behavior: contain;
          position: relative;
        }
        kbar-results [role='listbox'] {
          position: relative;
          width: 100%;
        }
        kbar-results [data-index] {
          box-sizing: border-box;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
        }
        kbar-results [role='option'] {
          cursor: pointer;
          border-radius: 8px;
        }
        kbar-results [aria-selected='true'] {
          background: var(--kbar-active-background, #eeedf9);
          color: var(--kbar-active-color, #37316b);
        }
        kbar-results .kbar-row {
          min-height: 56px;
          padding: 12px 22px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        kbar-results .kbar-text {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        kbar-results small {
          color: var(--kbar-muted, #707586);
          font-size: 12px;
        }
        kbar-results .kbar-icon {
          width: 24px;
          text-align: center;
        }
        kbar-results .kbar-section {
          padding: 18px 22px 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--kbar-muted, #707586);
        }
        kbar-results .kbar-shortcut {
          display: flex;
          gap: 4px;
        }
        kbar-results kbd {
          font: inherit;
          font-size: 11px;
          border: 1px solid var(--kbar-border, #d9dae1);
          border-radius: 4px;
          padding: 2px 5px;
        }
        kbar-results .kbar-empty,
        kbar-results [role='alert'] {
          padding: 24px;
          text-align: center;
        }
        kbar-results .kbar-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
      </style>
      <div
        data-kbar-scroll
        tabindex="0"
        role="region"
        aria-label="Command results"
        style=${styleMap({ maxHeight: `${this.maxHeight}px` })}
      >
        <div
          role="listbox"
          aria-label="Commands"
          id=${store ? `${store.uid}-listbox` : nothing}
          aria-busy=${store?.state.busy ? 'true' : 'false'}
          style=${styleMap({ height: `${this.virtualizer.getTotalSize()}px` })}
        >
          ${repeat(
            this.virtualizer.getVirtualItems(),
            (row) => row.key,
            (row) => {
              const item = rows[row.index];
              const actionIndex = typeof item === 'string' ? -1 : indexes.get(item.id)!;
              const active = actionIndex >= 0 && actionIndex === store?.state.activeIndex;
              return html`<div
                data-index=${row.index}
                role=${typeof item === 'string' ? 'presentation' : 'option'}
                id=${actionIndex >= 0 ? `${store!.uid}-option-${actionIndex}` : nothing}
                aria-selected=${actionIndex >= 0 ? String(active) : nothing}
                aria-posinset=${actionIndex >= 0 ? actionIndex + 1 : nothing}
                aria-setsize=${actionIndex >= 0 ? actions.length : nothing}
                style=${styleMap({ transform: `translateY(${row.start}px)` })}
                @pointermove=${(event: PointerEvent) => {
                  if ((event.movementX || event.movementY) && actionIndex >= 0 && !active)
                    store?.setActiveIndex(actionIndex);
                }}
                @pointerdown=${(event: PointerEvent) => {
                  if (actionIndex >= 0) {
                    event.preventDefault();
                    store?.setActiveIndex(actionIndex);
                  }
                }}
                @click=${() => {
                  if (typeof item !== 'string' && store) void executeAction(this, store, item.id);
                }}
              >
                ${(this.onRender ?? this.defaultRender)({ item, active })}
              </div>`;
            },
          )}
        </div>
        ${!actions.length ? html`<div class="kbar-empty" part="empty">${this.emptyText}</div>` : nothing}
      </div>
      <div class="kbar-sr-only" role="status" aria-live="polite">
        ${store?.state.busy ? 'Running command…' : `${actions.length} results`}
      </div>
      ${store?.state.error ? html`<div role="alert">${store.state.error instanceof Error ? store.state.error.message : 'The command failed. Try again.'}</div>` : nothing}
    `;
  }
}
