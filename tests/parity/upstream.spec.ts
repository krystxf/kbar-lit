import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    historyScenario(): unknown;
    registryScenario(): unknown;
    parity: {
      clearEvents(): void;
      snapshot(): {
        results: string[];
        activeIndex: number;
        root: string | null;
        search: string;
        visualState: string;
        events: string[];
        value: number;
      };
      search(value: string): void;
      root(value: string | null): void;
      setIndex(index: number): void;
      register(values: { id: string; name: string }[]): void;
      unregister(): void;
      execute(id: string): Promise<void>;
      undo(): Promise<void>;
      redo(): Promise<void>;
      history(): { undo: number; redo: number; value: number };
      subscribeObject(): void;
    };
    subscription: { count(): number; dispose(): void };
  }
}
async function ready(page: Page, engine: string) {
  await page.goto(`http://127.0.0.1:4204/?engine=${engine}`);
  await page.waitForFunction(() => !!window.parity);
  await page.locator('#open').click();
  await expect(page.getByRole('combobox')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.parity.snapshot().visualState))
    .toBe('showing');
}
async function snapshot(page: Page) {
  // Upstream useMatches deliberately throttles by 100ms. Wait for observable stability.
  let previous = '';
  let stable = 0;
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(await page.evaluate(() => window.parity.snapshot()));
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      },
      { intervals: [120, 120, 120] },
    )
    .toBeGreaterThanOrEqual(2);
  return page.evaluate(() => window.parity.snapshot());
}

test('grouped result order and selected index agree with upstream', async ({ browser }) => {
  const upstream = await browser.newPage(),
    lit = await browser.newPage();
  await ready(upstream, 'react');
  await ready(lit, 'lit');
  const expected = await snapshot(upstream),
    actual = await snapshot(lit);
  expect(actual.results).toEqual(expected.results);
  expect(actual.activeIndex).toBe(expected.activeIndex);
  await upstream.close();
  await lit.close();
});
for (const query of ['search', 'social cafe', 'preferences', 'night', 'Home', 'appearance']) {
  test(`fuzzy matching and grouping agree for ${query}`, async ({ browser }) => {
    const upstream = await browser.newPage(),
      lit = await browser.newPage();
    await ready(upstream, 'react');
    await ready(lit, 'lit');
    await upstream.getByRole('combobox').fill(query);
    await lit.getByRole('combobox').fill(query);
    expect((await snapshot(lit)).results).toEqual((await snapshot(upstream)).results);
    await upstream.close();
    await lit.close();
  });
}
test('registering an existing action ID updates its definition', async ({ browser }) => {
  const outputs = [];
  for (const engine of ['react', 'lit']) {
    const page = await browser.newPage();
    await ready(page, engine);
    await page.evaluate(() => window.parity.register([{ id: 'home', name: 'Updated home' }]));
    await page.getByRole('combobox').fill('Updated home');
    outputs.push((await snapshot(page)).results);
    await page.close();
  }
  expect(outputs[1]).toEqual(outputs[0]);
});
test('repeated command history follows upstream undo and redo semantics', async ({ browser }) => {
  const outputs = [];
  for (const engine of ['react', 'lit']) {
    const page = await browser.newPage();
    await ready(page, engine);
    await page.evaluate(async () => {
      await window.parity.execute('home');
      await window.parity.execute('home');
    });
    const steps = [await page.evaluate(() => window.parity.history())];
    await page.evaluate(() => window.parity.undo());
    steps.push(await page.evaluate(() => window.parity.history()));
    await page.evaluate(() => window.parity.redo());
    steps.push(await page.evaluate(() => window.parity.history()));
    outputs.push(steps);
    await page.close();
  }
  expect(outputs[1]).toEqual(outputs[0]);
});
test('object collectors do not notify when selected state is unchanged', async ({ browser }) => {
  const counts = [];
  for (const engine of ['react', 'lit']) {
    const page = await browser.newPage();
    await ready(page, engine);
    await snapshot(page);
    await page.evaluate(() => {
      window.parity.subscribeObject();
      window.parity.setIndex(2);
    });
    await snapshot(page);
    await page.evaluate(() => window.parity.setIndex(4));
    await snapshot(page);
    counts.push(await page.evaluate(() => window.subscription.count()));
    await page.close();
  }
  expect(counts[1]).toEqual(counts[0]);
});

for (const scenario of ['historyScenario', 'registryScenario'] as const) {
  test(`${scenario} matches upstream's public imperative API`, async ({ browser }) => {
    const outputs = [];
    for (const engine of ['react', 'lit']) {
      const page = await browser.newPage();
      await ready(page, engine);
      outputs.push(await page.evaluate((name) => window[name](), scenario));
      await page.close();
    }
    expect(outputs[1]).toEqual(outputs[0]);
  });
}

test('weighted ranking, section priorities and ties match on a larger action set', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const reference = await browser.newPage(),
    lit = await browser.newPage();
  await ready(reference, 'react');
  await ready(lit, 'lit');
  for (const page of [reference, lit]) {
    await page.evaluate(() =>
      window.parity.register(
        Array.from({ length: 90 }, (_, i) => ({
          id: `generated-${i}`,
          name: `${['Search', 'Open', 'Create', 'Find', 'Export'][i % 5]} ${['project', 'document', 'workspace', 'settings', 'café', 'profile'][i % 6]} ${i}`,
          keywords: ['social, shared', 'private, secret', 'data, report'][i % 3],
          subtitle: `Quick ${['search', 'settings', 'export'][i % 3]}`,
          priority: (i % 5) - 2,
          section:
            i % 4 === 0 ? { name: `Group ${i % 7}`, priority: (i % 3) - 1 } : `Group ${i % 7}`,
        })),
      ),
    );
  }
  for (const query of [
    '',
    'search',
    'private',
    'cafe',
    'open settings',
    'report',
    'quick export',
    'Group 3',
    'workspace',
  ]) {
    await reference.getByRole('combobox').fill(query);
    await lit.getByRole('combobox').fill(query);
    expect((await snapshot(lit)).results, query).toEqual((await snapshot(reference)).results);
  }
  await reference.close();
  await lit.close();
});

for (const selection of [false, true]) {
  test(`callback sequences match for ${selection ? 'pointer selection' : 'keyboard dismissal'}`, async ({
    browser,
  }) => {
    const outputs = [];
    for (const engine of ['react', 'lit']) {
      const page = await browser.newPage();
      await ready(page, engine);
      await page.getByRole('combobox').press('Escape');
      await snapshot(page);
      await page.evaluate(() => window.parity.clearEvents());
      await page.keyboard.press('ControlOrMeta+k');
      await page.getByRole('combobox').fill('night');
      await snapshot(page);
      if (selection) await page.getByRole('option').filter({ hasText: 'Dark appearance' }).click();
      else await page.getByRole('combobox').press('Escape');
      outputs.push((await snapshot(page)).events);
      await page.close();
    }
    expect(outputs[1]).toEqual(outputs[0]);
  });
}

test('programmatic queries do not synthesize user input callbacks', async ({ browser }) => {
  const outputs = [];
  for (const engine of ['react', 'lit']) {
    const page = await browser.newPage();
    await ready(page, engine);
    await page.evaluate(() => {
      window.parity.clearEvents();
      window.parity.search('night');
    });
    outputs.push((await snapshot(page)).events);
    await page.close();
  }
  expect(outputs[1]).toEqual(outputs[0]);
});
