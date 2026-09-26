import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { SAMPLES, createSamplePdf } from '../src/core/demo.ts';
import { parseDocument } from '../src/core/parser.ts';
import type { SourceDocument, SourcePage } from '../src/core/types.ts';

// Generate: node --experimental-strip-types scripts/make-samples.ts
// Verify retained PDF files: node --experimental-strip-types scripts/make-samples.ts --verify
// The supplied scan-only.png is the retained synthetic raster source.
const target = new URL('../public/samples/', import.meta.url);
if (process.argv.includes('--verify')) {
  const { getDocument, version } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fields = (document: SourceDocument) => ({
    kind: document.kind, status: document.status, person: document.person, patientId: document.patientId,
    episodeRef: document.episodeRef, orderIds: document.orderIds, date: document.date,
    collectionDate: document.collectionDate, reportDate: document.reportDate, reportId: document.reportId,
    reportLabel: document.reportLabel,
    entries: document.entries.map(entry => ({ label: entry.label, orderId: entry.orderId, date: entry.date })),
    notices: document.notices.map(notice => ({ type: notice.type, targetId: notice.targetId })),
  });
  let entryCount = 0;
  for (const sample of SAMPLES) {
    const bytes = new Uint8Array(await readFile(new URL(sample.filename, target)));
    const task = getDocument({ data: bytes, useWorkerFetch: false,
      standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)) });
    try {
      const pdf = await task.promise;
      const pages: SourcePage[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        let text = '';
        let previousY: number | undefined;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform[5];
          if (previousY !== undefined && Math.abs(y - previousY) > 3 && !text.endsWith('\n')) text += '\n';
          text += item.str;
          text += item.hasEOL ? '\n' : ' ';
          previousY = y;
        }
        pages.push({ number, text: text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim() });
        page.cleanup();
      }
      const actual = parseDocument({ id: sample.id, name: sample.filename, pages, fingerprint: 'verified-file' });
      const expected = parseDocument({ id: sample.id, name: sample.filename, pages: sample.pages, fingerprint: 'fixture' });
      assert.deepEqual(pages, sample.pages, `${sample.filename}: retained fixture text differs from actual PDF extraction`);
      assert.deepEqual(fields(actual), fields(expected), `${sample.filename}: administrative facts differ after actual PDF extraction`);
      for (const entry of actual.entries) {
        const sourcePage = pages.find(page => page.number === entry.evidence.page);
        assert(sourcePage?.text.includes(entry.evidence.quote), `${sample.filename}: entry quote must exist on its source page`);
        assert(entry.evidence.quote.includes(entry.label), `${sample.filename}: entry label must be supported`);
        assert(!entry.orderId || entry.evidence.quote.includes(entry.orderId), `${sample.filename}: entry order ID must be supported`);
        assert(!entry.date || entry.evidence.quote.includes(entry.date), `${sample.filename}: entry date must be supported`);
      }
      for (const notice of actual.notices) {
        assert(pages.find(page => page.number === notice.evidence.page)?.text.includes(notice.evidence.quote));
        assert(!notice.targetId || notice.evidence.quote.includes(notice.targetId));
      }
      if (sample.filename === 'order-change.pdf') {
        assert.equal(actual.kind, 'order');
        assert(actual.entries.some(entry => entry.orderId === 'CT-O-04'));
        assert(actual.notices.some(notice => notice.type === 'cancelled' && notice.targetId === 'CT-O-03'));
      }
      if (sample.scanOnly) assert.equal(actual.status, 'unreadable');
      if (sample.filename === 'wrong-person.pdf') assert.equal(actual.patientId, 'DEMO-B');
      entryCount += actual.entries.length;
      console.log(`PASS ${sample.filename}: ${actual.status}, ${actual.entries.length} test entries, exact source passages`);
    } finally {
      await task.destroy();
    }
  }
  console.log(`Verified ${SAMPLES.length} actual PDFs and ${entryCount} supported test entries with PDF.js ${version}.`);
} else {
  await mkdir(target, { recursive: true });
  for (const sample of SAMPLES) {
    const raster = sample.scanOnly ? await readFile(new URL('scan-only.png', target)) : undefined;
    const bytes = await createSamplePdf(sample, raster);
    const destination = new URL(sample.filename, target);
    await writeFile(destination, bytes);
    console.log(`${fileURLToPath(destination)} (${bytes.length} bytes)`);
  }
  await writeFile(new URL('README.txt', target), [
  'CARETHREAD SYNTHETIC DEVELOPMENT SOURCES',
  'These files contain fictional administrative information and no clinical values.',
  'They are known development fixtures, not real medical records or held-out evaluation data.',
  '',
  ...SAMPLES.map(sample => `${sample.filename}: ${sample.description}`),
  '',
  'The initial demo uses order.pdf, blood-count-current.pdf, metabolic-panel-partial.pdf and blood-count-older.pdf.',
  'Import culture-returning.pdf later to try the return-and-review workflow.',
  'scan-only.pdf deliberately contains an image with no selectable text. It tests manual fallback, not OCR.',
  'No source document establishes clinician review, completed care or a medical interpretation.',
  ].join('\n'));
}
