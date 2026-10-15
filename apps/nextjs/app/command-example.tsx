'use client';
import { useEffect, useRef, useState } from 'react';
import { createExampleStore } from '@kbar-lit/example-actions';
import type { KBarStore, KBarProvider, ActionImpl } from 'kbar-lit';

export default function CommandExample() {
  const [store, setStore] = useState<KBarStore>();
  const [message, setMessage] = useState('Ready');
  const [selected, setSelected] = useState('None');
  const [dynamic, setDynamic] = useState(false);
  const provider = useRef<KBarProvider>(null);
  const unregister = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    let owned: KBarStore | undefined;
    // The server renders the page; custom elements are registered only in the browser.
    void import('kbar-lit/register').then(() => {
      if (!cancelled) {
        owned = createExampleStore(setMessage);
        setStore(owned);
      }
    });
    return () => {
      cancelled = true;
      unregister.current?.();
      owned?.destroy();
    };
  }, []);
  useEffect(() => {
    const element = provider.current;
    const onSelect = (event: Event) =>
      setSelected((event as CustomEvent<{ action: ActionImpl }>).detail.action.name);
    element?.addEventListener('kbar-select', onSelect);
    return () => element?.removeEventListener('kbar-select', onSelect);
  }, [store]);
  function addDynamic() {
    if (!store || dynamic) return;
    unregister.current = store.registerActions([
      {
        id: 'dynamic',
        name: 'Dynamic command',
        perform: () => {
          setMessage('Dynamic command selected');
        },
      },
    ]);
    setDynamic(true);
  }
  return (
    <main>
      <div className="eyebrow">kbar-lit / Next.js</div>
      <h1>
        Native components.
        <br />
        React state.
      </h1>
      <p className="intro">
        The Next.js App Router renders this page. Our Lit library renders the command menu, with the
        same provider, portal, search and results used in every example.
      </p>
      <div className="controls">
        <button
          className="primary"
          disabled={!store}
          onClick={(event) => {
            event.currentTarget.focus();
            store?.show();
          }}
        >
          Open command menu
        </button>
        <button disabled={!store} onClick={() => void store?.history.undo()}>
          Undo
        </button>
        <button disabled={!store} onClick={() => void store?.history.redo()}>
          Redo
        </button>
        <button disabled={!store || dynamic} onClick={addDynamic}>
          Add dynamic command
        </button>
      </div>
      <section className="status" aria-label="Application state">
        <p data-testid="message" role="status">
          {message}
        </p>
        <p className="muted">
          Selected event: <span data-testid="selected">{selected}</span>
        </p>
      </section>
      <label>
        Action shortcuts stay out of editable fields
        <input className="demo-input" placeholder="Try typing g h here" />
      </label>
      <div className="details">
        <p>
          Press <code>⌘ / Ctrl K</code>, search for <code>Increment counter</code>, or navigate into{' '}
          <code>Change theme</code>. Command callbacks update React state; native events are
          subscribed through a ref.
        </p>
      </div>
      {store && (
        <kbar-provider ref={provider} store={store}>
          <kbar-portal>
            <kbar-positioner>
              <kbar-animator>
                <kbar-search />
                <kbar-results />
              </kbar-animator>
            </kbar-positioner>
          </kbar-portal>
        </kbar-provider>
      )}
    </main>
  );
}
