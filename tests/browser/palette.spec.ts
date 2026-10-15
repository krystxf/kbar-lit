import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

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
  await search.fill('Change theme'); await search.press('Enter');
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
  await page.keyboard.press('g'); await page.keyboard.press('h');
  await expect(page.locator('#activity')).toHaveText('You are home.');
  await page.locator('#typing').fill(''); await page.locator('#typing').pressSequentially('gp');
  await expect(page.locator('#activity')).toHaveText('You are home.');
  await page.locator('#typing').blur(); await page.keyboard.press('t');
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
  expect(await page.locator('#typing').evaluate(input => input === document.activeElement)).toBe(false);
  await page.mouse.click(5, 5);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
