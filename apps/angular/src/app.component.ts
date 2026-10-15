import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import { createExampleStore } from '@kbar-lit/example-actions';
import type { ActionImpl } from 'kbar-lit';

@Component({
  selector: 'app-root',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main>
      <div class="eyebrow">kbar-lit / Angular</div>
      <h1>Native components.<br />Angular signals.</h1>
      <p class="intro">
        Angular binds the store property and listens to native DOM events. The provider, portal,
        animator, search and results are all the Lit components from our library.
      </p>
      <div class="controls">
        <button class="primary" (click)="open($event)">Open command menu</button
        ><button (click)="store.history.undo()">Undo</button
        ><button (click)="store.history.redo()">Redo</button
        ><button [disabled]="dynamic()" (click)="addDynamic()">Add dynamic command</button>
      </div>
      <section class="status" aria-label="Application state">
        <p data-testid="message" role="status">{{ message() }}</p>
        <p class="muted">
          Selected event: <span data-testid="selected">{{ selected() }}</span>
        </p>
      </section>
      <label
        >Action shortcuts stay out of editable fields<input
          class="demo-input"
          placeholder="Try typing g h here"
      /></label>
      <div class="details">
        <p>
          Press <code>⌘ / Ctrl K</code>, search for <code>Increment counter</code>, or navigate into
          <code>Change theme</code>. CUSTOM_ELEMENTS_SCHEMA permits the custom element tags; command
          callbacks update signals.
        </p>
      </div>
      <kbar-provider [store]="store" (kbar-select)="onSelect($event)"
        ><kbar-portal
          ><kbar-positioner
            ><kbar-animator
              ><kbar-search></kbar-search
              ><kbar-results></kbar-results></kbar-animator></kbar-positioner></kbar-portal
      ></kbar-provider>
    </main>
  `,
})
export class AppComponent implements OnDestroy {
  readonly message = signal('Ready');
  readonly selected = signal('None');
  readonly dynamic = signal(false);
  readonly store = createExampleStore((value) => this.message.set(value));
  private unregister?: () => void;
  open(event: MouseEvent) {
    (event.currentTarget as HTMLElement).focus();
    this.store.show();
  }
  onSelect(event: Event) {
    this.selected.set((event as CustomEvent<{ action: ActionImpl }>).detail.action.name);
  }
  addDynamic() {
    if (this.dynamic()) return;
    this.unregister = this.store.registerActions([
      {
        id: 'dynamic',
        name: 'Dynamic command',
        perform: () => {
          this.message.set('Dynamic command selected');
        },
      },
    ]);
    this.dynamic.set(true);
  }
  ngOnDestroy() {
    this.unregister?.();
    this.store.destroy();
  }
}
