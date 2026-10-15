import { test, expect } from '@playwright/test';
import type { KBarProvider } from 'kbar-lit';
import AxeBuilder from '@axe-core/playwright';

for (const [framework, port] of [
  ['Next.js', 4201],
  ['Vue', 4202],
  ['Angular', 4203],
] as const) {
  test.describe(framework, () => {
    test('uses Lit elements, updates framework state and delivers events without runtime errors', async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const response = await page.goto(`http://127.0.0.1:${port}`);
      expect(response?.ok()).toBe(true);
      await expect(page.getByRole('button', { name: 'Open command menu' })).toBeEnabled();
      const isLit = await page.locator('kbar-provider').evaluate((element) => {
        return (
          element.constructor === customElements.get('kbar-provider') &&
          element.shadowRoot !== null &&
          'updateComplete' in element &&
          (element as KBarProvider).store.getAction('increment')?.name === 'Increment counter'
        );
      });
      expect(isLit).toBe(true);
      await page.getByRole('button', { name: 'Open command menu' }).click();
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.getByRole('combobox').fill('Increment counter');
      await page.getByRole('combobox').press('Enter');
      await expect(page.getByTestId('message')).toHaveText('Counter: 1');
      await expect(page.getByTestId('selected')).toHaveText('Increment counter');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(page.getByTestId('message')).toHaveText('Counter: 0');
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect(page.getByTestId('message')).toHaveText('Counter: 1');
      await page.getByRole('button', { name: 'Add dynamic command' }).click();
      await page.getByRole('button', { name: 'Open command menu' }).click();
      await page.getByRole('combobox').fill('Dynamic command');
      await page.getByRole('option', { name: 'Dynamic command' }).click();
      await expect(page.getByTestId('message')).toHaveText('Dynamic command selected');
      await expect(page.getByTestId('selected')).toHaveText('Dynamic command');
      expect(errors).toEqual([]);
    });
    test('supports nested keyboard navigation, typing guards and accessible composition', async ({
      page,
    }) => {
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(page.getByRole('button', { name: 'Open command menu' })).toBeEnabled();
      await page.locator('.demo-input').pressSequentially('gh');
      await expect(page.getByTestId('message')).toHaveText('Ready');
      await page.locator('.demo-input').blur();
      await page.keyboard.press('t');
      await expect(page.getByRole('combobox')).toHaveAttribute('placeholder', 'Change theme');
      await page.getByRole('combobox').press('ArrowDown');
      await page.getByRole('combobox').press('Enter');
      await expect(page.getByTestId('message')).toHaveText('Theme: dark');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('button', { name: 'Open command menu' }).click();
      await expect(page.locator('kbar-animator')).toHaveCSS('opacity', '1');
      const report = await new AxeBuilder({ page }).include('kbar-provider').analyze();
      expect(report.violations).toEqual([]);
      await page.getByRole('combobox').press('Escape');
      await expect(page.getByRole('button', { name: 'Open command menu' })).toBeFocused();
    });
  });
}
