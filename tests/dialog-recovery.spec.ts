import { test, expect, type Page } from '@playwright/test';

async function demo(page: Page) {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Explore the synthetic demo' }).click();
  await expect(page.getByRole('heading', { name: 'A clearer view of your tests.' })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
}

test('a rejected pasted source keeps its fields and supports correction and retry', async ({ page }) => {
  await demo(page);
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: /Documents/ }).click();
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  await page.getByLabel('Document name', { exact: true }).fill('My retained source');
  const text = page.getByLabel('Original document text');
  const oversized = 'x'.repeat(10 * 1024 * 1024 + 1);
  await text.fill(oversized);
  await page.getByRole('button', { name: 'Add source text', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('This text is too large');
  await expect(dialog.getByRole('alert')).toBeFocused();
  await expect(page.getByLabel('Document name', { exact: true })).toHaveValue('My retained source');
  expect(await text.inputValue()).toBe(oversized);
  await page.getByRole('combobox', { name: /^Document type/ }).selectOption('note');
  await text.fill('A source note for my next clinic conversation.');
  await page.getByRole('button', { name: 'Add source text', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.document-row').filter({ hasText: 'My retained source' })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
});

test('a manual draft stays open while files are reading and saves after processing ends', async ({ page }) => {
  await demo(page);
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (...args) => new Promise((resolve, reject) => {
      (window as any).finishImport = () => { crypto.subtle.digest = original; original(...args).then(resolve, reject); };
    });
  });
  await page.getByLabel('Choose documents', { exact: true }).setInputFiles({ name: 'pending-note.txt', mimeType: 'text/plain', buffer: Buffer.from('A fictional note for this episode.') });
  await expect(page.locator('.import-progress')).toContainText('Reading');
  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  await page.getByLabel('Test name', { exact: true }).fill('My draft test');
  await page.getByLabel('Your note').fill('Keep this wording while the file finishes.');
  const submit = page.getByRole('button', { name: 'Add test item', exact: true });
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => (window as any).finishImport());
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel('Test name', { exact: true })).toHaveValue('My draft test');
  await expect(page.getByLabel('Your note')).toHaveValue('Keep this wording while the file finishes.');
  await submit.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.overview-test-row').filter({ hasText: 'My draft test' })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
});

test('create and clear return focus to the workspace when the opening control disappears', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Create an episode', exact: true }).click();
  await page.getByLabel('Person’s name').fill('Fictional Review Patient');
  await page.getByLabel('Episode name', { exact: true }).fill('Focus review');
  await page.getByRole('button', { name: 'Create episode', exact: true }).click();
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
  await page.getByRole('button', { name: 'Clear this episode', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear episode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create an episode', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
});
