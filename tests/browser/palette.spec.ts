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
    const { html } = await import('/demo/templates.ts');
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
  const stillOpen = await page.evaluate(async () => {
    const provider = document.querySelector('kbar-provider')!;
    const dialog = provider.querySelector('kbar-portal')!.shadowRoot!.querySelector('dialog')!;
    const closed = new Promise<void>((resolve) =>
      dialog.addEventListener('close', () => resolve(), { once: true }),
    );
    provider.remove();
    document.body.append(provider);
    await closed;
    return provider.store.state.open;
  });
  expect(stillOpen).toBe(true);
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

test('reopening after a nested command retains measured rows and valid active descendant', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.keyboard.press('t');
  await page.getByRole('combobox').press('ArrowDown');
  await page.getByRole('combobox').press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('#open').click();
  await expect(page.getByRole('option', { selected: true })).toContainText('Go to home');
  const activeId = await page.getByRole('combobox').getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${activeId}"]`)).toBeVisible();
  expect(errors).toEqual([]);
});

test('search forwards native input attributes, properties and event handlers and resets removed options', async ({
  page,
}) => {
  await page.evaluate(() => {
    const search = document.querySelector('kbar-search')!;
    search.inputAttributes = {
      name: 'command',
      'data-custom': 'forwarded',
      required: true,
      role: 'button',
    };
    search.inputProperties = {
      maxLength: 20,
      oninput: () => {
        document.body.dataset.inputObserved = 'yes';
      },
    };
  });
  await page.locator('#open').click();
  const input = page.getByRole('combobox');
  await expect(input).toHaveAttribute('name', 'command');
  await expect(input).toHaveAttribute('data-custom', 'forwarded');
  await expect(input).toHaveAttribute('required', '');
  await expect(input).toHaveAttribute('maxlength', '20');
  await input.fill('night');
  await expect(page.locator('body')).toHaveAttribute('data-input-observed', 'yes');
  await expect(page.getByRole('option', { selected: true })).toContainText('Dark mode');
  await page.evaluate(() => {
    const search = document.querySelector('kbar-search')!;
    search.inputAttributes = {};
    search.inputProperties = {};
    delete document.body.dataset.inputObserved;
  });
  await expect(input).not.toHaveAttribute('required');
  await expect(input).not.toHaveAttribute('data-custom');
  await input.fill('light');
  await expect(page.locator('body')).not.toHaveAttribute('data-input-observed');
  expect(await input.evaluate((element) => (element as HTMLInputElement).maxLength)).toBe(-1);
});

for (const disableDocumentLock of [false, true]) {
  for (const disableScrollbarManagement of [false, true]) {
    test(`document lock=${!disableDocumentLock}, scrollbar management=${!disableScrollbarManagement}`, async ({
      page,
    }) => {
      await page.evaluate(
        ({ disableDocumentLock, disableScrollbarManagement }) => {
          // Supply a deterministic scrollbar width, including on overlay-scrollbar systems.
          Object.defineProperty(document.documentElement, 'clientWidth', {
            configurable: true,
            get: () => innerWidth - 17,
          });
          document.body.style.overflow = 'scroll';
          document.body.style.paddingRight = '12px';
          document.querySelector('kbar-provider')!.options = {
            disableDocumentLock,
            disableScrollbarManagement,
            animations: { enterMs: 0, exitMs: 0 },
          };
        },
        { disableDocumentLock, disableScrollbarManagement },
      );
      await page.locator('#open').click();
      await expect(page.getByRole('combobox')).toBeVisible();
      await expect(page.locator('body')).toHaveCSS(
        'overflow',
        disableDocumentLock ? 'scroll' : 'hidden',
      );
      await expect(page.locator('body')).toHaveCSS(
        'padding-right',
        disableDocumentLock || disableScrollbarManagement ? '12px' : '29px',
      );
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.locator('body')).toHaveCSS('overflow', 'scroll');
      await expect(page.locator('body')).toHaveCSS('padding-right', '12px');
    });
  }
}

test('disabled providers close and reject shortcuts until enabled again', async ({ page }) => {
  await page.locator('#open').click();
  await page.evaluate(() => document.querySelector('kbar-provider')!.store.query.disable(true));
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#activity')).toHaveText('Ready when you are.');
  await page.evaluate(() => document.querySelector('kbar-provider')!.store.query.disable(false));
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox')).toBeFocused();
});

test('reduced motion removes visual animation durations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#open').click();
  await expect(page.getByRole('combobox')).toBeVisible();
  const durations = await page
    .locator('kbar-animator')
    .evaluate((element) =>
      element.getAnimations().map((animation) => animation.effect?.getTiming().duration),
    );
  expect(durations.every((duration) => duration === 0)).toBe(true);
  await expect(page.locator('kbar-animator')).toHaveCSS('opacity', '1');
});

test('changing portal targets while open preserves the live palette and restores children', async ({
  page,
}) => {
  await page.locator('#open').click();
  await page.getByRole('combobox').fill('night');
  await page.evaluate(async () => {
    const portal = document.querySelector('kbar-portal')!;
    const first = document.body.appendChild(document.createElement('section'));
    first.id = 'portal-first';
    const second = document.body.appendChild(document.createElement('section'));
    second.id = 'portal-second';
    portal.container = first;
    await portal.updateComplete;
    portal.container = second;
    await portal.updateComplete;
  });
  await expect(page.locator('#portal-first kbar-search')).toHaveCount(0);
  await expect(page.locator('#portal-second kbar-search input')).toHaveValue('night');
  await expect(page.getByRole('option', { selected: true })).toContainText('Dark mode');
  await page.evaluate(async () => {
    const portal = document.querySelector('kbar-portal')!;
    portal.container = undefined;
    await portal.updateComplete;
  });
  await expect(page.locator('#portal-second kbar-search')).toHaveCount(0);
  await expect(page.locator('kbar-portal kbar-search input')).toHaveValue('night');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('animator applies configured entrance, exit, height and nested transitions', async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    const records: { frames: unknown; duration: unknown; direction: unknown }[] = [];
    Element.prototype.animate = function (frames, options) {
      if (this.localName === 'kbar-animator') {
        records.push({
          frames,
          duration: typeof options === 'number' ? options : options?.duration,
          direction: typeof options === 'number' ? undefined : options?.direction,
        });
        document.body.dataset.animations = JSON.stringify(records);
      }
      return original.call(this, frames, options);
    };
    document.querySelector('kbar-provider')!.options = { animations: { enterMs: 40, exitMs: 30 } };
  });
  await page.locator('#open').click();
  const input = page.getByRole('combobox');
  await expect(input).toBeVisible();
  await expect(page.locator('kbar-animator')).toHaveCSS('opacity', '1');
  await input.fill('Change theme');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = JSON.parse(document.body.dataset.animations ?? '[]');
        return records.some(
          (record: { frames: Keyframe[]; duration: number }) =>
            record.frames.some((frame) => 'height' in frame) && record.duration === 20,
        );
      }),
    )
    .toBe(true);
  await input.press('Enter');
  await expect(input).toHaveAttribute('placeholder', 'Change theme');
  await input.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const records = await page.evaluate(() => JSON.parse(document.body.dataset.animations ?? '[]'));
  expect(records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ duration: 40, direction: 'normal' }),
      expect.objectContaining({ duration: 30, direction: 'reverse' }),
      expect.objectContaining({
        duration: 40,
        frames: [{ transform: 'scale(1)' }, { transform: 'scale(.98)' }, { transform: 'scale(1)' }],
      }),
    ]),
  );
});
