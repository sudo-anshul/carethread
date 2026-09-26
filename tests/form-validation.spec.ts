import { test, expect, type Locator, type Page } from '@playwright/test';

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: new RegExp(name) });
const saved = (page: Page) => expect(page.locator('.save-status')).toHaveText('Saved on this device');
async function invalid(field: Locator, message: string) {
  await expect(field).toBeFocused();
  expect(await field.evaluate((element: HTMLInputElement | HTMLTextAreaElement) => element.validationMessage)).toBe(message);
  await expect(field).toHaveValue(/^\s+$/);
}

test('required text rejects whitespace with field feedback and recovers without losing the draft', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Create an episode', exact: true }).click();
  const person = page.getByLabel('Person’s name');
  const episode = page.getByLabel('Episode name', { exact: true });
  await person.fill('   ');
  await episode.fill('Fictional review visit');
  await page.getByRole('button', { name: 'Create episode', exact: true }).click();
  await invalid(person, 'Enter the person’s name.');
  await expect(episode).toHaveValue('Fictional review visit');
  await person.fill('Fictional Patient');
  await episode.fill('   ');
  await page.getByRole('button', { name: 'Create episode', exact: true }).click();
  await invalid(episode, 'Enter an episode name.');
  await expect(person).toHaveValue('Fictional Patient');
  await episode.fill('Fictional review visit');
  await page.getByRole('button', { name: 'Create episode', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await saved(page);

  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  const item = page.getByLabel('Test name');
  await item.fill('   ');
  await page.getByLabel('Your note').fill('Keep this draft wording.');
  await page.getByRole('button', { name: 'Add test item', exact: true }).click();
  await invalid(item, 'Enter a test name.');
  await expect(page.getByLabel('Your note')).toHaveValue('Keep this draft wording.');
  await item.fill('Fictional test');
  await page.getByRole('button', { name: 'Add test item', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await saved(page);

  await nav(page, 'Documents').click();
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  const name = page.getByLabel('Document name');
  const text = page.getByLabel('Original document text');
  await name.fill('   ');
  await text.fill('A fictional note for the review visit.');
  await page.getByRole('button', { name: 'Add source text', exact: true }).click();
  await invalid(name, 'Enter a document name.');
  await expect(text).toHaveValue('A fictional note for the review visit.');
  await name.fill('Fictional visit note');
  await text.fill(' \n  ');
  await page.getByRole('button', { name: 'Add source text', exact: true }).click();
  await invalid(text, 'Paste the original document text.');
  await expect(name).toHaveValue('Fictional visit note');
  await text.fill('A fictional note for the review visit.');
  await page.getByLabel('Document type').selectOption('note');
  await page.getByRole('button', { name: 'Add source text', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.document-row').filter({ hasText: 'Fictional visit note' })).toBeVisible();
});

test('exact-source text has a named keyboard scroll region and reverse focus clears the sticky heading', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Explore the synthetic demo' }).click();
  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  await page.getByLabel('Test name').fill('Blood count');
  await page.getByText('Attach exact source evidence', { exact: false }).click();
  await page.getByLabel('Source document').selectOption({ label: 'order.pdf' });
  await page.getByRole('combobox', { name: /^Page/ }).selectOption('1');
  await page.getByRole('combobox', { name: /^Page/ }).focus();
  await page.keyboard.press('Tab');
  const source = page.getByRole('region', { name: 'Source text from order.pdf, page 1', exact: true });
  await expect(source).toBeFocused();
  const scrollBefore = await source.evaluate(element => element.scrollTop);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => source.evaluate(element => element.scrollTop)).toBeGreaterThan(scrollBefore);

  await page.getByLabel('Exact quote').fill('Blood count absent from the source');
  await page.getByRole('button', { name: 'Add test item', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The exact quote must appear');
  for (let i = 0; i < 9; i++) await page.keyboard.press('Shift+Tab');
  const reference = page.getByLabel('Order reference');
  await expect(reference).toBeFocused();
  const fieldBounds = await reference.boundingBox();
  const headerBounds = await page.locator('.dialog-heading').boundingBox();
  expect(fieldBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y + headerBounds!.height);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Add manually', exact: true })).toBeFocused();
});
