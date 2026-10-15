<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { createExampleStore } from '@kbar-lit/example-actions';
import type { ActionImpl } from 'kbar-lit';
const message = ref('Ready');
const selected = ref('None');
const dynamic = ref(false);
// Keep the store itself unproxied; only application-facing state is reactive.
const store = createExampleStore((value) => {
  message.value = value;
});
let unregister: (() => void) | undefined;
function addDynamic() {
  if (dynamic.value) return;
  unregister = store.registerActions([
    {
      id: 'dynamic',
      name: 'Dynamic command',
      perform: () => {
        message.value = 'Dynamic command selected';
      },
    },
  ]);
  dynamic.value = true;
}
function onSelect(event: Event) {
  selected.value = (event as CustomEvent<{ action: ActionImpl }>).detail.action.name;
}
function open(event: MouseEvent) {
  (event.currentTarget as HTMLElement).focus();
  store.show();
}
onBeforeUnmount(() => {
  unregister?.();
  store.destroy();
});
</script>
<template>
  <main>
    <div class="eyebrow">kbar-lit / Vue</div>
    <h1>Native components.<br />Vue reactivity.</h1>
    <p class="intro">
      Vue binds a real store property to our Lit provider. The command menu is composed entirely
      from kbar-lit custom elements, with native events updating Vue refs.
    </p>
    <div class="controls">
      <button class="primary" @click="open">Open command menu</button
      ><button @click="store.history.undo()">Undo</button
      ><button @click="store.history.redo()">Redo</button
      ><button :disabled="dynamic" @click="addDynamic">Add dynamic command</button>
    </div>
    <section class="status" aria-label="Application state">
      <p data-testid="message" role="status">{{ message }}</p>
      <p class="muted">
        Selected event: <span data-testid="selected">{{ selected }}</span>
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
        <code>Change theme</code>. The Vite compiler recognizes the <code>kbar-</code> prefix as
        custom elements.
      </p>
    </div>
    <kbar-provider :store.prop="store" @kbar-select="onSelect"
      ><kbar-portal
        ><kbar-positioner
          ><kbar-animator
            ><kbar-search /><kbar-results /></kbar-animator></kbar-positioner></kbar-portal
    ></kbar-provider>
  </main>
</template>
