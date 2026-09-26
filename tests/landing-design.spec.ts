import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => animation.timeline instanceof DocumentTimeline).map(animation => animation.finished.catch(() => {})));
  });
}

test('landing image, reading order and content fit desktop, tablet and narrow screens', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your health\s+paperwork\.\s*A clearer next step\./);
  const photo = page.locator('.lp-photo-frame img');
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await settled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Get started', exact: true }).first()).toBeVisible();
    if (width <= 680) {
      const imageBox = await photo.boundingBox(); const noteBox = await page.locator('.lp-hero-note').boundingBox();
      expect(noteBox!.y).toBeGreaterThanOrEqual(imageBox!.y + imageBox!.height - 4);
    }
  }
  expect(errors).toEqual([]);
});

test('mobile menu and FAQs support keyboard operation and automated accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/'); await settled(page);
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
  const audit = async () => {
    const violations = await page.evaluate(async () => (await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => n.target) })));
    expect(violations).toEqual([]);
  };
  await audit();
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible(); await audit();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'How it works' }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
  for (const summary of await page.locator('.lp-faq summary').all()) { await summary.focus(); await page.keyboard.press('Enter'); }
  await expect(page.locator('.lp-faq details[open]')).toHaveCount(4);
  await audit();
  await page.setViewportSize({ width: 1440, height: 1000 }); await audit();
});

test('scroll advances the explanation, buttons respond to hover, and reduced motion stays usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/'); await settled(page);
  const primary = page.getByRole('button', { name: 'Get started', exact: true }).first();
  await primary.hover();
  await expect.poll(() => primary.evaluate(element => getComputedStyle(element).transform)).not.toBe('none');
  for (const index of [1, 2, 0]) {
    await page.locator(`[data-step="${index}"]`).evaluate(element => {
      window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - innerHeight * .36, behavior: 'instant' });
    });
    await expect(page.locator('.lp-walkthrough-visual')).toHaveClass(new RegExp(`lp-scene-${index}`));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.lp-step').nth(2).click();
  await expect(page.locator('.lp-walkthrough-visual')).toHaveClass(/lp-scene-2/);
  await expect(page.locator('.lp-step').nth(2)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.lp-paper-questions').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  expect(await page.locator('.lp-walkthrough-sticky').evaluate(element => getComputedStyle(element).position)).toBe('static');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.lp-step').nth(1).click();
  await expect(page.locator('.lp-walkthrough-visual')).toHaveClass(/lp-scene-1/);
});
