import { test, expect } from '@playwright/test';
type LitHost = HTMLElement & { updateComplete: Promise<boolean> };
import type { KBarStore, KBarProvider, KBarActionsController } from 'kbar-lit';
declare global {
  interface Window {
    controllerFixture: {
      first: KBarStore;
      second: KBarStore;
      provider: KBarProvider;
      consumer: LitHost;
      registrant: LitHost & { actions: KBarActionsController };
    };
  }
}
test('controllers follow context replacement and release subscriptions while disconnected', async ({
  page,
}) => {
  await page.goto('/fixtures/controllers.html');
  await expect(page.locator('test-consumer output')).toHaveText('');
  await page.evaluate(() => window.controllerFixture.first.setSearch('first store'));
  await expect(page.locator('test-consumer output')).toHaveText('first store');
  await page.evaluate(async () => {
    const { provider, second, consumer } = window.controllerFixture;
    provider.store = second;
    await provider.updateComplete;
    await consumer.updateComplete;
    second.setSearch('second store');
  });
  await expect(page.locator('test-consumer output')).toHaveText('second store');
  const detached = await page.evaluate(async () => {
    const { consumer, first, second, provider } = window.controllerFixture;
    consumer.remove();
    first.setSearch('old store changed');
    second.setSearch('new store changed');
    await consumer.updateComplete;
    const text = consumer.shadowRoot?.textContent;
    provider.append(consumer);
    await consumer.updateComplete;
    return text;
  });
  expect(detached).toBe('second store');
  await expect(page.locator('test-consumer output')).toHaveText('new store changed');
});
test('action controller registers, replaces and cleans up actions across reconnects', async ({
  page,
}) => {
  await page.goto('/fixtures/controllers.html');
  await page.waitForFunction(() => !!window.controllerFixture);
  const frames = await page.evaluate(() => {
    const { first, registrant, provider } = window.controllerFixture;
    const frames: string[][] = [];
    const capture = () => frames.push(first.actions.map((action) => action.id));
    capture();
    registrant.actions.setActions([{ id: 'replacement', name: 'Replacement' }]);
    capture();
    registrant.remove();
    capture();
    registrant.actions.setActions([{ id: 'offline', name: 'Offline' }]);
    capture();
    provider.append(registrant);
    capture();
    registrant.remove();
    capture();
    return frames;
  });
  expect(frames).toEqual([
    ['first', 'registered'],
    ['first', 'replacement'],
    ['first'],
    ['first'],
    ['first', 'offline'],
    ['first'],
  ]);
});
