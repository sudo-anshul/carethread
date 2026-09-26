import { parseDocument } from './parser.ts';
import type { DocumentKind, EpisodeInput, SourceDocument, SourcePage } from './types';

export const DEMO_EPISODE: EpisodeInput = {
  label: 'September clinic visit', person: 'Demo Patient A', patientId: 'DEMO-A',
  reference: 'VISIT-A-0921', date: '2026-09-21',
};

export interface DemoSample {
  id: string;
  filename: string;
  name: string;
  description: string;
  kind: DocumentKind;
  group: 'initial' | 'return' | 'verification';
  pages: SourcePage[];
  scanOnly?: boolean;
}

const heading = 'DEMONSTRATION ONLY - FICTIONAL RECORD';
const person = 'Patient: Demo Patient A | Record ID: DEMO-A';

/** Public, known development fixtures; these are not held-out evaluation data. */
export const SAMPLES: DemoSample[] = [
  {
    id: 'demo-order', filename: 'order.pdf', name: 'Clinic test order', kind: 'order', group: 'initial',
    description: 'Three test orders for the September visit.',
    pages: [{ number: 1, text: [heading, person,
      'Visit: 21 September 2026 | Episode: VISIT-A-0921',
      'Order ID CT-O-01 | Test: Blood count | Ordered: 21 September 2026',
      'Order ID CT-O-02 | Test: Metabolic panel | Ordered: 21 September 2026',
      'Order ID CT-O-03 | Test: Culture | Ordered: 21 September 2026',
    ].join('\n') }],
  },
  {
    id: 'demo-blood-current', filename: 'blood-count-current.pdf', name: 'Blood count report', kind: 'report', group: 'initial',
    description: 'A current report referring to order CT-O-01.',
    pages: [{ number: 1, text: [heading, person,
      'Episode: VISIT-A-0921 | Order ID: CT-O-01',
      'Report ID: CT-R-11 | Test: Blood count',
      'Collection date: 21 September 2026 | Report date: 22 September 2026',
      'Report label: Final',
      'Clinical values intentionally omitted from this demonstration.',
    ].join('\n') }],
  },
  {
    id: 'demo-panel-partial', filename: 'metabolic-panel-partial.pdf', name: 'Partial metabolic panel report', kind: 'report', group: 'initial',
    description: 'A report explicitly marked partial, for order CT-O-02.',
    pages: [{ number: 1, text: [heading, person,
      'Episode: VISIT-A-0921 | Order ID: CT-O-02',
      'Report ID: CT-R-12 | Test: Metabolic panel',
      'Collection date: 21 September 2026 | Report date: 22 September 2026',
      'Report label: Partial report; additional results pending.',
      'Clinical values intentionally omitted from this demonstration.',
    ].join('\n') }],
  },
  {
    id: 'demo-blood-older', filename: 'blood-count-older.pdf', name: 'Earlier blood count report', kind: 'report', group: 'initial',
    description: 'A July report with a different episode and order identifier.',
    pages: [{ number: 1, text: [heading, person,
      'Episode: VISIT-A-0702 | Order ID: CT-O-OLD',
      'Report ID: CT-R-OLD | Test: Blood count',
      'Collection date: 2 July 2026 | Report date: 3 July 2026',
      'Clinical values intentionally omitted from this demonstration.',
    ].join('\n') }],
  },
  {
    id: 'demo-culture-return', filename: 'culture-returning.pdf', name: 'Returning culture report', kind: 'report', group: 'return',
    description: 'Add later to review the previously unlinked culture order.',
    pages: [{ number: 1, text: [heading, person,
      'Episode: VISIT-A-0921 | Order ID: CT-O-03',
      'Report ID: CT-R-13 | Test: Culture',
      'Collection date: 21 September 2026 | Report date: 24 September 2026',
      'Report label: Final',
      'Clinical values intentionally omitted from this demonstration.',
    ].join('\n') }],
  },
  {
    id: 'demo-wrong-person', filename: 'wrong-person.pdf', name: 'Different patient report', kind: 'report', group: 'verification',
    description: 'A synthetic identity conflict that must be kept out of the active episode.',
    pages: [{ number: 1, text: [heading,
      'Patient: Demo Patient B | Record ID: DEMO-B',
      'Episode: VISIT-A-0921 | Order ID: CT-O-01',
      'Report ID: CT-R-B | Test: Blood count',
      'Collection date: 21 September 2026 | Report date: 22 September 2026',
      'Clinical values intentionally omitted from this demonstration.',
    ].join('\n') }],
  },
  {
    id: 'demo-scan-only', filename: 'scan-only.pdf', name: 'Image-only source', kind: 'unknown', group: 'verification', scanOnly: true,
    description: 'An image-only PDF for testing the manual-entry fallback.',
    pages: [{ number: 1, text: '' }],
  },
  {
    id: 'demo-cancelled-order', filename: 'order-change.pdf', name: 'Order change note', kind: 'order', group: 'verification',
    description: 'An explicit cancellation of CT-O-03 and a separate new Culture order CT-O-04.',
    pages: [{ number: 1, text: [heading, person, 'Episode: VISIT-A-0921',
      'Cancelled order ID CT-O-03',
      'Order ID: CT-O-04 | Test: Culture | Ordered: 23 September 2026',
      'Administrative demonstration; clinical reasons are intentionally omitted.',
    ].join('\n') }],
  },
  {
    id: 'demo-amended-report', filename: 'metabolic-panel-amended.pdf', name: 'Explicit report amendment', kind: 'report', group: 'verification',
    description: 'A report explicitly stating it supersedes CT-R-12; review is still required.',
    pages: [{ number: 1, text: [heading, person,
      'Episode: VISIT-A-0921 | Order ID: CT-O-02',
      'Report ID: CT-R-14 | Test: Metabolic panel',
      'Collection date: 21 September 2026 | Report date: 24 September 2026',
      'Report label: Amended report',
      'This report supersedes report ID: CT-R-12.',
      'Clinical values intentionally omitted from this demonstration.',
    ].join('\n') }],
  },
];

export function sampleUrl(sample: Pick<DemoSample, 'filename'>): string {
  return `${import.meta.env.BASE_URL}samples/${sample.filename}`;
}

async function loadSample(sample: DemoSample): Promise<SourceDocument> {
  const response = await fetch(sampleUrl(sample));
  if (!response.ok) throw new Error(`Could not load demonstration source ${sample.filename}. Try again or import a sample file.`);
  const blob = await response.blob();
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  // The fixture passages below are the exact text used to produce these PDFs.
  // User imports use the normal PDF extraction path rather than these fixtures.
  const document = parseDocument({ id: sample.id, name: sample.filename, kind: sample.kind,
    pages: sample.pages, fingerprint, mime: 'application/pdf', size: blob.size });
  return { ...document, blob };
}

export async function demoDocuments(): Promise<SourceDocument[]> {
  return Promise.all(SAMPLES.filter(sample => sample.group === 'initial').map(loadSample));
}

export async function returningReport(): Promise<SourceDocument> {
  return loadSample(SAMPLES.find(sample => sample.group === 'return')!);
}

/** Used by the reproducible sample-generation script, not by document import. */
export async function createSamplePdf(sample: DemoSample, scanImage?: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(`CareThread demonstration - ${sample.name}`);
  pdf.setAuthor('CareThread synthetic development fixtures');
  pdf.setSubject('Fictional administrative document; no clinical values');
  pdf.setCreationDate(new Date('2026-09-25T00:00:00.000Z'));
  pdf.setModificationDate(new Date('2026-09-25T00:00:00.000Z'));
  if (sample.scanOnly) {
    if (!scanImage) throw new Error('The scan-only fixture requires its image asset.');
    const image = await pdf.embedPng(scanImage);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  } else {
    const font = await pdf.embedFont(StandardFonts.Courier);
    for (const sourcePage of sample.pages) {
      const page = pdf.addPage([595.28, 841.89]);
      let y = 788;
      for (const line of sourcePage.text.split('\n')) {
        page.drawText(line, { x: 40, y, font, size: 9.2, color: rgb(0.1, 0.14, 0.18) });
        y -= 23;
      }
    }
  }
  return pdf.save();
}
