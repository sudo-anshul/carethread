import type { DocumentKind, Evidence, SourceDocument, SourceEntry, SourceNotice, SourcePage } from './types';

/**
 * A deliberately limited parser for explicit administrative labels. It is not
 * OCR, a medical interpretation system, or a general-purpose document model.
 * Unrecognized layouts retain their text for the manual source-review route.
 */
export interface ParseDocumentInput {
  id: string;
  name: string;
  pages: SourcePage[];
  fingerprint: string;
  kind?: DocumentKind;
  mime?: string;
  size?: number;
}

type Field = { key: string; value: string; position: number };
type Row = { page: number; original: string; fields: Field[]; start: number; end: number };

// A field must begin a line or follow a visible separator. A word occurring
// inside a clinical narrative is not enough to manufacture an extracted field.
const labels = [
  'Patient name', 'Patient ID', 'Record ID', 'Patient', 'Episode reference', 'Episode ID', 'Episode',
  'Visit date', 'Visit', 'Order date', 'Ordered', 'Order ID', 'Collection date', 'Collected',
  'Report date', 'Reported', 'Report ID', 'Report label', 'Report status', 'Test name', 'Test', 'Status',
];
const fieldPattern = new RegExp(
  `(?:^|\\||\\t+| {2,}|;\\s+)\\s*(?<key>${labels.join('|')})\\s*:\\s*`, 'gi',
);

function fieldsFromLine(line: string): Field[] {
  // Printed fixture line numbers are not part of field values. Evidence still
  // contains the untouched original line, including any such line number.
  const input = line.replace(/^\s*\d{1,3}\s{2,}/, '').trim();
  const matches = [...input.matchAll(fieldPattern)].map(match => ({
    key: match.groups!.key.toLowerCase(),
    position: match.index!,
    start: match.index! + match[0].length,
  }));
  // "Order ID CT-O-01" is an explicit identifier even without a colon.
  const noColonOrder = /(?:^|\|)\s*Order ID\s+(?!:)([^|\s]+)(?=\s*(?:\||$))/gi;
  for (const match of input.matchAll(noColonOrder)) {
    if (!matches.some(existing => existing.position === match.index)) {
      matches.push({ key: 'order id', position: match.index!, start: match.index! + match[0].indexOf(match[1]) });
    }
  }
  matches.sort((a, b) => a.position - b.position);
  return matches.map((match, index) => ({
    key: match.key,
    value: input.slice(match.start, matches[index + 1]?.position ?? input.length).replace(/\s*\|\s*$/, '').trim(),
    position: match.position,
  })).filter(field => field.value.length > 0);
}

function first(fields: Field[], keys: string[]): string | undefined {
  return fields.find(field => keys.includes(field.key))?.value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function identityValues(rows: Row[], keys: string[]): string[] {
  return unique(rows.flatMap(row => row.fields.filter(field => keys.includes(field.key)).map(field => field.value)));
}

function hasIdentityConflict(values: string[]): boolean {
  return new Set(values.map(value => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim())).size > 1;
}

function tableCells(line: string): string[] {
  if (!line.includes('|') && !line.includes('\t')) return [];
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split(/\||\t+/).map(value => value.trim());
}

function isIdentifier(value: string): boolean {
  return /^[a-z\d][a-z\d._/-]{0,79}$/i.test(value);
}

export function parseDocument(input: ParseDocumentInput): SourceDocument {
  const rows: Row[] = input.pages.flatMap(page => {
    let offset = 0;
    return page.text.split('\n').map(line => {
      const original = line.replace(/\r$/, '');
      const row = { page: page.number, original, fields: fieldsFromLine(original), start: offset, end: offset + original.length };
      offset += line.length + 1;
      return row;
    }).filter(row => row.original.trim());
  });
  const allFields = rows.flatMap(row => row.fields);
  const people = identityValues(rows, ['patient', 'patient name']);
  const patientIds = identityValues(rows, ['patient id', 'record id']);
  const episodes = identityValues(rows, ['episode', 'episode reference', 'episode id']);
  const text = input.pages.map(page => page.text).join('\n');
  const meaningful = (text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 4;
  const reportLabel = first(allFields, ['report label', 'report status']);
  const reportId = first(allFields, ['report id']);
  const reportDate = first(allFields, ['report date', 'reported']);
  const collectionDate = first(allFields, ['collection date', 'collected']);
  const date = first(allFields, ['order date', 'ordered', 'visit date', 'visit']);
  const explicitReportHeading = rows.some(row => /^(?:laboratory |lab |diagnostic )?(?:partial |preliminary |amended )?(?:test )?report\s*$/i.test(row.original.trim()));
  const explicitOrderHeading = rows.some(row => /^(?:laboratory |lab |diagnostic )?(?:test )?orders?\s*$/i.test(row.original.trim()));
  const inferredKind: DocumentKind = reportId || reportDate || reportLabel || explicitReportHeading ? 'report'
    : explicitOrderHeading || allFields.some(field => field.key === 'ordered' || field.key === 'order date') ? 'order' : 'unknown';
  const kind = input.kind ?? inferredKind;
  const evidence = (row: Row): Evidence => ({
    documentId: input.id, fingerprint: input.fingerprint, page: row.page, quote: row.original,
  });
  const spanEvidence = (row: Row, supportingRows: (Row | undefined)[]): Evidence => {
    const included = [row, ...supportingRows.filter((support): support is Row => Boolean(support && support.page === row.page))];
    const page = input.pages.find(page => page.number === row.page)!;
    return { ...evidence(row), quote: page.text.slice(Math.min(...included.map(item => item.start)), Math.max(...included.map(item => item.end))) };
  };
  const orderIds = unique(allFields.filter(field => field.key === 'order id').map(field => field.value));
  const entries: SourceEntry[] = [];
  const notices: SourceNotice[] = [];

  let tableHeader: string[] | undefined;
  let tablePage: number | undefined;
  for (const row of rows) {
    if (row.page !== tablePage) tableHeader = undefined;
    tablePage = row.page;
    const tests = row.fields.filter(field => field.key === 'test' || field.key === 'test name');
    for (const test of tests) {
      const idsOnLine = row.fields.filter(field => field.key === 'order id');
      // Multiple tests/IDs on one physical line do not establish which ID
      // belongs to which test. Preserve the names and leave IDs unresolved.
      const inheritedIdRow = idsOnLine.length === 0 && orderIds.length === 1 ? rows.find(other => other.page === row.page && other.fields.some(field => field.key === 'order id' && field.value === orderIds[0])) : undefined;
      const orderId = idsOnLine.length === 1 && tests.length === 1 ? idsOnLine[0].value
        : inheritedIdRow ? orderIds[0] : undefined;
      const localDate = first(row.fields, ['ordered', 'order date', 'collection date', 'collected']);
      const inheritedDate = kind === 'order' ? date : collectionDate;
      const dateKeys = kind === 'order' ? ['ordered', 'order date', 'visit date', 'visit'] : ['collection date', 'collected'];
      const inheritedDateRow = !localDate && inheritedDate ? rows.find(other => other.page === row.page && other.fields.some(field => dateKeys.includes(field.key) && field.value === inheritedDate)) : undefined;
      const entryDate = localDate ?? (inheritedDateRow ? inheritedDate : undefined);
      entries.push({ label: test.value, orderId, date: entryDate, evidence: spanEvidence(row, [inheritedIdRow, inheritedDateRow]) });
    }

    const cells = tableCells(row.original);
    const normalizedCells = cells.map(cell => cell.toLowerCase().replace(/:$/, ''));
    const testColumn = normalizedCells.findIndex(cell => ['test', 'test name'].includes(cell));
    const hasSupportingColumn = normalizedCells.some(cell => ['order id', 'ordered', 'order date', 'collection date'].includes(cell));
    if (testColumn >= 0 && hasSupportingColumn && row.fields.length === 0) {
      tableHeader = normalizedCells;
    } else if (tableHeader && cells.length === tableHeader.length && !tests.length && row.fields.length === 0) {
      const label = cells[tableHeader.findIndex(cell => ['test', 'test name'].includes(cell))];
      const idColumn = tableHeader.indexOf('order id');
      const rowId = idColumn >= 0 ? cells[idColumn] : undefined;
      const dateColumn = tableHeader.findIndex(cell => ['ordered', 'order date', 'collection date'].includes(cell));
      // A Markdown table divider or a row with an invalid ID is not a test.
      if (label && !/^[:\s-]+$/.test(label) && (!rowId || isIdentifier(rowId))) {
        if (rowId && !orderIds.includes(rowId)) orderIds.push(rowId);
        entries.push({ label, orderId: rowId || undefined, date: dateColumn >= 0 ? cells[dateColumn] || undefined : undefined, evidence: evidence(row) });
      }
    } else if (cells.length === 0 && row.fields.length === 0) {
      tableHeader = undefined;
    }

    const explicitLabel = first(row.fields, ['report label', 'report status']);
    const status = first(row.fields, ['status']);
    const noticeText = explicitLabel ?? (/^(?:partial|preliminary|amended) report\s*$/i.test(row.original.trim()) ? row.original.trim() : undefined);
    if (noticeText && /^(?:partial\b|.*\bpartial report\b)/i.test(noticeText) && !/\b(?:not|no)\s+(?:a\s+)?partial\b/i.test(noticeText)) {
      notices.push({ type: 'partial', evidence: evidence(row) });
    }
    if (noticeText && /\bpreliminary\b/i.test(noticeText) && !/\b(?:not|no)\s+(?:a\s+)?preliminary\b/i.test(noticeText)) {
      notices.push({ type: 'preliminary', evidence: evidence(row) });
    }
    const cancelled = row.original.match(/^\s*(?:\d{1,3}\s{2,})?Cancel(?:led|ed)\s+order(?:\s+ID)?\s*:?\s*([a-z\d][a-z\d._/-]*)\b/i);
    const rowOrderIds = row.fields.filter(field => field.key === 'order id');
    if (cancelled) notices.push({ type: 'cancelled', targetId: cancelled[1], evidence: evidence(row) });
    else if (status && /^cancel(?:led|ed)\b/i.test(status) && rowOrderIds.length === 1) {
      notices.push({ type: 'cancelled', targetId: rowOrderIds[0].value, evidence: evidence(row) });
    }
    const supersedes = row.original.match(/(?:^\s*(?:This\s+report\s+)?Supersedes\s+(?:report\s*(?:ID)?\s*:?\s*)?|^\s*Amendment\s+to\s+report\s*(?:ID)?\s*:?\s*)([a-z\d][a-z\d._/-]*)/i);
    if (supersedes) notices.push({ type: 'amended', targetId: supersedes[1].replace(/\.$/, ''), evidence: evidence(row) });
    else if (noticeText && /^amended\b/i.test(noticeText)) notices.push({ type: 'amended', evidence: evidence(row) });
  }

  const identityConflict = hasIdentityConflict(people) || hasIdentityConflict(patientIds);
  // A single imported file spanning distinct episodes is also held apart:
  // selecting a first episode would obscure a source conflict.
  const episodeConflict = episodes.length > 1;
  return {
    id: input.id, name: input.name, fingerprint: input.fingerprint, kind,
    status: !meaningful ? 'unreadable' : identityConflict || episodeConflict ? 'quarantined' : 'ready',
    pages: input.pages.map(page => ({ ...page })), entries, notices,
    person: people[0], patientId: patientIds[0], episodeRef: episodes[0],
    orderIds, date, collectionDate, reportDate, reportId, reportLabel,
    createdAt: new Date().toISOString(), mime: input.mime ?? 'text/plain',
    size: input.size ?? new TextEncoder().encode(text).byteLength,
    error: !meaningful ? 'No readable selectable text was found. View the attachment and add details manually.'
      : identityConflict ? 'This file contains conflicting patient labels. Keep it separate and use a file for one person.'
        : episodeConflict ? 'This file contains more than one episode reference. Split it into separate source files before using it.' : undefined,
  };
}
