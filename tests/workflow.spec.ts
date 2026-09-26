import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

const sample = (name: string) => resolve('public/samples', name);
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: new RegExp(name) });
async function saved(page: Page) { await expect(page.locator('.save-status')).toHaveText('Saved on this device'); }
async function demo(page: Page) {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Explore the synthetic demo' }).click();
  await expect(page.getByRole('heading', { name: 'A clearer view of your tests.' })).toBeVisible();
  await saved(page);
}
async function questions(page: Page) { await nav(page, 'Question sheet').click(); }
async function reviewQuestions(page: Page) {
  const buttons = page.getByRole('button', { name: 'I reviewed this question', exact: true });
  while (await buttons.count()) await buttons.first().click();
}
async function store(page: Page): Promise<any> {
  await saved(page);
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
async function create(page: Page) {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Create an episode' }).click();
  await page.getByLabel('Person’s name').fill('Demo Patient A');
  await page.getByLabel('Episode name', { exact: true }).fill('September clinic visit');
  await page.getByRole('button', { name: 'Create episode', exact: true }).click();
}

test('fresh manual path keeps notes, exports Unicode text, survives reload and clears', async ({ page }) => {
  await create(page);
  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  await page.getByLabel('Test name').fill('Culture');
  await page.getByLabel('Your note').fill('Ask about the original order — café');
  await page.getByRole('button', { name: 'Add test item', exact: true }).click();
  await questions(page);
  await expect(page.getByLabel('Question about Culture')).toBeVisible();
  await page.getByLabel('Question about Culture').fill('Can you confirm the Culture order? café');
  await saved(page);
  await reviewQuestions(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const path = await (await download).path();
  expect(await readFile(path!, 'utf8')).toContain('Can you confirm the Culture order? café');
  const before = await store(page);
  expect(before.items[0].basis).toBe('note');
  await page.reload();
  await saved(page);
  await questions(page);
  await expect(page.getByLabel('Question about Culture')).toHaveValue('Can you confirm the Culture order? café');
  await page.getByRole('button', { name: 'Clear this episode', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear episode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create an episode' })).toBeVisible();
  expect(await store(page)).toBeUndefined();
});

test('source review blocks conflicts, retains partial scope, downloads PDF and handles a returning report', async ({ page }) => {
  await demo(page);
  await nav(page, 'Test items').click();
  await expect(page.locator('.candidate').filter({ hasText: 'blood-count-older.pdf' }).getByRole('button', { name: 'Link report', exact: true })).toBeDisabled();
  await page.locator('.candidate').filter({ hasText: 'blood-count-current.pdf' }).getByRole('button', { name: 'Link report', exact: true }).click();
  await expect(page.locator('.linked-candidate')).toContainText('blood-count-current.pdf');
  await page.locator('.test-index-row').filter({ hasText: 'Metabolic panel' }).click();
  await page.locator('.candidate').filter({ hasText: 'metabolic-panel-partial.pdf' }).getByRole('button', { name: 'Link report', exact: true }).click();
  await expect(page.locator('.detail-status')).toContainText(/partial/i);
  await questions(page);
  await page.getByLabel('Question about Culture').fill('Could you send me the Culture report for this visit?');
  await page.getByRole('heading', { name: 'Make these yours' }).click();
  await page.locator('.question-edit-card').filter({ hasText: 'Blood count' }).getByRole('checkbox').uncheck();
  await reviewQuestions(page);
  const pdfEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const pdfFile = await (await pdfEvent).path();
  const pdf = await PDFDocument.load(await readFile(pdfFile!));
  expect(pdf.getPages().length).toBeGreaterThan(0);
  expect(pdf.getTitle()).toContain('Questions for my clinic');
  await page.getByLabel('Choose documents', { exact: true }).setInputFiles(sample('culture-returning.pdf'));
  await expect(page.locator('.import-progress .spin')).toHaveCount(0);
  await saved(page);
  await expect(page.getByLabel('Question about Culture')).toHaveValue('Could you send me the Culture report for this visit?');
  expect((await store(page)).links).toHaveLength(2);
  await nav(page, 'Test items').click();
  await page.locator('.test-index-row').filter({ hasText: 'Culture' }).click();
  await page.locator('.candidate').filter({ hasText: 'culture-returning.pdf' }).getByRole('button', { name: 'Link report', exact: true }).click();
  await questions(page);
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  await expect(page.getByLabel('Question about Culture')).toHaveValue('Could you send me the Culture report for this visit?');
  await reviewQuestions(page);
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
});

test('real PDF import, duplicate suppression, unreadable fallback and wrong-person isolation', async ({ page }) => {
  await create(page);
  await page.getByLabel('Choose documents', { exact: true }).setInputFiles([sample('order.pdf'), sample('blood-count-current.pdf'), sample('scan-only.pdf'), sample('wrong-person.pdf')]);
  await expect(page.locator('.import-progress > div')).toHaveCount(4);
  await expect(page.locator('.import-progress .spin')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('.overview-test-row')).toHaveCount(3);
  await nav(page, 'Documents').click();
  await expect(page.locator('.document-row')).toHaveCount(4);
  const wrong = page.locator('.document-row').filter({ hasText: 'wrong-person.pdf' });
  await expect(wrong).toContainText('Excluded from this episode');
  await expect(wrong.getByRole('button', { name: 'View source', exact: true })).toHaveCount(0);
  await expect(page.locator('.document-row').filter({ hasText: 'scan-only.pdf' })).toContainText('Not read');
  await page.getByLabel('Choose documents', { exact: true }).setInputFiles(sample('order.pdf'));
  await expect(page.getByText(/Already added as order.pdf/)).toBeVisible();
  expect((await store(page)).documents).toHaveLength(4);
  await questions(page); await reviewQuestions(page);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const text = await readFile((await (await event).path())!, 'utf8');
  expect(text).not.toContain('Demo Patient B');
  expect(text).not.toContain('DEMO-B');
});

test('source deletion removes stored bytes and derived items with no undo retention', async ({ page }) => {
  await demo(page); await nav(page, 'Documents').click();
  await page.getByRole('button', { name: 'Remove order.pdf', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove document', exact: true }).click();
  const ep = await store(page);
  expect(ep.documents.some((d: any) => d.name === 'order.pdf')).toBe(false);
  expect(ep.items).toHaveLength(0);
  expect(ep.links).toHaveLength(0);
  expect(ep.questions.some((q: any) => q.evidence.some((e: any) => e.documentId === 'demo-order'))).toBe(false);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  await page.reload(); await saved(page);
  expect((await store(page)).items).toHaveLength(0);
});

test('replacement keeps the order test list and a failed replacement retains original', async ({ page }) => {
  await demo(page); await nav(page, 'Documents').click();
  await page.getByRole('button', { name: 'Replace order.pdf', exact: true }).click();
  await page.getByRole('button', { name: 'Choose replacement', exact: true }).click();
  await page.getByLabel('Choose replacement document').setInputFiles(sample('scan-only.pdf'));
  await expect(page.getByText(/replacement could not be read/)).toBeVisible();
  expect((await store(page)).items).toHaveLength(3);
  await page.getByRole('button', { name: 'Replace order.pdf', exact: true }).click();
  await page.getByRole('button', { name: 'Choose replacement', exact: true }).click();
  const text = 'Patient: Demo Patient A\nRecord ID: DEMO-A\nEpisode: VISIT-A-0921\nOrder ID: CT-O-01 | Test: Blood count | Ordered: 21 September 2026\nOrder ID: CT-O-02 | Test: Metabolic panel | Ordered: 21 September 2026\nOrder ID: CT-O-03 | Test: Culture | Ordered: 21 September 2026';
  await page.getByLabel('Choose replacement document').setInputFiles({ name: 'replacement-order.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.locator('.document-row').filter({ hasText: 'replacement-order.txt' })).toBeVisible();
  const ep = await store(page);
  expect(ep.items).toHaveLength(3);
  expect(ep.documents).toHaveLength(4);
  expect(ep.items.every((i: any) => i.evidence.documentId !== 'demo-order')).toBe(true);
});

test('a failed save is truthful and Retry preserves in-memory changes', async ({ page }) => {
  await demo(page);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    (window as any).restoreTransactions = () => { IDBDatabase.prototype.transaction = original; };
    IDBDatabase.prototype.transaction = function (...args: any[]) {
      if (args[1] === 'readwrite') throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      return original.apply(this, args as any);
    };
  });
  await page.getByRole('button', { name: 'Add manually', exact: true }).click();
  await page.getByLabel('Test name').fill('Synthetic unsaved item');
  await page.getByRole('button', { name: 'Add test item', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Changes not saved' })).toBeVisible();
  await expect(page.getByText(/previous saved copy, including any documents/)).toBeVisible();
  await expect(page.locator('.overview-test-row').filter({ hasText: 'Synthetic unsaved item' })).toBeVisible();
  await page.evaluate(() => (window as any).restoreTransactions());
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  expect((await store(page)).items).toHaveLength(4);
  await page.reload(); await saved(page);
  await expect(page.locator('.overview-test-row').filter({ hasText: 'Synthetic unsaved item' })).toBeVisible();
});

test('a temporary PDF-font failure recovers on retry and export retains readable questions', async ({ page }) => {
  await demo(page); await questions(page); await reviewQuestions(page);
  let failFont = true;
  await page.route(/manrope-latin-400-normal-.*\.woff$/, async route => {
    if (failFont) { failFont = false; await route.fulfill({ status: 503, body: 'Synthetic transient failure' }); }
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.getByText(/PDF font could not be loaded|export could not be created/)).toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const bytes = new Uint8Array(await readFile((await (await event).path())!));
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes, useWorkerFetch: false });
  try {
    const pdf = await task.promise; let text = '';
    for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map(x => 'str' in x ? x.str : '').join(' ');
    expect(text).toContain('SYNTHETIC DEMONSTRATION');
    expect(text).toContain('Culture');
    expect(text).toContain('Source: order.pdf, page 1');
    expect(text).toContain('CT-O-03');
  } finally { await task.destroy(); }
});

test('oversize, corrupt and unsupported inputs fail independently while a good file survives', async ({ page }) => {
  await create(page);
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 'a');
  const manyPages = await PDFDocument.create(); for (let i = 0; i < 31; i++) manyPages.addPage();
  await page.getByLabel('Choose documents', { exact: true }).setInputFiles([
    { name: 'oversized.txt', mimeType: 'text/plain', buffer: oversized },
    { name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
    { name: 'unsupported.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b') },
    { name: 'too-many-pages.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await manyPages.save()) },
    { name: 'order.pdf', mimeType: 'application/pdf', buffer: await readFile(sample('order.pdf')) },
  ]);
  await expect(page.locator('.import-progress > div')).toHaveCount(5);
  await expect(page.locator('.import-progress .spin')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('.import-progress')).toContainText('larger than 10 MB');
  await expect(page.locator('.import-progress')).toContainText('up to 30 pages');
  await expect(page.locator('.import-progress')).toContainText('Choose a PDF');
  const ep = await store(page);
  expect(ep.documents).toHaveLength(1); expect(ep.items).toHaveLength(3);
});

test('malformed saved workspace fails safely and can be cleared from welcome', async ({ page }) => {
  await demo(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('carethread-local', 1);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('workspace', 'readwrite');
      tx.objectStore('workspace').put({ schemaVersion: 1, documents: [], items: [], questions: [] }, 'episode');
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Clear saved workspace', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear saved workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear episode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create an episode' })).toBeEnabled();
  expect(await store(page)).toBeUndefined();
});

test('desktop and narrow main states pass automated accessibility checks with no horizontal overflow', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/workspace'); await saved(page);
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
  const audit = async () => {
    const violations = await page.evaluate(async () => (await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((v: any) => ({ id: v.id, nodes: v.nodes.map((n: any) => n.target) })));
    expect(violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  };
  await audit();
  await page.getByRole('button', { name: 'Create an episode' }).click();
  await expect(page.getByLabel('Person’s name')).toBeFocused();
  await audit(); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Create an episode' })).toBeFocused();
  await page.getByRole('button', { name: 'Explore the synthetic demo' }).click();
  await audit();
  await nav(page, 'Test items').click(); await audit();
  await questions(page); await audit();
  await page.setViewportSize({ width: 390, height: 844 }); await audit();
  await page.getByRole('navigation', { name: 'Mobile workspace', exact: true }).getByRole('button', { name: 'Tests', exact: true }).click(); await audit();
  expect(errors).toEqual([]);
});
