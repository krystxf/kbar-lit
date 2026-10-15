import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('opens, searches nested commands, executes and restores focus', async ({ page }) => {
  await page.locator('#open').click();
  const search = page.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('night');
  await expect(page.getByRole('option', { selected: true })).toContainText('Dark mode');
  await search.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#open')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#undo').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#redo').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('keyboard navigation, nested backspace, IME and escape', async ({ page }) => {
  await page.locator('#open').focus();
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('combobox');
  await search.fill('Change theme');
  await search.press('Enter');
  await expect(search).toHaveAttribute('placeholder', 'Change theme');
  await expect(page.getByRole('option')).toHaveCount(2);
  await search.press('Control+n');
  await expect(page.getByRole('option', { selected: true })).toContainText('Dark mode');
  await search.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(page.getByRole('dialog')).toBeVisible();
  await search.press('Backspace');
  await expect(search).toHaveAttribute('placeholder', 'Type a command or search…');
  await search.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('shortcut sequences, editable guard and group shortcuts', async ({ page }) => {
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page.locator('#activity')).toHaveText('You are home.');
  await page.locator('#typing').fill('');
  await page.locator('#typing').pressSequentially('gp');
  await expect(page.locator('#activity')).toHaveText('You are home.');
  await page.locator('#typing').blur();
  await page.keyboard.press('t');
  await expect(page.getByRole('combobox')).toHaveAttribute('placeholder', 'Change theme');
});

test('virtualizes 10,000 actions and reaches the final result', async ({ page }) => {
  await page.locator('#load').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('option').count()).toBeLessThan(40);
  await page.getByRole('combobox').press('Control+End');
  await expect(page.getByRole('option', { selected: true })).toContainText('Project 10000');
  await page.getByRole('combobox').press('Enter');
  await expect(page.locator('#activity')).toHaveText('Opened project 10000.');
});

test('accessible composition, focus containment and outside dismissal', async ({ page }) => {
  await page.locator('#open').click();
  await expect(page.getByRole('option').first()).toBeVisible();
  await expect(page.locator('kbar-animator')).toHaveCSS('opacity', '1');
  const report = await new AxeBuilder({ page }).include('kbar-provider').analyze();
  expect(report.violations).toEqual([]);
  await page.keyboard.press('Tab');
  expect(await page.locator('#typing').evaluate((input) => input === document.activeElement)).toBe(
    false,
  );
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('reports async failures, allows retry, and emits selection events', async ({ page }) => {
  await page.evaluate(() => {
    const provider = document.querySelector('kbar-provider')!;
    let calls = 0;
    provider.store.registerActions([
      {
        id: 'retry',
        name: 'Retry command',
        perform: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (++calls === 1) throw new Error('Temporary failure');
        },
      },
    ]);
    provider.addEventListener('kbar-error', () => {
      document.body.dataset.error = 'received';
    });
    provider.addEventListener('kbar-select', () => {
      document.body.dataset.selected = 'received';
    });
  });
  await page.locator('#open').click();
  await page.getByRole('combobox').fill('Retry command');
  await page.getByRole('combobox').press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Temporary failure');
  await expect(page.locator('body')).toHaveAttribute('data-error', 'received');
  await page.getByRole('combobox').press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-selected', 'received');
});

test('measures custom variable-height result templates', async ({ page }) => {
  await page.evaluate(async () => {
    // @ts-expect-error Vite serves the source module for the integration fixture.
    const { html } = await import('/node_modules/lit/index.js');
    document.querySelector('kbar-results')!.onRender = ({ item, active }) =>
      typeof item === 'string'
        ? html`<div style="padding:10px">${item}</div>`
        : html`<div
            style="padding:20px;height:${item.id === 'home' ? '130px' : '70px'};box-sizing:border-box"
            data-custom=${item.id}
          >
            ${item.name} ${active ? 'Selected' : ''}
          </div>`;
  });
  await page.locator('#open').click();
  const first = page.getByRole('option').first();
  await expect(first).toHaveCSS('height', '130px');
  await page.getByRole('combobox').press('ArrowDown');
  await expect(page.getByRole('option', { selected: true })).toContainText(
    'Browse projects Selected',
  );
  const firstBox = await first.boundingBox();
  const secondBox = await page.getByRole('option').nth(1).boundingBox();
  expect(secondBox!.y).toBeGreaterThanOrEqual(firstBox!.y + firstBox!.height - 1);
});

test('supports runtime options, outside-click opt out, and restored inline body styles', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '7px';
    document.querySelector('kbar-provider')!.options = {
      toggleShortcut: 'Control+j',
      disableDocumentLock: true,
      animations: { enterMs: 0, exitMs: 0 },
    };
    document.querySelector('kbar-animator')!.disableCloseOnOuterClick = true;
  });
  await page.keyboard.press('Control+j');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'auto');
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('body')).toHaveCSS('padding-right', '7px');
});

test('convenience palette shares ARIA scope and cleans up when detached', async ({ page }) => {
  await page.evaluate(async () => {
    document.querySelector('kbar-provider')!.remove();
    const palette = document.createElement('kbar-palette');
    palette.actions = [
      {
        id: 'a',
        name: 'Custom command',
        perform: () => {
          document.body.dataset.custom = 'yes';
        },
      },
    ];
    document.body.append(palette);
    await palette.updateComplete;
  });
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('option')).toContainText('Custom command');
  await expect(page.getByRole('combobox')).toBeFocused();
  await expect(page.locator('kbar-animator')).toHaveCSS('opacity', '1');
  const report = await new AxeBuilder({ page }).include('kbar-palette').analyze();
  expect(report.violations).toEqual([]);
  await page.evaluate(() => document.querySelector('kbar-palette')!.remove());
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('dynamic registration removal clamps selection and reconnects cleanly', async ({ page }) => {
  await page.locator('#open').click();
  await page.getByRole('combobox').press('Control+End');
  await page.evaluate(() => {
    const provider = document.querySelector('kbar-provider')!;
    provider.actions = [{ id: 'new', name: 'New action' }];
  });
  await expect(page.getByRole('option', { selected: true })).toHaveText('New action');
  await page.evaluate(() => {
    const provider = document.querySelector('kbar-provider')!;
    provider.remove();
    document.body.append(provider);
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('combobox').press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('projects into a custom portal container while preserving context and cleanup', async ({
  page,
}) => {
  await page.evaluate(() => {
    const target = document.createElement('div');
    target.id = 'portal-target';
    document.body.append(target);
    document.querySelector('kbar-portal')!.container = target;
  });
  await page.locator('#open').click();
  await expect(page.locator('#portal-target').getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.getByRole('combobox').fill('Browse projects');
  await page.getByRole('combobox').press('Enter');
  await expect(page.locator('#activity')).toHaveText('Projects opened.');
  await page.locator('#open').click();
  await page.evaluate(() => document.querySelector('kbar-provider')!.remove());
  await expect(page.locator('#portal-target')).toBeEmpty();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('keeps the first section visible and supports shifted punctuation shortcuts', async ({
  page,
}) => {
  await page.keyboard.press('Shift+?');
  await expect(page.locator('#activity')).toContainText('See README.md');
  await page.locator('#open').click();
  await expect(page.locator('[data-kbar-scroll]')).toHaveJSProperty('scrollTop', 0);
  await expect(page.getByText('Navigation', { exact: true })).toBeVisible();
});
