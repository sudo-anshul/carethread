import { test, expect } from '@playwright/test';

test('search keeps the review target within visible results and supports keyboard selection', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Explore the synthetic demo' }).click();
  await expect(page.getByRole('heading', { name: 'A clearer view of your tests.' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Workspace', exact: true })
    .getByRole('button', { name: /Test items/ }).click();
  await expect(page.getByRole('region', { name: 'Review Blood count', exact: true })).toBeVisible();

  const search = page.getByRole('textbox', { name: 'Search test items' });
  await search.fill('Culture');
  await expect(page.locator('.test-index-row')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Review Culture', exact: true })).toBeVisible();
  await expect(page.locator('.test-index-row')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: 'Review Blood count', exact: true })).toHaveCount(0);

  await search.fill('no matching test');
  await expect(page.getByText('No items match “no matching test”.', { exact: true })).toBeVisible();
  await expect(page.locator('.test-detail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Link report', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);

  await search.fill('');
  const culture = page.locator('.test-index-row').filter({ hasText: 'Culture' });
  await culture.focus();
  await page.keyboard.press('Enter');
  await expect(culture).toBeFocused();
  await expect(culture).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: 'Review Culture', exact: true })).toBeVisible();

  await search.fill('Cult');
  await expect(page.getByRole('region', { name: 'Review Culture', exact: true })).toBeVisible();
  await search.fill('');
  await expect(culture).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: 'Review Culture', exact: true })).toBeVisible();
});
