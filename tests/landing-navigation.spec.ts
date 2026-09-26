import { test, expect, type Page } from '@playwright/test';

async function saved(page: Page) {
  await expect(page.locator('.save-status')).toHaveText('Saved on this device');
}

async function storedEpisode(page: Page): Promise<unknown> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('carethread-local', 1);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('workspace').objectStore('workspace').get('episode');
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
    request.onerror = () => reject(request.error);
  }));
}

test('visitors see the landing first and explicitly enter an empty workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Get started', exact: true }).first()).toBeEnabled();
  await expect(page.getByRole('navigation', { name: 'Workspace', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create an episode', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Get started', exact: true }).first().click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole('button', { name: 'Create an episode', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveTitle('CareThread — Your workspace');
});

test('sample entry loads synthetic data once and keeps edited sample work on return', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a sample', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole('heading', { name: 'A clearer view of your tests.' })).toBeVisible();
  await saved(page);
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: /Question sheet/ }).click();
  await page.getByLabel('Question about Culture').fill('My saved sample question');
  await saved(page);
  const before = await storedEpisode(page);
  await page.getByRole('link', { name: 'CareThread home', exact: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'Continue my workspace', exact: true }).first().click();
  await saved(page);
  expect(await storedEpisode(page)).toEqual(before);
  await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: /Question sheet/ }).click();
  await expect(page.getByLabel('Question about Culture')).toHaveValue('My saved sample question');
});

test('saved episodes survive home, back, forward, and direct workspace reload', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Create an episode', exact: true }).click();
  await page.getByLabel('Person’s name').fill('Navigation Patient');
  await page.getByLabel('Episode name', { exact: true }).fill('Saved visit');
  await page.getByRole('button', { name: 'Create episode', exact: true }).click();
  await saved(page);
  const before = await storedEpisode(page);

  await page.getByRole('link', { name: 'CareThread home', exact: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Continue workspace', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore a sample', exact: true })).toHaveCount(0);
  expect(await storedEpisode(page)).toEqual(before);

  await page.goBack();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.locator('.episode-meta')).toContainText('Navigation Patient');
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await page.getByRole('button', { name: 'Continue my workspace', exact: true }).first().click();
  await page.reload();
  await expect(page).toHaveURL(/\/workspace$/);
  await saved(page);
  expect(await storedEpisode(page)).toEqual(before);
  await expect(page.locator('.episode-meta')).toContainText('Navigation Patient');
});

test('the narrow workspace brand is a keyboard-accessible way back home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workspace');
  await saved(page);
  const home = page.getByRole('link', { name: 'CareThread home', exact: true });
  await expect(home).toHaveCount(1);
  await home.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Get started', exact: true }).first()).toBeVisible();
});
